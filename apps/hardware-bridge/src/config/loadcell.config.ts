import { resolve } from '@config/core';

export const getLoadcellConfig = () => {
  return {
    loadCellConfig: {
      enabled: resolve('LOADCELL_ENABLED', (v: string) => v === 'true', { default: true }),
      logLevel: resolve('LOADCELL_LOG_LEVEL', Number, { default: 1 }),
      pollingInterval: resolve('LOADCELL_POLLING_INTERVAL', Number, { default: 500 }),
    },
    healthMonitoringConfig: {
      enabled: resolve('LOADCELL_MONITORING_ENABLED', (v: string) => v === 'true', { default: true }),
      heartbeatTimeout: resolve('LOADCELL_MONITORING_HEARTBEAT_TIMEOUT', Number, { default: 10000 }),
      logConnectionChanges: resolve('LOADCELL_MONITORING_LOG_CONNECTION_CHANGES', (v: string) => v === 'true', { default: true }),
      checkInterval: resolve('LOADCELL_MONITORING_CHECK_INTERVAL', Number, { default: 5000 }),
    },
  };
};

export type LoadcellConfig = ReturnType<typeof getLoadcellConfig>;
