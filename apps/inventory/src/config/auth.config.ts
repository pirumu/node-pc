import { resolve } from '@config/core';

export type AuthConfig = {
  secret: string;
  expiresIn: string;
};

export const getAuthConfig = (): AuthConfig => ({
  secret: resolve('JWT_SECRET', String, { require: true }),
  expiresIn: resolve('JWT_EXPIRES_IN', String, { default: '24h' }),
});
