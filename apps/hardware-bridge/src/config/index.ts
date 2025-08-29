import { AppConfig, HidDeviceConfig, SwaggerConfig } from '@config/contracts'; // MongoDBConfig
import { CONFIG_KEY } from '@config/core';

import { getAppConfig } from './app.config';
import { getFingerprintConfig, FingerprintConfig } from './fingerprint.config';
import { getHidDeviceConfig } from './hid-config';
// import { getMongoDBConfig } from './mongo.config';
import { getMqttConfig, MqttConfig } from './mqtt.config';
import { getSerialportConfig } from './serial-port.config';
import { getSwaggerConfig } from './swagger.config';
import { getTcpConfig } from './tcp.config';

interface IConfiguration {
  [CONFIG_KEY.APP]: AppConfig;
  [CONFIG_KEY.SWAGGER]: SwaggerConfig;
  // [CONFIG_KEY.MONGO]: MongoDBConfig;
  [CONFIG_KEY.MQTT]: MqttConfig;
  [CONFIG_KEY.FINGERPRINT]: FingerprintConfig;
  [CONFIG_KEY.HID]: HidDeviceConfig;
  [CONFIG_KEY.SERIALPORT]: any;
  [CONFIG_KEY.TCP]: any;
}

export const configs = (): IConfiguration => ({
  [CONFIG_KEY.APP]: getAppConfig(),
  [CONFIG_KEY.SWAGGER]: getSwaggerConfig(),
  // [CONFIG_KEY.MONGO]: getMongoDBConfig(),
  [CONFIG_KEY.MQTT]: getMqttConfig(),
  [CONFIG_KEY.FINGERPRINT]: getFingerprintConfig(),
  [CONFIG_KEY.HID]: getHidDeviceConfig(),
  [CONFIG_KEY.SERIALPORT]: getSerialportConfig(),
  [CONFIG_KEY.TCP]: getTcpConfig(),
});
