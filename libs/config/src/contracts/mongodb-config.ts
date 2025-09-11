import fs from 'fs';
import path from 'path';

export type MongoDBConfig = {
  uri: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  authSource?: string;
  replicaSet?: string;
  replicaSetUri?: string;
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

  // SSL/TLS Configuration
  ssl: {
    enabled: boolean;

    // Certificate files (paths)
    ca?: string; // Certificate Authority file path
    cert?: string; // Client certificate file path
    key?: string; // Client private key file path

    // Certificate content (base64 or PEM string)
    caData?: string; // CA certificate content
    certData?: string; // Client certificate content
    keyData?: string; // Client key content

    // SSL Options
    rejectUnauthorized?: boolean; // Verify server certificate (default: true)
    checkServerIdentity?: boolean; // Check server hostname (default: true)
    allowInvalidCertificates?: boolean; // Allow invalid certificates (default: false)
    allowInvalidHostnames?: boolean; // Allow invalid hostnames (default: false)

    // Advanced SSL options
    ciphers?: string; // SSL ciphers to use
    secureProtocol?: string; // SSL protocol version
    passphrase?: string; // Passphrase for encrypted key
    pfx?: string; // PFX file path (alternative to cert+key)
    pfxData?: string; // PFX file content
    servername?: string; // Server name for SNI
  };

  // Debug
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
};

function readSSLFile(filePath?: string): Buffer | undefined {
  if (!filePath) {
    return undefined;
  }

  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`SSL file not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath);
  } catch (error) {
    throw error;
  }
}

function parseSSLContent(data?: string): Buffer | undefined {
  if (!data) {
    return undefined;
  }

  try {
    if (data.match(/^[A-Za-z0-9+/]+=*$/)) {
      return Buffer.from(data, 'base64');
    }
    return Buffer.from(data, 'utf8');
  } catch (error) {
    throw error;
  }
}

export function buildSSLConfig(sslConfig: MongoDBConfig['ssl']) {
  if (!sslConfig?.enabled) {
    return undefined;
  }

  const ssl: any = {};

  // CA Certificate
  if (sslConfig.ca) {
    ssl.ca = readSSLFile(sslConfig.ca);
  } else if (sslConfig.caData) {
    ssl.ca = parseSSLContent(sslConfig.caData);
  }

  // Client Certificate
  if (sslConfig.cert) {
    ssl.cert = readSSLFile(sslConfig.cert);
  } else if (sslConfig.certData) {
    ssl.cert = parseSSLContent(sslConfig.certData);
  }

  // Client Private Key
  if (sslConfig.key) {
    ssl.key = readSSLFile(sslConfig.key);
  } else if (sslConfig.keyData) {
    ssl.key = parseSSLContent(sslConfig.keyData);
  }

  // PFX (alternative to cert + key)
  if (sslConfig.pfx) {
    ssl.pfx = readSSLFile(sslConfig.pfx);
  } else if (sslConfig.pfxData) {
    ssl.pfx = parseSSLContent(sslConfig.pfxData);
  }

  // SSL Options
  if (sslConfig.rejectUnauthorized !== undefined) {
    ssl.rejectUnauthorized = sslConfig.rejectUnauthorized;
  }

  if (sslConfig.checkServerIdentity !== undefined) {
    ssl.checkServerIdentity = sslConfig.checkServerIdentity;
  }

  if (sslConfig.allowInvalidCertificates !== undefined) {
    ssl.rejectUnauthorized = !sslConfig.allowInvalidCertificates;
  }

  if (sslConfig.allowInvalidHostnames !== undefined) {
    ssl.checkServerIdentity = sslConfig.allowInvalidHostnames ? false : undefined;
  }

  if (sslConfig.ciphers) {
    ssl.ciphers = sslConfig.ciphers;
  }

  if (sslConfig.secureProtocol) {
    ssl.secureProtocol = sslConfig.secureProtocol;
  }

  if (sslConfig.passphrase) {
    ssl.passphrase = sslConfig.passphrase;
  }

  if (sslConfig.servername) {
    ssl.servername = sslConfig.servername;
  }

  return ssl;
}
