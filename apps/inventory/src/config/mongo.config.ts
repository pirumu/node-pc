import { MongoDBConfig } from '@config/contracts';
import { resolve } from '@config/core';

export const getMongoDBConfig = (): MongoDBConfig => {
  const host = resolve('MONGO_HOST', String, { default: 'localhost' });
  const port = resolve(
    'MONGO_PORT',
    (value) => {
      return parseInt(<string>value, 10);
    },
    { default: 27017 },
  );
  const database = resolve('MONGO_DATABASE', String, { require: true });
  const username = resolve('MONGO_USERNAME', String, { default: undefined });
  const password = resolve('MONGO_PASSWORD', String, { default: undefined });
  const authSource = resolve('MONGO_AUTH_SOURCE', String, {
    default: undefined,
  });

  // Construct URI if not provided
  let uri = resolve('MONGO_URI', String, { default: undefined });
  if (!uri) {
    if (username && password) {
      uri = `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=${authSource}`;
    } else {
      uri = `mongodb://${host}:${port}/${database}`;
    }
  }

  return {
    uri,
    host,
    port,
    database,
    username,
    password,
    authSource,

    // Connection Pool Settings
    maxPoolSize: resolve('MONGO_MAX_POOL_SIZE', (v: string) => parseInt(v, 10), {
      default: 10,
    }),
    minPoolSize: resolve('MONGO_MIN_POOL_SIZE', (v: string) => parseInt(v, 10), {
      default: 1,
    }),

    // Timeout Settings (in milliseconds)
    serverSelectionTimeoutMS: resolve('MONGO_SERVER_SELECTION_TIMEOUT_MS', (v: string) => parseInt(v, 10), { default: 5000 }),
    socketTimeoutMS: resolve('MONGO_SOCKET_TIMEOUT_MS', (v: string) => parseInt(v, 10), {
      default: 45000,
    }),
    connectTimeoutMS: resolve('MONGO_CONNECT_TIMEOUT_MS', (v: string) => parseInt(v, 10), {
      default: 10000,
    }),
    heartbeatFrequencyMS: resolve('MONGO_HEARTBEAT_FREQUENCY_MS', (v: string) => parseInt(v, 10), {
      default: 10000,
    }),

    // Retry Settings
    retryWrites: resolve('MONGO_RETRY_WRITES', (v) => v === 'true', {
      default: true,
    }),
    retryReads: resolve('MONGO_RETRY_READS', (v) => v === 'true', {
      default: true,
    }),

    // Buffer Settings
    bufferCommands: resolve('MONGO_BUFFER_COMMANDS', (v) => v === 'true', {
      default: false,
    }),

    // SSL/TLS Settings
    ssl: {
      enabled: resolve('MONGO_SSL', (v) => v === 'true', { default: false }),
      ca: resolve('MONGO_SSL_CA', String, { default: undefined }),
      cert: resolve('MONGO_SSL_CERT', String, { default: undefined }),
      key: resolve('MONGO_SSL_KEY', String, { default: undefined }),

      caData: resolve('MONGO_SSL_CA_DATA', String, { default: undefined }),
      certData: resolve('MONGO_SSL_CERT_DATA', String, { default: undefined }),
      keyData: resolve('MONGO_SSL_KEY_DATA', String, { default: undefined }),
    },

    // Debug Settings
    debug: resolve('MONGO_DEBUG', (v) => v === 'true', { default: false }),
    logLevel: resolve('MONGO_LOG_LEVEL', String, { default: 'info' }) as 'error' | 'warn' | 'info' | 'debug',
  };
};
