import { sleep } from '@framework/time/sleep';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ByteLengthParser, DelimiterParser, ReadlineParser, SerialPort, SerialPortOpenOptions } from 'serialport';

import { DISCOVERY_CONFIG } from '../../serialport.constants';
import { DiscoveryConfig } from '../../services/port-discovery.service';
import {
  ConnectedPortInfo,
  ConnectionStats,
  ConnectionSummary,
  ISerialAdapter,
  ParserConfig,
  SerialConnection,
  SerialOptions,
  SerialPortInfo,
  SerialPortState,
} from '../serial-adapter.interface';

export const DEFAULT_OPTIONS: SerialOptions = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  reconnectStrategy: 'retry',
  maxReconnectAttempts: 5,
  retryDelay: 1000,
  parser: { type: 'raw' },
  bufferStrategy: { type: 'none' },
};

@Injectable()
export class SerialPortAdapter implements ISerialAdapter, OnModuleDestroy {
  private readonly _logger = new Logger(SerialPortAdapter.name);
  private readonly _connectionTimes = new Map<string, Date>();
  private readonly _connections = new Map<string, SerialConnection>();
  private _isDestroyed = false;
  private readonly _defaultOptions: SerialOptions = DEFAULT_OPTIONS;

  constructor(@Inject(DISCOVERY_CONFIG) private readonly _configs: DiscoveryConfig) {
    this._defaultOptions = {
      ...this._defaultOptions,
      ...this._configs.serialOptions,
    };
  }

  public async onModuleDestroy(): Promise<void> {
    this._logger.log('Cleaning up SerialPortAdapter...');
    this._isDestroyed = true;
    this._connectionTimes.clear();
    await this.dispose();
  }

  private async _retryWithStrategy(
    operation: () => Promise<void>,
    path: string,
    strategy: string,
    retryDelay: number,
    maxAttempts: number,
  ): Promise<void> {
    let attempt = 0;

    while (attempt < maxAttempts && !this._isDestroyed) {
      try {
        await operation();
        return;
      } catch (error) {
        attempt++;

        if (attempt >= maxAttempts) {
          throw new Error(`Max reconnect attempts (${maxAttempts}) exceeded for ${path}`);
        }

        let delay = retryDelay;

        switch (strategy) {
          case 'exponential':
            delay = Math.min(retryDelay * Math.pow(2, attempt - 1), 60000);
            break;
          case 'retry':
          default:
            delay = retryDelay;
            break;
        }

        this._logger.log(`Reconnecting ${path} in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        await sleep(delay);
      }
    }
  }

  private _createParser(port: SerialPort, config: ParserConfig): any {
    switch (config.type) {
      case 'readline':
        return port.pipe(new ReadlineParser(config.options || { delimiter: '\r\n' }));
      case 'bytelength':
        return port.pipe(new ByteLengthParser({ length: config.options?.length || 8 }));
      case 'delimiter':
        return port.pipe(new DelimiterParser({ delimiter: config.options?.delimiter || '\n' }));
      case 'raw':
      default:
        return port;
    }
  }

  private _processBufferStrategy(connection: SerialConnection, data: Buffer): void {
    const { bufferStrategy } = connection.options;

    if (!bufferStrategy || bufferStrategy.type === 'none') {
      // No buffering - emit immediately
      this._emitBufferedData(connection, data);
      return;
    }

    switch (bufferStrategy.type) {
      case 'time':
        connection.rawBuffer = Buffer.concat([connection.rawBuffer, data]);

        if (connection.bufferTimeout) {
          clearTimeout(connection.bufferTimeout);
        }

        connection.bufferTimeout = setTimeout(() => {
          if (connection.rawBuffer.length > 0) {
            this._emitBufferedData(connection, connection.rawBuffer);
            connection.rawBuffer = Buffer.alloc(0);
          }
        }, bufferStrategy.timeMs || 100);
        break;

      case 'size':
        connection.rawBuffer = Buffer.concat([connection.rawBuffer, data]);

        if (connection.rawBuffer.length >= (bufferStrategy.size || 1024)) {
          this._emitBufferedData(connection, connection.rawBuffer);
          connection.rawBuffer = Buffer.alloc(0);
        }
        break;

      case 'delimiter':
        const delimiter = bufferStrategy.delimiter || Buffer.from([0x00]);
        const combined = Buffer.concat([connection.rawBuffer, data]);
        const maxSize = bufferStrategy.maxBufferSize || 1024 * 1024;

        if (combined.length > maxSize) {
          this._logger.warn(`Buffer exceeded max size (${maxSize} bytes). Flushing.`);
          connection.rawBuffer = Buffer.alloc(0);
          return;
        }

        let lastIndex = 0;
        let foundIndex = -1;

        while ((foundIndex = combined.indexOf(delimiter, lastIndex)) !== -1) {
          const chunk = combined.subarray(lastIndex, foundIndex);
          if (chunk.length > 0) {
            this._emitBufferedData(connection, chunk);
          }
          lastIndex = foundIndex + delimiter.length;
        }

        connection.rawBuffer = combined.subarray(lastIndex);
        break;

      case 'combined':
        connection.rawBuffer = Buffer.concat([connection.rawBuffer, data]);
        const isSizeReached = connection.rawBuffer.length >= (bufferStrategy.size || 1024);

        if (isSizeReached) {
          this._emitBufferedData(connection, connection.rawBuffer);
          connection.rawBuffer = Buffer.alloc(0);
        } else {
          if (connection.bufferTimeout) {
            clearTimeout(connection.bufferTimeout);
          }

          connection.bufferTimeout = setTimeout(() => {
            if (connection.rawBuffer.length > 0) {
              this._emitBufferedData(connection, connection.rawBuffer);
              connection.rawBuffer = Buffer.alloc(0);
            }
          }, bufferStrategy.timeMs || 100);
        }
        break;

      default:
        this._emitBufferedData(connection, data);
    }
  }

  private _emitBufferedData(connection: SerialConnection, data: Buffer): void {
    // Add to queue for onData() Promise resolvers
    connection.bufferedDataQueue.push(data);

    // Resolve waiting onData() promises
    if (connection.dataResolvers.length > 0) {
      const resolver = connection.dataResolvers.shift()!;
      const bufferedData = connection.bufferedDataQueue.shift()!;
      resolver(bufferedData);
    }
  }

  private _setupPortListeners(connection: SerialConnection, port: SerialPort, parser: any): void {
    const { options } = connection;

    port.on('open', () => {
      this._logger.log(`Port ${port.path} opened successfully`);
      connection.state = {
        ...connection.state,
        isOpen: true,
        isConnecting: false,
        reconnectAttempts: 0,
        lastError: undefined,
      };
    });

    port.on('error', (err: Error) => {
      this._logger.error(`Port ${port.path} error:`, err);
      connection.state = { ...connection.state, lastError: err.message };

      // Notify error callbacks
      connection.errorCallbacks.forEach((callback) => callback(err));

      // Resolve error promises
      connection.errorResolvers.forEach((resolver) => resolver(err));
      connection.errorResolvers = [];
    });

    port.on('close', () => {
      this._logger.warn(`Port ${port.path} closed`);
      connection.state = { ...connection.state, isOpen: false };
    });

    parser.on('data', (data: Buffer) => {
      // Validation
      if (options.validateData && !options.validateData(data)) {
        const error = new Error('Invalid data format');
        connection.errorCallbacks.forEach((callback) => callback(error));
        return;
      }

      if (options.headerByte !== undefined && data.length > 0 && data[0] !== options.headerByte) {
        const error = new Error('Invalid header byte');
        connection.errorCallbacks.forEach((callback) => callback(error));
        return;
      }

      // Stream callbacks - immediate raw data
      connection.dataStreamCallbacks.forEach((callback) => callback(data));

      // Buffer processing for onData()
      this._processBufferStrategy(connection, data);
    });

    parser.on('error', (err: Error) => {
      this._logger.error(`Parser error:`, err);
      connection.errorCallbacks.forEach((callback) => callback(err));
    });
  }

  private _createConnection(path: string, options: SerialOptions): SerialConnection {
    const mergedOptions = { ...this._defaultOptions, ...options };

    return {
      path,
      state: {
        path,
        isOpen: false,
        isConnecting: false,
        reconnectAttempts: 0,
      },
      options: mergedOptions,
      dataStreamCallbacks: [],
      errorCallbacks: [],
      rawBuffer: Buffer.alloc(0),
      bufferedDataQueue: [],
      dataResolvers: [],
      errorResolvers: [],
    };
  }

  private async _attemptPortOpen(connection: SerialConnection): Promise<void> {
    const { path, options } = connection;

    connection.state = {
      ...connection.state,
      isConnecting: true,
      reconnectAttempts: connection.state.reconnectAttempts + 1,
    };

    const portOptions: SerialPortOpenOptions<any> = {
      path,
      baudRate: options.baudRate,
      dataBits: options.dataBits ?? 8,
      stopBits: options.stopBits ?? 1,
      parity: options.parity ?? 'none',
      autoOpen: false,
    };

    const port = new SerialPort(portOptions);
    const parser = this._createParser(port, options.parser || { type: 'raw' });

    connection.port = port;
    connection.parser = parser;

    this._setupPortListeners(connection, port, parser);

    return new Promise<void>((resolve, reject) => {
      port.open((err) => {
        if (err) {
          connection.state = {
            ...connection.state,
            isConnecting: false,
            lastError: err.message,
          };
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async _closeConnection(path: string): Promise<void> {
    const connection = this._connections.get(path);
    if (!connection) {
      return;
    }

    if (connection.bufferTimeout) {
      clearTimeout(connection.bufferTimeout);
    }

    if (connection.port && connection.port.isOpen) {
      return new Promise<void>((resolve, reject) => {
        connection.port!.close((err) => {
          if (err) {
            this._logger.error(`Error closing port ${path}:`, err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  private _cleanupConnection(path: string): void {
    const connection = this._connections.get(path);
    if (connection) {
      if (connection.port) {
        connection.port.removeAllListeners();
      }
      if (connection.parser && connection.parser !== connection.port) {
        connection.parser.removeAllListeners();
      }

      if (connection.bufferTimeout) {
        clearTimeout(connection.bufferTimeout);
      }

      this._connections.delete(path);
    }
    this._connectionTimes.delete(path);
    this._logger.debug(`Connection ${path} cleaned up`);
  }

  // PUBLIC METHODS

  public async listPorts(): Promise<SerialPortInfo[]> {
    if (this._isDestroyed) {
      return [];
    }

    const ports = await SerialPort.list();
    return ports
      .map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer,
        serialNumber: p.serialNumber,
        vendorId: p.vendorId,
        productId: p.productId,
      }))
      .filter((p) => !!p.manufacturer);
  }

  public async open(path: string, options: SerialOptions): Promise<SerialPortState> {
    const existingConnection = this._connections.get(path);
    if (existingConnection) {
      this._logger.log(`Connection for ${path} already exists.`);
      return existingConnection.state;
    }

    const connection = this._createConnection(path, options);
    this._connections.set(path, connection);

    try {
      const strategy = options.reconnectStrategy || 'retry';
      const retryDelay = options.retryDelay || 1000;
      const maxAttempts = options.maxReconnectAttempts ?? 5;

      if (strategy === 'interval') {
        // Interval strategy - keep trying at intervals (non-blocking)
        this._startIntervalConnection(connection);
      } else {
        // Retry and exponential strategies (blocking)
        await this._retryWithStrategy(async () => this._attemptPortOpen(connection), path, strategy, retryDelay, maxAttempts);
      }

      this._connectionTimes.set(path, new Date());
      return connection.state;
    } catch (error) {
      this._logger.error(`Failed to establish connection for ${path}:`, error);
      connection.state = {
        ...connection.state,
        isOpen: false,
        isConnecting: false,
        lastError: (error as Error).message,
      };
      return connection.state;
    }
  }

  private async _startIntervalConnection(connection: SerialConnection): Promise<void> {
    const { path, options } = connection;
    const retryDelay = options.retryDelay || 1000;

    const attemptConnection = async () => {
      while (!this._isDestroyed && !connection.state.isOpen) {
        try {
          await this._attemptPortOpen(connection);
          this._connectionTimes.set(path, new Date());
          break;
        } catch (error) {
          this._logger.warn(`Connection attempt for ${path} failed. Retrying in ${retryDelay}ms...`);
          await sleep(retryDelay);
        }
      }
    };

    // Run in background
    attemptConnection();
  }

  public async write(path: string, data: string | Buffer): Promise<boolean> {
    const connection = this._connections.get(path);
    if (!connection?.port?.isOpen) {
      throw new Error(`Port ${path} is not open or does not exist.`);
    }

    return new Promise<boolean>((resolve, reject) => {
      connection.port!.write(data, (err) => {
        if (err) {
          this._logger.error(`Write error on ${path}:`, err);
          connection.errorCallbacks.forEach((callback) => callback(err));
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  public onDataStream(path: string, callback: (data: Buffer) => void): void {
    const connection = this._connections.get(path);
    if (!connection) {
      throw new Error(`Connection ${path} not found`);
    }

    connection.dataStreamCallbacks.push(callback);
  }

  public async onData(path: string): Promise<Buffer> {
    const connection = this._connections.get(path);
    if (!connection) {
      throw new Error(`Connection ${path} not found`);
    }

    // If there's already buffered data, return it immediately
    if (connection.bufferedDataQueue.length > 0) {
      return connection.bufferedDataQueue.shift()!;
    }

    // Otherwise, wait for next buffered data
    return new Promise<Buffer>((resolve, reject) => {
      connection.dataResolvers.push(resolve);
      connection.errorResolvers.push(reject);
    });
  }

  public async onError(path: string): Promise<Error> {
    const connection = this._connections.get(path);
    if (!connection) {
      throw new Error(`Connection ${path} not found`);
    }

    return new Promise<Error>((resolve) => {
      connection.errorCallbacks.push(resolve);
    });
  }

  public async getConnectionState(path: string): Promise<SerialPortState> {
    const connection = this._connections.get(path);
    if (!connection) {
      throw new Error(`Connection ${path} not found`);
    }
    return { ...connection.state };
  }

  public async isOpen(path: string): Promise<boolean> {
    const connection = this._connections.get(path);
    if (!connection) {
      throw new Error(`Connection ${path} not found`);
    }
    return connection.state.isOpen;
  }

  public async close(path: string): Promise<void> {
    const connection = this._connections.get(path);
    if (!connection) {
      return;
    }

    await this._closeConnection(path);
    this._cleanupConnection(path);
  }

  public async dispose(): Promise<void> {
    const paths = Array.from(this._connections.keys());
    await Promise.all(paths.map(async (path) => this.close(path)));
  }

  public async getConnectedPorts(): Promise<string[]> {
    return Array.from(this._connections.values())
      .filter((c) => c.state.isOpen)
      .map((c) => c.path);
  }

  public async getConnectedPortsInfo(): Promise<ConnectedPortInfo[]> {
    const connectedPaths = await this.getConnectedPorts();
    if (connectedPaths.length === 0) {
      return [];
    }

    const allPorts = await this.listPorts();
    return connectedPaths
      .map((path) => {
        const connection = this._connections.get(path);
        const portInfo = allPorts.find((p) => p.path === path);
        return {
          path,
          info: portInfo,
          state: connection?.state,
          options: connection?.options,
          connectedAt: this._connectionTimes.get(path),
        };
      })
      .filter((p) => !!p);
  }

  public async isPortConnected(path: string): Promise<boolean> {
    return this._connections.get(path)?.state.isOpen === true;
  }

  public async getAllConnections(): Promise<ConnectionSummary[]> {
    return Array.from(this._connections.entries()).map(([path, connection]) => ({
      path,
      state: { ...connection.state },
      options: connection.options,
    }));
  }

  public async getConnectionTime(path: string): Promise<Date | undefined> {
    return this._connectionTimes.get(path);
  }

  public async getConnectionStats(): Promise<ConnectionStats> {
    const allConnections = await this.getAllConnections();
    return {
      totalConnections: allConnections.length,
      openConnections: allConnections.filter((c) => c.state.isOpen).length,
      connectingPorts: allConnections.filter((c) => c.state.isConnecting).length,
      failedPorts: allConnections.filter((c) => !c.state.isOpen && !c.state.isConnecting).length,
    };
  }
}
