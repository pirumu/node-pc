import { Inject } from '@nestjs/common';

import { HTTP_PUBLISHER, MQTT_PUBLISHER, MULTI_PUBLISHER, TCP_PUBLISHER } from './publisher.constants';

export const InjectMQTTPublisher = () => Inject(MQTT_PUBLISHER);
export const InjectTCPPublisher = () => Inject(TCP_PUBLISHER);
export const InjectHTTPPublisher = () => Inject(HTTP_PUBLISHER);
export const InjectMultiPublisher = () => Inject(MULTI_PUBLISHER);
