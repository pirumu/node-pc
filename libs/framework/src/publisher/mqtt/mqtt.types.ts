// MQTT specific options
import { MqttOptions } from '@nestjs/microservices';

export type MQTTPublishOptions = Required<MqttOptions>['options'];
