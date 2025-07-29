import { AppConfig, MongoDBConfig, SwaggerConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';

import { getAppConfig } from './app.config';
import { getAuthConfig, AuthConfig } from './auth.config';
import { FingerprintConfig, getFingerprintConfig } from './fingerprint.config';
import { getMongoDBConfig } from './mongo.config';
import { getMqttConfig, MqttConfig } from './mqtt.config';
import { getSwaggerConfig } from './swagger.config';

interface IConfiguration {
  [CONFIG_KEY.APP]: AppConfig;
  [CONFIG_KEY.SWAGGER]: SwaggerConfig;
  [CONFIG_KEY.MONGO]: MongoDBConfig;
  // [CONFIG_KEY.CACHE]: ICacheConfig;
  [CONFIG_KEY.AUTH]: AuthConfig;
  [CONFIG_KEY.MQTT]: MqttConfig;
  [CONFIG_KEY.FINGERPRINT]: FingerprintConfig;
}

export const configs = (): IConfiguration => ({
  [CONFIG_KEY.APP]: getAppConfig(),
  [CONFIG_KEY.SWAGGER]: getSwaggerConfig(),
  [CONFIG_KEY.MONGO]: getMongoDBConfig(),
  // [CONFIG_KEY.CACHE]: getCacheConfig(),
  [CONFIG_KEY.AUTH]: getAuthConfig(),
  [CONFIG_KEY.MQTT]: getMqttConfig(),
  [CONFIG_KEY.FINGERPRINT]: getFingerprintConfig(),
});
