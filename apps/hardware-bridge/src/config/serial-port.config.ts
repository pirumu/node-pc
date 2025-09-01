import { resolve } from '@config/core';

export const getSerialportConfig = () => {
  return {
    defaultPorts: resolve('SERIALPORT_DEFAULT_PORTS', (v: string) => (v || '').split(','), { default: [] }),
    discovery: {
      enabled: resolve('SERIALPORT_ENABLED', (v: string) => v === 'true', { default: true }),
      serialOptions: {
        baudRate: resolve('SERIALPORT_BAUD_RATE', Number, { default: 9600 }),
        dataBits: resolve('SERIALPORT_DATA_BITS', Number, { default: 8 }),
        stopBits: resolve('SERIALPORT_STOP_BITS', Number, { default: 1 }),
        parity: resolve('SERIALPORT_PARITY', String, { default: 'none' }),
        autoOpen: resolve('SERIALPORT_AUTO_OPEN', (v: string) => v === 'true', { default: false }),
      },
    },
    monitoring: {
      enabled: resolve('SERIALPORT_MONITORING_ENABLED', (v: string) => v === 'true', { default: true }),
      enableEventLogging: resolve('SERIALPORT_EVENT_LOGGING_ENABLED', (v: string) => v === 'true', { default: true }),
    },
  };
};
