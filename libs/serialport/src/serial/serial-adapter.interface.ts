import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { SerialPort } from 'serialport';
import { SerialPortHandler } from '@serialport/serial/impl/serial-port.helper';

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

export type SerialConnection = {
  path: string;
  handler?: SerialPortHandler;
  state$: BehaviorSubject<SerialPortState>;
  data$: Subject<Buffer>;
  rawData$: Subject<Buffer>;
  bufferedData$: Observable<Buffer>;
  error$: Subject<Error>;
  destroy$: Subject<void>;
  options: SerialOptions;
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

export type PortStatus = {
  availablePorts: SerialPortInfo[];
  connectedPorts: SerialPortInfo[];
  totalAvailable: number;
  totalConnected: number;
  unconnectedPorts: SerialPortInfo[];
};

export interface ISerialAdapter {
  listPorts(): Observable<SerialPortInfo[]>;
  open(path: string, options: SerialOptions): Observable<SerialPortState>;
  close(path: string): Observable<void>;
  write(path: string, data: string | Buffer): Observable<{ status: boolean }>;
  onData(path: string): Observable<Buffer>;
  onError(path: string): Observable<Error>;
  onConnectionState(path: string): Observable<SerialPortState>;
  isOpen(path: string): Observable<boolean>;
  dispose(): Observable<void>;
  getConnectedPorts(): string[];
  getConnectedPortsInfo(): Observable<ConnectedPortInfo[]>;
  isPortConnected(path: string): boolean;
  getPortConnectionState(path: string): SerialPortState | null;
  getAllConnections(): ConnectionSummary[];
  getConnectionTime(path: string): Date | undefined;
  getConnectionStats(): ConnectionStats;
}
