export type MongoDBConfig = {
  uri: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  authSource?: string;

  // Connection options
  maxPoolSize: number;
  minPoolSize: number;
  serverSelectionTimeoutMS: number;
  socketTimeoutMS: number;
  connectTimeoutMS: number;
  heartbeatFrequencyMS: number;

  // Features
  retryWrites: boolean;
  retryReads: boolean;
  bufferCommands: boolean;

  // SSL/TLS
  ssl: boolean;
  sslCA?: string;
  sslCert?: string;
  sslKey?: string;

  // Debug
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
};
