import { AppConfig } from '@config/contracts'; // MongoDBConfig
import { CONFIG_KEY } from '@config/core';

import { getAppConfig } from './app.config';
import { getMqttConfig, MqttConfig } from './mqtt.config';
import { getSerialportConfig } from './serial-port.config';
import { getTcpConfig, TcpConfig } from './tcp.config';

interface IConfiguration {
  [CONFIG_KEY.APP]: AppConfig;
  [CONFIG_KEY.MQTT]: MqttConfig;
  [CONFIG_KEY.SERIALPORT]: any;
  [CONFIG_KEY.TCP]: TcpConfig;
}

export const configs = (): IConfiguration => ({
  [CONFIG_KEY.APP]: getAppConfig(),
  [CONFIG_KEY.MQTT]: getMqttConfig(),
  [CONFIG_KEY.SERIALPORT]: getSerialportConfig(),
  [CONFIG_KEY.TCP]: getTcpConfig(),
});
