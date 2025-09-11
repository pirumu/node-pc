import { resolve } from '@config/core';
import { MqttOptions } from '@nestjs/microservices';

export type MqttConfig = { publisher: Required<MqttOptions>['options']; consumer: Required<MqttOptions>['options'] };

export const getMqttConfig = (): MqttConfig => {
  return {
    publisher: {
      url: resolve('MQTT_PUBLISHER_URI', String, { default: 'mqtt://127.0.0.1:1883' }),
      protocolVersion: resolve('MQTT_PUBLISHER_PROTOCOL_VERSION', Number, { default: 5 }),
      username: resolve('MQTT_PUBLISHER_USERNAME', String, { default: '' }),
      password: resolve('MQTT_PUBLISHER_PASSWORD', String, { default: '' }),
      clientId: resolve('MQTT_PUBLISHER_ID', String, { default: 'mqtt-hardware-bridge-publisher' }),
      subscribeOptions: {
        qos: resolve(
          'MQTT_PUBLISHER_QOS',
          (value): any => {
            const newValue = Number(value);
            if (newValue < 0 || newValue > 2) {
              throw new Error('Invalid QOS. Expect 0 | 1 | 2 ');
            }
            return newValue as 0 | 1 | 2;
          },
          { default: 0 },
        ),
      },
    },
    consumer: {
      url: resolve('MQTT_CONSUMER_URI', String, { default: 'mqtt://127.0.0.1:1883' }),
      protocolVersion: resolve('MQTT_CONSUMER_PROTOCOL_VERSION', Number, { default: 5 }),
      username: resolve('MQTT_CONSUMER_USERNAME', String, { default: '' }),
      password: resolve('MQTT_CONSUMER_PASSWORD', String, { default: '' }),
      clientId: resolve('MQTT_CONSUMER_ID', String, { default: 'mqtt-hardware-bridge-consumer' }),
    },
  };
};
