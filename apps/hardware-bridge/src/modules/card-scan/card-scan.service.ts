import { CardDeviceConnectedEvent, CardScannedEvent } from '@common/business/events';
import { HidDeviceConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { PublisherService, Transport } from '@framework/publisher';
import { HidService } from '@hid';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CardScanService implements OnModuleInit {
  private readonly _logger = new Logger(CardScanService.name);

  constructor(
    private readonly _hidService: HidService,
    private readonly _configService: ConfigService,
    private readonly _publisherService: PublisherService,
  ) {}

  public async onModuleInit(): Promise<void> {
    await this._initializeDeviceScanning();
  }

  private async _initializeDeviceScanning(): Promise<void> {
    const hidDeviceConfig = this._configService.getOrThrow<HidDeviceConfig>(CONFIG_KEY.HID);
    this._hidService.setConfig(hidDeviceConfig);

    // Connect to device
    this._hidService.connect();

    // Monitor connection status
    this._hidService.reconnectStatus$.subscribe({
      next: async (status) => {
        const isConnected = status === 'connected';
        const event = new CardDeviceConnectedEvent({ isConnected });
        await this._publisherService.publish(Transport.MQTT, event.getChannel(), event.getPayload(), {}, { async: true });
        if (isConnected) {
          this._subscribeToHidData(); // Subscribe only when connected
        }
      },
      error: (error) => {
        this._logger.error('Received error', error);
      },
      complete: () => {
        this._logger.log('Received complete');
      },
    });
  }

  private _subscribeToHidData(): void {
    this._hidService.data$().subscribe({
      next: async (value) => {
        this._logger.log(`Card scanned: ${value}`);
        const event = new CardScannedEvent({ value });
        await this._publisherService.publish(Transport.MQTT, event.getChannel(), event.getPayload(), {}, { async: true });
      },
      error: (error) => {
        this._logger.error('HID data stream error:', error);
      },
    });

    this._hidService.error$().subscribe({
      next: (error) => {
        this._logger.error('HID device error:', error);
      },
    });
  }
}
