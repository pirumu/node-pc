import { AppConfig, MongoDBConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';

import { getAppConfig } from './app.config';
import { getMongoDBConfig } from './mongo.config';
import { getMqttConfig, MqttConfig } from './mqtt.config';
import { getTcpConfig, TcpConfig } from './tcp.config';

interface IConfiguration {
  [CONFIG_KEY.APP]: AppConfig;
  [CONFIG_KEY.MONGO]: MongoDBConfig;
  [CONFIG_KEY.MQTT]: MqttConfig;
  [CONFIG_KEY.TCP]: TcpConfig;
}

export const configs = (): IConfiguration => ({
  [CONFIG_KEY.APP]: getAppConfig(),
  [CONFIG_KEY.MONGO]: getMongoDBConfig(),
  [CONFIG_KEY.MQTT]: getMqttConfig(),
  [CONFIG_KEY.TCP]: getTcpConfig(),
});
