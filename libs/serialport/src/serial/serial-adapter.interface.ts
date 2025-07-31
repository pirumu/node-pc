import { SerialPort } from 'serialport';

export type SerialPortInfo = {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
};

export type SerialPortState = {
  path: string;
  isOpen: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastError?: string;
};

export type ParserOptions = {
  delimiter?: string | Buffer;
  includeDelimiter?: boolean;
  encoding?: 'ascii' | 'utf8' | 'utf16le' | 'ucs2' | 'base64' | 'binary' | 'hex';
  length?: number;
};

export type ParserConfig = {
  type: 'readline' | 'bytelength' | 'delimiter' | 'raw';
  options?: ParserOptions;
};

export type BufferStrategy = {
  type: 'none' | 'time' | 'size' | 'delimiter' | 'combined';
  timeMs?: number;
  size?: number;
  delimiter?: Buffer;
  maxBufferSize?: number;
};

export type SerialOptions = {
  baudRate: number;
  dataBits?: 8 | 7 | 6 | 5;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
  autoOpen?: boolean;
  parser?: ParserConfig;
  bufferStrategy?: BufferStrategy;
  reconnectStrategy?: 'retry' | 'interval' | 'exponential';
  maxReconnectAttempts?: number;
  retryDelay?: number;
  validateData?: (data: Buffer) => boolean;
  headerByte?: number;
  flushOnError?: boolean;
};

export type ConnectedPortInfo = {
  path: string;
  info?: SerialPortInfo;
  state?: SerialPortState;
  options?: SerialOptions;
  connectedAt?: Date;
};

export type ConnectionSummary = {
  path: string;
  state: SerialPortState;
  options: SerialOptions;
};

export type ConnectionStats = {
  totalConnections: number;
  openConnections: number;
  connectingPorts: number;
  failedPorts: number;
};

export interface ISerialAdapter {
  listPorts(): Promise<SerialPortInfo[]>;
  open(path: string, options: SerialOptions): Promise<SerialPortState>;
  close(path: string): Promise<void>;
  write(path: string, data: string | Buffer): Promise<boolean>;

  // Stream data - callback for continuous data
  onDataStream(path: string, callback: (data: Buffer) => void): void;

  // Buffered data - Promise resolves when buffer strategy emits
  onData(path: string): Promise<Buffer>;

  // Error handling
  onError(path: string): Promise<Error>;

  // State management
  getConnectionState(path: string): Promise<SerialPortState>;
  isOpen(path: string): Promise<boolean>;

  // Utils
  dispose(): Promise<void>;
  getConnectedPorts(): Promise<string[]>;
  getConnectedPortsInfo(): Promise<ConnectedPortInfo[]>;
  isPortConnected(path: string): Promise<boolean>;
  getAllConnections(): Promise<ConnectionSummary[]>;
  getConnectionTime(path: string): Promise<Date | undefined>;
  getConnectionStats(): Promise<ConnectionStats>;
}

export type SerialConnection = {
  path: string;
  port?: SerialPort;
  parser?: any;
  state: SerialPortState;
  options: SerialOptions;

  // Raw data callbacks
  dataStreamCallbacks: ((data: Buffer) => void)[];
  errorCallbacks: ((error: Error) => void)[];

  // Buffer management
  rawBuffer: Buffer;
  bufferedDataQueue: Buffer[];
  bufferTimeout?: NodeJS.Timeout;

  // Promise resolvers for onData()
  dataResolvers: ((data: Buffer) => void)[];
  errorResolvers: ((error: Error) => void)[];
};
