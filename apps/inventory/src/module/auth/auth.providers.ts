import { AuthController } from './auth.controller';
import { AuthService, FingerprintAuthService, JwtAuthService, TabletAuthService } from './services';

export const CONTROLLERS = [AuthController];
export const SERVICES_PROVIDERS = [AuthService, JwtAuthService, TabletAuthService, FingerprintAuthService];
export const SERVICES_EXPORTS = [AuthService, JwtAuthService, TabletAuthService, FingerprintAuthService];
