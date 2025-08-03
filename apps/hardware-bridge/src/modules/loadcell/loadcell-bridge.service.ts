import { WeightCalculatedEvent } from '@common/business/events';
import { CONFIG_KEY } from '@config/core';
import { PublisherService, Transport } from '@framework/publisher';
import { sleep } from '@framework/time/sleep';
import { LoadcellsHealthMonitoringService, LoadcellsService } from '@loadcells';
import { LoadCellReading } from '@loadcells/loadcells.types';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PortDiscoveryService, PortMonitoringService } from '@serialport';
import { InjectSerialManager, ISerialAdapter } from '@serialport/serial';
import { from, interval, lastValueFrom, Subject } from 'rxjs';
import { map, take, takeUntil, timeout } from 'rxjs/operators';

import { LoadcellMqttRequest } from './dto/request';
import { CHAR_START, LINUX_PORTS, MESSAGE_LENGTH, VERIFY_TIMEOUT } from './loadcell.constants';
import { ILoadcellRepository, LOADCELL_REPOSITORY_TOKEN } from './repositories';

@Injectable()
export class LoadcellBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(LoadcellBridgeService.name);
  private readonly _destroy$ = new Subject<void>();

  // Map to store COM ID for each port
  private readonly _portComIdMap = new Map<string, number>();

  constructor(
    @Inject(LOADCELL_REPOSITORY_TOKEN)
    private readonly _loadcellDeviceRepository: ILoadcellRepository,
    @InjectSerialManager()
    private readonly _serialAdapter: ISerialAdapter,
    private readonly _configService: ConfigService,
    private readonly _loadcellsService: LoadcellsService,
    private readonly _healthService: LoadcellsHealthMonitoringService,
    private readonly _portDiscovery: PortDiscoveryService,
    private readonly _portMonitoring: PortMonitoringService,
    private readonly _publisherService: PublisherService,
  ) {}

  public async onModuleInit(): Promise<void> {
    (async (): Promise<void> => {
      try {
        // Setup services
        await this._setupServices();

        // Setup LoadCell hooks
        this._setupLoadCellHooks();

        // Setup health monitoring
        await this._setupHealthMonitoring();

        // Start monitoring
        await this._startLoadcells();

        await this.mock();
      } catch (error) {
        this._logger.error('Failed to initialize LoadCell service:', error);
      }
    })().catch(this._logger.error);
  }

  public async onModuleDestroy(): Promise<void> {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public async mock(): Promise<void> {
    try {
      const devices = await this._loadcellDeviceRepository.findAll();
      const deviceIds = devices.map((d) => this._extractRawDeviceId(d.deviceNumId));

      if (deviceIds.length > 0) {
        this._loadcellsService.setActiveDevices(deviceIds);
      } else {
        this._logger.warn(`No devices found`);
      }
      this._loadcellsService.startDataPolling();
    } catch (error) {
      this._logger.error('Error handling bin/open:', error);
    }
  }
  // mqtt request handlers
  public async onBinOpened(payload: LoadcellMqttRequest): Promise<void> {
    try {
      this._logger.log(`Received bin/open for bin ${payload.binId}`);

      const devices = await this._loadcellDeviceRepository.findByBinId(payload.binId);
      const deviceIds = devices.map((d) => this._extractRawDeviceId(d.deviceNumId));

      if (deviceIds.length > 0) {
        this._loadcellsService.setActiveDevices(deviceIds);
        this._logger.log(`Activated ${deviceIds.length} devices for bin ${payload.binId}`);
      } else {
        this._logger.warn(`No devices found for bin ${payload.binId}`);
      }
      this._loadcellsService.startDataPolling();
    } catch (error) {
      this._logger.error('Error handling bin/open:', error);
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-unused-vars
  public async onBinClosed(_payload: LoadcellMqttRequest): Promise<void> {
    try {
      this._logger.log('Received bin/close, resetting to online devices');
      this._loadcellsService.stopDataPolling();
    } catch (error) {
      this._logger.error('Error handling bin/close:', error);
    }
  }

  public async onActiveDevice(payload: LoadcellMqttRequest): Promise<void> {
    try {
      this._logger.log(`Received device/active for device ${payload.deviceId}`);

      const device = await this._loadcellDeviceRepository.findByDeviceId(payload.deviceId);

      if (device) {
        const rawDeviceId = this._extractRawDeviceId(device.deviceNumId);
        this._loadcellsService.setActiveDevices([rawDeviceId]);
      }
    } catch (error) {
      this._logger.error('Error handling device/active:', error);
    }
  }

  // Status and monitoring methods
  public async getStatus(): Promise<any> {
    return {
      loadcell: {
        isRunning: await lastValueFrom(this._loadcellsService.isRunning$),
        stats: this._loadcellsService.getCurrentStats(),
        connectedPorts: Array.from(this._portComIdMap.keys()),
        portComIds: Object.fromEntries(this._portComIdMap),
      },
      health: {
        stats: this._healthService.getCurrentStats(),
        connectedDevices: this._healthService.getConnectedDevices(),
        trackingDevices: this._healthService.getTrackingDevices(),
      },
      ports: {
        status: this._portMonitoring.getCurrentPortStatus(),
        health: this._portMonitoring.getCurrentHealthStatus(),
      },
    };
  }

  public async getDevices(): Promise<any> {
    return {
      online: await lastValueFrom(this._loadcellsService.onlineDevices$),
      active: this._loadcellsService.currentMessages.map((m) => m.no),
      tracking: this._healthService.getTrackingDevices(),
    };
  }

  public async scanPorts(): Promise<any> {
    const ports = await this._portDiscovery.refreshDiscover().toPromise();
    return {
      available: ports,
      connected: this._portMonitoring.getCurrentPortStatus()?.isOpen || [],
      verified: Array.from(this._portComIdMap.keys()),
    };
  }

  public async performHealthCheck(): Promise<any> {
    await this._healthService.forceHealthCheck();
    return {
      health: this._healthService.getCurrentStats(),
      timestamp: new Date(),
    };
  }

  private async _setupServices(): Promise<void> {
    const devices = await this._loadcellDeviceRepository.findAll();
    const trackingDevices = devices.map((device) => ({
      deviceId: this._extractRawDeviceId(device.deviceNumId),
      source: 'loadcell' as const,
      metadata: {
        dbId: device.id,
        fullDeviceId: device.deviceNumId.toString(),
        binId: device.binId,
      },
    }));

    this._healthService.setTrackingDevices(trackingDevices);
    this._logger.log(`Initialized tracking for ${devices.length} devices from database`);
  }

  private _setupLoadCellHooks(): void {
    this._loadcellsService.registerGlobalHooks({
      onData: (reading: LoadCellReading) => {
        if (reading.status === 'running') {
          const payload = {
            path: reading.path,
            deviceId: reading.deviceId,
            weight: reading.weight,
            status: reading.status,
            timestamp: reading.timestamp,
          };
          const event = new WeightCalculatedEvent({ ...payload, timestamp: payload.timestamp.toISOString() });
          this._publisherService
            .publish(Transport.MQTT, event.getChannel(), event.getPayload())
            .then(() => {
              this._logger.debug(`Published weight data for device ${reading.deviceId}: ${reading.weight}kg`);
            })
            .catch((error) => {
              this._logger.error(`Error publishing weight data for device ${reading.deviceId}:`, JSON.parse(JSON.stringify(error)));
            });
        }
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

  private async _setupHealthMonitoring(): Promise<void> {
    this._healthService.registerGlobalHooks({
      onConnectionChange: (event) => {
        const status = event.isConnected ? 'CONNECTED' : 'DISCONNECTED';
        this._logger.log(`Device ${event.deviceId}: ${status} (${event.source})`);

        if (event.source === 'loadcell') {
          // Find the correct COM ID for this device
          let fullDeviceId = event.deviceId;

          // If we have metadata with full device ID
          if (event.metadata?.fullDeviceId) {
            fullDeviceId = parseInt(event.metadata.fullDeviceId);
          }

          const payload = {
            deviceId: fullDeviceId,
            status: event.isConnected ? 'online' : 'offline',
            timestamp: event.timestamp,
          };
          this._publisherService.publish(Transport.MQTT, 'device/status', payload);
        }
      },

      onHealthStats: (stats) => {
        if (stats.disconnectedDevices > 0) {
          this._logger.warn(`Health check: ${stats.disconnectedDevices} devices offline`);
        }
      },

      onBatchStatus: (statuses) => {
        const offline = statuses.filter((s) => !s.isConnected);
        if (offline.length > 0) {
          this._logger.debug(`Batch status: ${offline.length} devices offline`);
        }
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
    const ports = await lastValueFrom(this._portDiscovery.availablePorts$().pipe(take(1)));

    // Ports with a manufacturer
    const usbPorts = ports.filter((p) => p.manufacturer).map((p) => p.path);

    // Add Linux serial ports
    const linuxPorts = LINUX_PORTS;

    // Windows COM ports if needed
    const windowsPorts: string[] = [];
    if (process.platform === 'win32') {
      for (let i = 1; i <= 20; i++) {
        windowsPorts.push(`COM${i}`);
      }
    }
    // Return unique ports
    return [...new Set([...usbPorts, ...linuxPorts, ...windowsPorts])];
  }

  private async _verifyLoadcellPort(portPath: string): Promise<boolean> {
    this._logger.debug(`Testing port ${portPath} for loadcell...`);

    try {
      await this._serialAdapter.open(portPath, {
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      });

      // Create promise to wait for valid response
      const verifyPromise = async (): Promise<boolean> =>
        new Promise<boolean>((resolve) => {
          let messageCount = 0;

          const subscription = from(this._serialAdapter.onData(portPath))
            .pipe(
              take(10), // Check first 10 messages max
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
            this._loadcellsService.stop();
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

  private _extractRawDeviceId(fullDeviceId: number): number {
    // Extract last 2 digits from device ID (e.g., "1101" -> 1)
    return parseInt(fullDeviceId.toString().slice(-2), 10);
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
