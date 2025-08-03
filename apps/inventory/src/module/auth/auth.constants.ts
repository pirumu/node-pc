export enum AuthType {
  JWT = 'JWT',
  FINGERPRINT = 'FINGERPRINT',
  FACE = 'FACE',
  CARD = 'CARD',
  DEVICE = 'DEVICE',
}

export enum AUTH_ROUTES {
  PATH = 'auth',
  LOGIN_BY_PIN_PASS = 'login-by-pin-pass',
  LOGIN = 'login',
  LOGIN_BY_FINGERPRINT = 'login/finger',
  SCAN_CARD = 'scan/card',
}
