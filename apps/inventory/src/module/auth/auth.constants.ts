export enum AuthType {
  JWT = 'JWT',
  FINGERPRINT = 'FINGERPRINT',
  FACE = 'FACE',
  CARD = 'CARD',
  DEVICE = 'DEVICE',
}

export enum AUTH_ROUTES {
  PATH = 'auth',
  LOGIN_BY_PIN_PASS = '2fa',
  LOGIN = 'login',
  LOGIN_BY_FINGERPRINT = 'login/finger',
  LOGIN_BY_FACE = 'login/face',
  FACIAL_RECOGNITION = 'facial-recognition',
  SCAN_CARD = 'scan/:cardId',
}
