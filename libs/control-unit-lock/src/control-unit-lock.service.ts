import { CuResponse } from '@culock/protocols/cu';
import { ScuResponse } from '@culock/protocols/scu/scu.types';
import { sleep } from '@framework/time/sleep';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectSerialManager, ISerialAdapter, SerialPortState } from '@serialport/serial';

import { DETECT_CU_PORT_MESSAGE, DETECT_SCU_PORT_MESSAGE } from './control-unit-lock.constants';
import { CuLockRequest } from './dto';
import { BaseResponse, IProtocol, LOCK_STATUS, ProtocolFactory, ProtocolType } from './protocols';

@Injectable()
export class ControlUnitLockService implements OnModuleInit {
  private readonly _logger: Logger = new Logger(ControlUnitLockService.name);
  private readonly _controlUnitLockPorts: string[] = [];
  private readonly _subControlUnitPorts: string[] = [];

  constructor(@InjectSerialManager() private readonly _serialManager: ISerialAdapter) {}

  public async onModuleInit(): Promise<void> {
    try {
      await this._detectPorts();
      await this._openPorts();
    } catch (error) {
      this._logger.error(`Error while setting CU Lock`, {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      });
    }
  }

  public async execute(request: CuLockRequest): Promise<BaseResponse> {
    if (!this._canProcessRequest(request)) {
      throw new Error(`No port available for protocol: ${request.protocol}`);
    }
    const protocol = ProtocolFactory.createProtocol(request.protocol);

    if (this._isMultipleRequest(request)) {
      return this._handleMultipleRequest(request, protocol);
    }
    return this._handleSingleRequest(request, protocol);
  }

  private _canProcessRequest(request: CuLockRequest): boolean {
    if (request.protocol === ProtocolType.CU) {
      return this._controlUnitLockPorts.length > 0;
    }
    return this._subControlUnitPorts.length > 0;
  }

  private async _handleSingleRequest(request: CuLockRequest, protocol: IProtocol<BaseResponse>): Promise<ScuResponse> {
    const port = this._subControlUnitPorts[0];
    if (!(await this._isPortOpen(port))) {
      throw new Error(`Port not open: ${request.protocol}`);
    }

    const msg = protocol.createMessage({
      command: request.command,
      deviceId: request.deviceId,
      lockId: 0,
    });

    await this._serialManager.write(port, msg);

    const response = await this._serialManager.onData(port);
    return protocol.parseResponse(request.deviceId, request.lockIds, Buffer.from(response)) as ScuResponse;
  }

  private async _handleMultipleRequest(request: CuLockRequest, protocol: IProtocol<BaseResponse>): Promise<CuResponse> {
    const port = this._controlUnitLockPorts[0];
    if (!(await this._isPortOpen(port))) {
      throw new Error(`Port not open: ${request.protocol}`);
    }

    const messages = protocol.createMessages({
      command: request.command,
      deviceId: request.deviceId,
      lockIds: request.lockIds,
    });

    for (const msg of messages) {
      await this._serialManager.write(port, msg);
      await sleep(250);
    }
    const response = await this._serialManager.onData(port);
    const result = protocol.parseResponse(request.deviceId, request.lockIds, Buffer.from(response)) as CuResponse;
    return this._filterStatus(request.lockIds, result);
  }

  private _isMultipleRequest(request: CuLockRequest): boolean {
    return request.protocol === ProtocolType.CU;
  }

  private async _detectPorts(): Promise<void> {
    this._logger.log(`Starting detect port for culock`);
    try {
      const availablePorts = await this._serialManager.listPorts();
      this._logger.debug(`Found ${availablePorts.length} available ports`, availablePorts);
      if (!availablePorts || availablePorts.length === 0) {
        this._logger.warn('No port found for culock. Skipping');
        return;
      }
      for (const portInfo of availablePorts) {
        await this._scanSinglePort(portInfo.path);
        await this._serialManager.close(portInfo.path);
      }
      this._logger.log('Scan completed:', {
        cu: this._controlUnitLockPorts.length,
        scu: this._subControlUnitPorts.length,
      });
    } catch (error) {
      this._logger.error('Error during port scanning:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async _openPorts(): Promise<void> {
    await Promise.all([
      ...this._controlUnitLockPorts.map(
        async (cuPort): Promise<SerialPortState> =>
          this._serialManager.open(cuPort, {
            baudRate: 19200,
            bufferStrategy: {
              type: 'time',
              timeMs: 500,
              maxBufferSize: 1024,
            },
            parser: { type: 'bytelength', options: { length: 18 } },
          }),
      ),
      ...this._subControlUnitPorts.map(
        async (scuPort): Promise<SerialPortState> =>
          this._serialManager.open(scuPort, {
            baudRate: 19200,
            bufferStrategy: {
              type: 'time',
              timeMs: 500,
              maxBufferSize: 1024,
            },
            parser: { type: 'bytelength', options: { length: 8 } },
          }),
      ),
    ]);
  }

  private async _scanSinglePort(portPath: string): Promise<void> {
    this._logger.log(`Scanning port: ${portPath}`);

    try {
      // Open port
      const state = await this._serialManager.open(portPath, { baudRate: 19200, bufferStrategy: { type: 'time', timeMs: 1000 } });

      if (!state.isOpen) {
        this._logger.error(`Failed to open port: ${portPath}`);
        return;
      }
      const isCuHardware = await this._checkCuHardware(portPath);

      if (isCuHardware) {
        this._logger.log(`Found CU hardware on: ${portPath}`);
      } else {
        const isScuHardware = await this._checkScuHardware(portPath);
        if (isScuHardware) {
          this._logger.log(`Found SCU hardware on: ${portPath}`);
        }
      }
      this._addPort(portPath, isCuHardware ? ProtocolType.CU : ProtocolType.CU);
      await this._serialManager.close(portPath);
    } catch (error) {
      this._logger.error(`Error scanning port ${portPath}:`, {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      try {
        await this._serialManager.close(portPath);
      } catch (closeError) {
        this._logger.warn(`Failed to close port ${portPath}:`, {
          message: closeError.message,
          name: closeError.name,
          stack: closeError.stack,
        });
      }
    }
  }

  private async _checkScuHardware(portPath: string): Promise<boolean> {
    try {
      await this._serialManager.write(portPath, Buffer.from(DETECT_SCU_PORT_MESSAGE));
      const response = await this._serialManager.onData(portPath);
      const buffer = Buffer.isBuffer(response) ? response : Buffer.from(response, 'hex');
      return this._isScuResponse(buffer);
    } catch (error) {
      this._logger.error(`SCU check error on ${portPath}:`, {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return false;
    }
  }

  private async _checkCuHardware(portPath: string): Promise<boolean> {
    try {
      await this._serialManager.write(portPath, Buffer.from(DETECT_CU_PORT_MESSAGE));
      const response = await this._serialManager.onData(portPath);
      const buffer = Buffer.isBuffer(response) ? response : Buffer.from(response, 'hex');
      return this._isCuResponse(buffer);
    } catch (error) {
      this._logger.error(`CU check error on ${portPath}:`, {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return false;
    }
  }

  private _isScuResponse(data: Buffer): boolean {
    return data.length >= 3 && data[0] === 0xf5 && data[2] === 0x70;
  }

  private _isCuResponse(data: Buffer): boolean {
    return data.length >= 4 && data[0] === 0x02 && data[3] === 0x75;
  }

  private _addPort(portPath: string, type: ProtocolType): void {
    switch (type) {
      case ProtocolType.SCU:
        if (!this._subControlUnitPorts.includes(portPath)) {
          this._subControlUnitPorts.push(portPath);
        }
        break;
      case ProtocolType.CU:
        if (!this._controlUnitLockPorts.includes(portPath)) {
          this._controlUnitLockPorts.push(portPath);
        }
        break;
    }
  }

  private async _isPortOpen(portPath: string): Promise<boolean> {
    return this._serialManager.isOpen(portPath);
  }

  private _filterStatus(lockIds: number[], result: CuResponse): CuResponse {
    if (lockIds.length === 0) {
      return result;
    }
    const status = {} as { [lockId: number]: LOCK_STATUS };
    for (const lockId of lockIds) {
      status[lockId] = result.lockStatuses[lockId];
    }
    result.lockStatuses = status;
    return result;
  }
}
