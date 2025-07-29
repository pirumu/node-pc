import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as HID from 'node-hid';
import { Observable, Subject, fromEvent, timer, interval } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';

import { HidOptions } from './hid-stream/hidstream';
import { KeyboardLines } from './hid-stream/keyboard-line';

export type DeviceConfig = {
  manufacturer?: string;
  interface?: number;
  vendorId?: number;
  productId?: number;
};

@Injectable()
export class HidService implements OnModuleDestroy {
  private readonly _logger = new Logger(HidService.name);
  private readonly _initialReconnectIntervalMs = 1000; // 1s
  private readonly _maxReconnectIntervalMs = 30000; // 30s
  private readonly _reconnectBackoffFactor = 2;
  private readonly _deviceScanIntervalMs = 3000; // 3s

  private _deviceConfig: DeviceConfig;
  private _hidDevice: KeyboardLines | null = null;
  private _destroy$ = new Subject<void>();
  private _isConnected: boolean = false;
  private _reconnectAttempt = 0;
  private _reconnectStatus$ = new Subject<string>();
  private _scanSubscription: any;

  constructor() {}

  public setConfig(config: DeviceConfig): void {
    this._deviceConfig = config;
    // Start device scanning after config is set
    this._startDeviceScanning();
  }

  public onModuleDestroy(): void {
    this.close();
    this._destroy$.next();
    this._destroy$.complete();
    this._reconnectStatus$.complete();
  }

  public data$(): Observable<string> {
    return new Observable<string>((subscriber) => {
      if (!this._hidDevice) {
        subscriber.error(new Error('Device not connected'));
        return;
      }
      fromEvent(this._hidDevice, 'data')
        .pipe(
          takeUntil(this._destroy$),
          catchError((error) => {
            this._logger.error('HidService: Data stream error:', error);
            this._handleDeviceError(error);
            return new Observable<string>((sub) => sub.error(error));
          }),
          finalize(() => {
            this._logger.log('HidService: Data stream finalized.');
          }),
        )
        .subscribe(subscriber);
    });
  }

  public error$(): Observable<Error> {
    return new Observable<Error>((subscriber) => {
      if (!this._hidDevice) {
        subscriber.error(new Error('Device not connected'));
        return;
      }
      fromEvent(this._hidDevice, 'error')
        .pipe(
          takeUntil(this._destroy$),
          catchError((error) => {
            this._logger.error('HidService: Error stream error:', error);
            this._handleDeviceError(error);
            return new Observable<Error>((sub) => sub.error(error));
          }),
          finalize(() => {
            this._logger.log('HidService: Error stream finalized.');
          }),
        )
        .subscribe(subscriber);
    });
  }

  private _startDeviceScanning(): void {
    // Initial scan
    this._scanAndConnect();

    // Setup periodic scanning
    this._scanSubscription = interval(this._deviceScanIntervalMs)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        if (!this._isConnected) {
          this._scanAndConnect();
        }
      });
  }

  private _scanAndConnect(): void {
    try {
      const devices = HID.devices();
      const device = this._findMatchingDevice(devices);

      if (device) {
        this._logger.log(`Found matching device: ${device.path}`);
        this._connectToDevice({
          vendorId: device.vendorId,
          productId: device.productId,
          path: device.path,
        });
      } else {
        this._logger.debug('No matching device found');
      }
    } catch (error) {
      this._logger.error('Error scanning for devices:', error);
    }
  }

  private _findMatchingDevice(devices: HID.Device[]): HID.Device | undefined {
    return devices.find((device) => {
      if (this._deviceConfig.vendorId && this._deviceConfig.productId) {
        return device.vendorId === this._deviceConfig.vendorId && device.productId === this._deviceConfig.productId;
      }

      if (this._deviceConfig.manufacturer && this._deviceConfig.interface !== undefined) {
        return device.manufacturer?.includes(this._deviceConfig.manufacturer) && device.interface === this._deviceConfig.interface;
      }

      return false;
    });
  }

  private _connectToDevice(options: HidOptions): void {
    if (this._isConnected) {
      return;
    }

    try {
      if (this._hidDevice) {
        this.close();
      }

      this._hidDevice = new KeyboardLines(options);
      this._isConnected = true;
      this._reconnectAttempt = 0;
      this._logger.log('HidService: Device connected successfully.');
      this._reconnectStatus$.next('connected');

      // Setup error handling
      this.error$().subscribe({
        error: (err) => {
          this._logger.error('HidService: Device error detected, attempting to reconnect...', err);
          this._reconnect();
        },
      });
    } catch (error) {
      this._logger.error('HidService: Failed to connect to device:', error);
      this._hidDevice = null;
      this._isConnected = false;
      this._reconnect();
    }
  }

  public connect(): void {
    this._scanAndConnect();
  }

  public close(): void {
    if (this._scanSubscription) {
      this._scanSubscription.unsubscribe();
      this._scanSubscription = null;
    }

    if (this._hidDevice) {
      try {
        this._hidDevice.close();
        this._logger.log('HidService: Device closed successfully.');
      } catch (error) {
        this._logger.error('HidService: Error closing device:', error);
      }
      this._hidDevice = null;
    }
    this._isConnected = false;
  }

  private _handleDeviceError(error: Error): void {
    this._logger.error('HidService: Handling device error:', error);
    this.close();
    this._reconnect();
  }

  public get reconnectStatus$(): Observable<string> {
    return this._reconnectStatus$.asObservable();
  }

  private _reconnect(): void {
    if (this._isConnected) {
      this._logger.log('HidService: Device is already connected, no need to reconnect.');
      this._reconnectStatus$.next('connected');
      return;
    }

    let delayTime = this._initialReconnectIntervalMs * Math.pow(this._reconnectBackoffFactor, this._reconnectAttempt);
    delayTime = Math.min(delayTime, this._maxReconnectIntervalMs);

    this._reconnectAttempt++;
    this._logger.log(`HidService: Attempting to reconnect (attempt ${this._reconnectAttempt}, next delay ${delayTime}ms)...`);
    this._reconnectStatus$.next(`reconnecting_attempt_${this._reconnectAttempt}`);

    timer(delayTime)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this._scanAndConnect();
      });
  }
}
