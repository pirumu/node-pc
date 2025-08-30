import { resolve } from '@config/core';
import { MqttOptions } from '@nestjs/microservices';

export type MqttConfig = { publisher: Required<MqttOptions>['options']; consumer: Required<MqttOptions>['options'] };

export const getMqttConfig = (): MqttConfig => {
  return {
    publisher: {
      url: resolve('MQTT_URI', String, { default: 'mqtt://127.0.0.1:1883' }),
      protocolVersion: resolve('MQTT_PROTOCOL_VERSION', Number, { default: 5 }),
      username: resolve('MQTT_USERNAME', String, { default: '' }),
      password: resolve('MQTT_PASSWORD', String, { default: '' }),
      clientId: resolve('MQTT_PUBLISHER_ID', String, { default: 'mqtt-process-worker-publisher' }),
    },
    consumer: {
      url: resolve('MQTT_URI', String, { default: 'mqtt://127.0.0.1:1883' }),
      protocolVersion: resolve('MQTT_PROTOCOL_VERSION', Number, { default: 5 }),
      username: resolve('MQTT_USERNAME', String, { default: '' }),
      password: resolve('MQTT_PASSWORD', String, { default: '' }),
      clientId: resolve('MQTT_CONSUMER_ID', String, { default: 'mqtt-process-worker-consumer' }),
    },
  };
};
