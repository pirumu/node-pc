export const SERIAL_PORT_MANAGER = Symbol('SERIAL_PORT_MANAGER');

export const DEFAULT_OPTIONS = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  autoOpen: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
  retryDelay: 1000,
  maxRetries: 3,
};
