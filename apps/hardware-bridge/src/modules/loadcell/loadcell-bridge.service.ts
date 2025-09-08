import { WeightCalculatedEvent } from '@common/business/events';
import { CONFIG_KEY } from '@config/core';
import { PublisherService, Transport } from '@framework/publisher';
import { sleep } from '@framework/time/sleep';
import { LoadcellsService } from '@loadcells';
import { LoadCellReading } from '@loadcells/loadcells.types';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PortMonitoringService } from '@serialport';
import { InjectSerialManager, ISerialAdapter } from '@serialport/serial';
import { from, interval, Subject } from 'rxjs';
import { map, take, takeUntil, timeout } from 'rxjs/operators';

import { CHAR_START, MESSAGE_LENGTH, VERIFY_TIMEOUT } from './loadcell.constants';

@Injectable()
export class LoadcellBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(LoadcellBridgeService.name);
  private readonly _destroy$ = new Subject<void>();

  // Map to store COM ID for each port
  private readonly _portComIdMap = new Map<string, number>();

  constructor(
    @InjectSerialManager()
    private readonly _serialAdapter: ISerialAdapter,
    private readonly _configService: ConfigService,
    private readonly _loadcellsService: LoadcellsService,
    private readonly _portMonitoring: PortMonitoringService,
    private readonly _publisherService: PublisherService,
  ) {}

  public async onModuleInit(): Promise<void> {
    this._setup();
  }

  public async onModuleDestroy(): Promise<void> {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public async startReading(deviceIds: number[]): Promise<void> {
    this._loadcellsService.addActiveDevices(deviceIds);
  }
  public async forceStartReading(deviceIds: number[]): Promise<void> {
    this._loadcellsService.setActiveDevices(deviceIds);
  }
  public async stopReading(deviceIds: number[]): Promise<void> {
    this._loadcellsService.removeActiveDevices(deviceIds);
  }

  public async onActiveDevice(deviceIds: number[]): Promise<void> {
    this._loadcellsService.setActiveDevices(deviceIds);
  }

  private async _setup(): Promise<void> {
    try {
      // Setup LoadCell hooks
      this._setupLoadCellHooks();

      // Start monitoring
      await this._startLoadcells();
    } catch (error) {
      this._logger.error('Failed to initialize LoadCell service:', error);
    }
  }

  private _setupLoadCellHooks(): void {
    this._loadcellsService.registerGlobalHooks({
      onData: (reading: LoadCellReading) => {
        if (reading.status === 'running') {
          const event = new WeightCalculatedEvent({
            portPath: reading.path,
            hardwareId: reading.deviceId,
            weight: reading.weight,
            status: reading.status,
            timestamp: reading.timestamp.toISOString(),
          });

          this._publisherService
            .publish(Transport.MQTT, event.getChannel(), event.getPayload(), {}, { async: true })
            .then(() => {
              this._logger.log(`Published loadcell event`, event);
            })
            .catch((error) => {
              this._logger.error(`Error publishing loadcell event `, {
                message: error.message,
                stack: error.stack,
                name: error.name,
              });
            });
        }
        this._logger.log(`Loadcell raw`, reading);
      },
      onError: (error: Error, context?: string) => {
        this._logger.error(`LoadCell error in ${context}:`, error);
      },
      onDeviceDiscovery: (deviceId: number, isOnline: boolean) => {
        this._logger.log(`Device ${deviceId} discovery: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      },
      onStatusChange: (isRunning: boolean) => {
        this._logger.log(`LoadCell service status changed: ${isRunning ? 'RUNNING' : 'STOPPED'}`);
      },
    });
  }

  private async _startLoadcells(): Promise<void> {
    const config = this._configService.get<{ defaultPorts: string[] }>(CONFIG_KEY.SERIALPORT);

    if (config && config.defaultPorts.length > 0) {
      // Use configured ports
      this._logger.log(`Using configured ports: ${config.defaultPorts.join(', ')}`);

      // Store COM IDs for each port
      config.defaultPorts.forEach((port) => {
        const comId = this._extractComId(port);
        this._portComIdMap.set(port, comId);
      });

      await this._loadcellsService.start(config.defaultPorts);
    } else {
      // Auto-discover loadcell ports
      await this._autoDiscoverLoadcellPorts();
    }

    // Setup port monitoring
    this._setupPortMonitoring();
  }

  private async _autoDiscoverLoadcellPorts(): Promise<void> {
    this._logger.log('Auto-discovering loadcell ports...');

    // Get all possible ports
    const availablePorts = await this._getAllPossiblePorts();
    this._logger.log(`Found ${availablePorts.length} ports to test: ${availablePorts.join(', ')}`);

    // Verify each port
    const verifiedPorts: string[] = [];

    for (const port of availablePorts) {
      const isLoadcell = await this._verifyLoadcellPort(port);
      if (isLoadcell) {
        verifiedPorts.push(port);
        const comId = this._extractComId(port);
        this._portComIdMap.set(port, comId);
        this._logger.log(`Verified loadcell on ${port} (COM ID: ${comId})`);
      }
    }

    if (verifiedPorts.length > 0) {
      this._logger.log(`Starting monitoring on ${verifiedPorts.length} verified ports`);
      await this._loadcellsService.start(verifiedPorts);
    } else {
      this._logger.warn('No loadcell ports found! Retrying in 30 seconds...');
      interval(30000) // 30s
        .pipe(takeUntil(this._destroy$))
        .subscribe(async () => this._autoDiscoverLoadcellPorts());
    }
  }

  private async _getAllPossiblePorts(): Promise<string[]> {
    const ports = await this._serialAdapter.listPorts(true);

    // Windows COM ports if needed
    const windowsPorts: string[] = [];
    if (process.platform === 'win32') {
      for (let i = 1; i <= 20; i++) {
        windowsPorts.push(`COM${i}`);
      }
    }
    const sortedPorts = ports
      .map((p) => p.path)
      .sort((a, b) => {
        return a > b ? 1 : a < b ? -1 : 0;
      });
    // Return unique ports
    return [...new Set([...sortedPorts, ...windowsPorts])];
  }

  private async _verifyLoadcellPort(portPath: string): Promise<boolean> {
    this._logger.debug(`Testing port ${portPath} for loadcell...`);

    try {
      if (await this._serialAdapter.isOpen(portPath)) {
        return false;
      }
      await this._serialAdapter.open(portPath, {
        baudRate: 9600,
        autoOpen: false,
        parser: { type: 'bytelength', options: { length: 11 } },
        maxReconnectAttempts: 1,
      });

      // Create promise to wait for valid response
      const verifyPromise = async (): Promise<boolean> =>
        new Promise<boolean>((resolve) => {
          let messageCount = 0;

          const subscription = from(this._serialAdapter.onData(portPath))
            .pipe(
              take(1), // Check first 1 message max
              timeout(VERIFY_TIMEOUT),
              map((data: Buffer | string) => {
                return Buffer.isBuffer(data) ? data : Buffer.from(data, 'hex');
              }),
            )
            .subscribe({
              next: (buffer: Buffer) => {
                messageCount++;
                this._logger.debug(`Port ${portPath} received data (${messageCount}): ${buffer.toString('hex')}`);

                // Check if valid loadcell response
                if (buffer.length === MESSAGE_LENGTH && buffer[0] === CHAR_START) {
                  this._logger.debug(`Valid loadcell message from ${portPath}`);
                  subscription.unsubscribe();
                  resolve(true);
                }
              },
              error: () => {
                this._logger.debug(`Port ${portPath} timeout or error`);
                resolve(false);
              },
              complete: () => {
                this._logger.debug(`Port ${portPath} test complete, no valid messages`);
                resolve(false);
              },
            });

          // Send test messages
          this._sendTestMessages(portPath).catch((err) => {
            this._logger.debug(`Error sending test messages to ${portPath}: ${err.message}`);
            subscription.unsubscribe();
            resolve(false);
          });
        });

      const isLoadcellPort = await verifyPromise();

      // Close port after test
      await this._serialAdapter.close(portPath);

      return isLoadcellPort;
    } catch (error) {
      this._logger.debug(`Cannot open/test ${portPath}: ${error.message}`);
      return false;
    }
  }

  private async _sendTestMessages(port: string): Promise<void> {
    // Use first few messages from ALL_MESSAGES for testing
    const testMessages = [
      Buffer.from([0x01, 0x3c, 0x04, 0x00, 0x0a, 0x00, 0x01, 0x00, 0x7e, 0x08]),
      Buffer.from([0x02, 0x3c, 0x04, 0x00, 0x0a, 0x00, 0x01, 0x00, 0x3e, 0x1d]),
      Buffer.from([0x03, 0x3c, 0x04, 0x00, 0x0a, 0x00, 0x01, 0x00, 0xff, 0xd1]),
    ];

    for (const message of testMessages) {
      await this._serialAdapter.write(port, message);
      await sleep(100); // Wait 100ms between messages
    }
  }

  private _setupPortMonitoring(): void {
    this._portMonitoring
      .connectionEvents$()
      .pipe(takeUntil(this._destroy$))
      .subscribe(async (event) => {
        if (event.eventType === 'DISCONNECTED' && event.removed.length > 0) {
          this._logger.warn(`Ports disconnected: ${event.removed.join(', ')}`);

          // Remove disconnected ports from our map
          event.removed.forEach((port) => {
            this._portComIdMap.delete(port);
          });

          // Update loadcells service with remaining ports
          const remainingPorts = Array.from(this._portComIdMap.keys());
          if (remainingPorts.length > 0) {
            await this._loadcellsService.start(remainingPorts);
          } else {
            await this._loadcellsService.stop();
          }
        } else if (event.eventType === 'CONNECTED' && event.added.length > 0) {
          // Check if new ports are loadcells
          for (const port of event.added) {
            const isLoadcell = await this._verifyLoadcellPort(port);
            if (isLoadcell) {
              const comId = this._extractComId(port);
              this._portComIdMap.set(port, comId);
              this._logger.log(`New loadcell detected on ${port} (COM ID: ${comId})`);

              // Add to monitoring
              const allPorts = Array.from(this._portComIdMap.keys());
              await this._loadcellsService.start(allPorts);
            }
          }
        }
      });
  }

  private _extractComId(portPath: string): number {
    const match = portPath.match(/COM(\d+)|ttyUSB(\d+)|tty\.usbserial-(\d+)/i);
    if (match) {
      const comNumber = match[1] || match[2] || match[3];
      const isUSB = portPath.includes('USB') || portPath.includes('usbserial');
      return parseInt(comNumber, 10) + (isUSB ? 10 : 0);
    }
    return 0;
  }
}
