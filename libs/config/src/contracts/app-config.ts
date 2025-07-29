export type AppConfig = {
  name: string;
  version: string;
  debug: boolean;
  url: string;
  port: number;
  env: string;
  apiPrefix: string;
  enableCors?: boolean;
  corsOrigin?: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};
