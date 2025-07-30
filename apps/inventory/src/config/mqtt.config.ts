import { MqttOptions } from '@nestjs/microservices';

export type MqttConfig = Required<MqttOptions>['options'];

export const getMqttConfig = (): MqttConfig => {
  return {
    url: '',
    protocolVersion: 5,
    username: '',
    password: '',
    clientId: 'mqtt-inventory-client',
  };
};
