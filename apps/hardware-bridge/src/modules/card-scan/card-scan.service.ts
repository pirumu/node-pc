import { CardDeviceConnectedEvent, CardScanEvent } from '@common/business/events';
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
    this._initializeDeviceScanning();
    this._subscribeToHidData();
  }

  private _initializeDeviceScanning(): void {
    const hidDeviceConfig = this._configService.getOrThrow<HidDeviceConfig>(CONFIG_KEY.HID);
    this._hidService.setConfig(hidDeviceConfig);

    // Connect to device
    this._hidService.connect();

    // Monitor connection status
    this._hidService.reconnectStatus$.subscribe(async (status) => {
      const isConnected = status === 'connected';
      const event = new CardDeviceConnectedEvent({ isConnected });
      return this._publisherService.publish(Transport.MQTT, event.getChannel(), event.getPayload());
    });
  }

  private _subscribeToHidData(): void {
    this._hidService.data$().subscribe({
      next: async (cardNumber) => {
        this._logger.log(`Card scanned: ${cardNumber}`);
        const event = new CardScanEvent({ cardNumber });
        return this._publisherService.publish(Transport.MQTT, event.getChannel(), event.getPayload());
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
