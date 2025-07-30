import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { ReadlineParser, SerialPort } from 'serialport';

export type SerialPortInfo = {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
};

export type SerialOptions = {
  baudRate: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  flowControl?: boolean;
  autoOpen?: boolean;
  reconnectInterval?: number; // ms
  maxReconnectAttempts?: number;
  retryDelay?: number; // ms
  maxRetries?: number;
};

export type SerialPortState = {
  path: string;
  isOpen: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastError?: Error;
};

export type SerialConnection = {
  port?: SerialPort;
  parser?: ReadlineParser;
  state$: BehaviorSubject<SerialPortState>;
  data$: Subject<string>;
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

export type PortStatus = {
  availablePorts: SerialPortInfo[];
  connectedPorts: ConnectedPortInfo[];
  totalAvailable: number;
  totalConnected: number;
  unconnectedPorts: SerialPortInfo[];
};

export type ConnectionStats = {
  totalConnections: number;
  openConnections: number;
  connectingPorts: number;
  failedPorts: number;
};

export interface ISerialAdapter {
  listPorts(): Observable<SerialPortInfo[]>;
  open(path: string, options: SerialOptions): Observable<SerialPortState>;
  write(path: string, data: string | Buffer): Observable<void>;
  onData(path: string): Observable<string>;
  onError(path: string): Observable<Error>;
  onConnectionState(path: string): Observable<SerialPortState>;
  isOpen(path: string): Observable<boolean>;
  close(path: string): Observable<void>;
  dispose(): Observable<void>;

  getConnectedPorts(): string[];
  getConnectedPortsInfo(): Observable<ConnectedPortInfo[]>;
  isPortConnected(path: string): boolean;
  getPortConnectionState(path: string): SerialPortState | null;
  getAllConnections(): ConnectionSummary[];
  getConnectionTime(path: string): Date | undefined;
  getConnectionStats(): ConnectionStats;
}
