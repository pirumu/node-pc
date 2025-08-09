import { WeightCalculatedEvent } from '@common/business/events';
import { BinItemMRepository, BinMRepository, DeviceMRepository, PortMRepository } from '@dals/mongo/repositories';
import { Injectable, Logger } from '@nestjs/common';
import { differenceInDays } from 'date-fns';
import { PublisherService, Transport } from '@framework/publisher';
import { EVENT_TYPE } from '@common/constants';

@Injectable()
export class DeviceWorkerService {
  private readonly _maxHistory = 10;
  private readonly _logger = new Logger(DeviceWorkerService.name);

  constructor(
    private readonly _portRepository: PortMRepository,
    private readonly _binRepository: BinMRepository,
    private readonly _binItemMRepository: BinItemMRepository,
    private readonly _deviceMRepository: DeviceMRepository,
    private readonly _publisher: PublisherService,
  ) {}

  public async updateWeight(event: WeightCalculatedEvent): Promise<any> {
    const { path: hardwarePort, deviceId: deviceId, weight: newWeight, status: newStatus } = event;

    if (newStatus !== 'running') {
      //todo: update
      this._logger.warn(`Device not running: ${deviceId}`);
      return [];
    }

    const ports = await this._portRepository.findMany({
      path: hardwarePort,
    });
    if (!ports.length) {
      this._logger.warn(`can not find any port by hardwarePort: ${hardwarePort}`);
      return [];
    }

    const data = await Promise.all(
      ports.map(async (port) => {
        await this._portRepository.updateFirst({ path: hardwarePort }, { $set: { heartbeat: Date.now() } }, {});

        const device = await this._deviceMRepository.findFirst({
          deviceNumId: deviceId,
          // portId: port._id,
        });

        if (!device || !device.binId || !device.itemId) {
          // todo: register device.
          this._logger.warn(`Skip device: ${deviceId}`);
          return null;
        }

        await this._deviceMRepository.updateFirst({ _id: device._id }, { $set: { heartbeat: Date.now(), status: newStatus } }, {});

        const bin = await this._binRepository.findById(device.binId);

        let changeQuantity1 = 0;
        const lastChangeQty = 0;
        let isExpired = false;
        let isTwoWeeksExpired = false;

        const binItem = await this._binItemMRepository.findFirst({
          itemId: device.itemId,
          binId: device.binId,
        });

        if (binItem && binItem.expiryDate) {
          const currentDate = new Date();
          const expiryDate = new Date(binItem.expiryDate);
          const daysToExpired = differenceInDays(currentDate, expiryDate);
          if (daysToExpired > 0 && daysToExpired <= 14) {
            isTwoWeeksExpired = true;
          } else if (daysToExpired <= 0) {
            isExpired = true;
          }
        }

        if (bin && bin.isLocked) {
          console.log('newWeight for bin is locked', newWeight);
          const changeQty = device.changeQty || 0;
          const quantity = (device.quantity || 0) + changeQty;
          await this._deviceMRepository.updateFirst(
            { _id: device._id },
            {
              $set: {
                weight: newWeight,
                quantity,
                changeQty: 0,
                isSync: changeQty !== 0 ? false : device.isSync,
              },
            },
            {},
          );

          return {
            id: device._id.toString(),
            name: device.description ? device.description.name : '',
            partNumber: device.description ? device.description.partNumber : '',
            deviceId,
            portId: port._id.toString(),
            portName: port.name,
            weight: newWeight,
            quantity: device.quantity,
            changeQuantity: lastChangeQty,
            status: newStatus,
            binId: device.binId,
            isDamage: (device.damageQuantity || 0) > 0,
            isExpired,
            isTwoWeeksExpired,
          };
        }

        if (!device.isUpdateWeight) {
          await this._deviceMRepository.updateFirst(
            { _id: device._id },
            {
              $set: {
                weight: newWeight,
                zeroWeight: newWeight,
                isUpdateWeight: true,
              },
            },
            {},
          );
          return {
            id: device._id.toString(),
            name: device.description ? device.description.name : '',
            partNumber: device.description ? device.description.partNumber : '',
            deviceId,
            portId: port._id.toString(),
            portName: port.name,
            weight: newWeight,
            quantity: device.quantity,
            changeQuantity: lastChangeQty,
            status: newStatus,
            binId: device.binId,
            isDamage: (device.damageQuantity || 0) > 0,
            isExpired,
            isTwoWeeksExpired,
          };
        }

        const weightHistory = device.weightHistory || [];

        const newWeightHistory1 = [newWeight, ...weightHistory.slice(0, 10)];
        const zeroWeight = device.zeroWeight || 0;
        const unitWeight = device.unitWeight || 0;

        const newOffsetWeight = newWeight - zeroWeight;

        const calcNewQuantity = unitWeight > 0 ? newOffsetWeight / unitWeight : 0;

        changeQuantity1 =
          Math.round(calcNewQuantity) === Infinity || Math.round(calcNewQuantity) === -Infinity
            ? 0
            : calcNewQuantity > 0
              ? Math.round(calcNewQuantity - 0.3)
              : Math.round(calcNewQuantity + 0.29);
        if (device.unitWeight) {
          this._logger.log('quantity unitWeight', device.quantity, changeQuantity1);
          await this._deviceMRepository.updateFirst(
            { _id: device._id },
            {
              $set: {
                weightHistory: newWeightHistory1,
                weight: newWeight,
                quantity: device.quantity,
                changeQty: changeQuantity1,
              },
            },
            {},
          );
        }

        return {
          id: device.id,
          name: device.description ? device.description.name : '',
          partNumber: device.description ? device.description.partNumber : '',
          deviceId,
          portId: port.id,
          portName: port.name,
          weight: newWeight,
          quantity: (device.quantity || 0) + changeQuantity1,
          changeQuantity: changeQuantity1,
          status: newStatus,
          binId: device.binId,
          isDamage: (device.damageQuantity || 0) > 0,
          isExpired,
          isTwoWeeksExpired,
        };
      }),
    );
    const finalData = data.filter(Boolean);
    if (finalData.length > 0) {
      this._publisher.publish(Transport.MQTT, 'device/computed' + finalData[0]?.portName, finalData);
    }
  }
}
