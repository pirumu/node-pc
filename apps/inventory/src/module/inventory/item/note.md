public async confirm(isNextRequestItem: boolean): Promise<boolean> {
await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.CONFIRM_PROCESS, { isCloseWarningPopup: true, isNextRequestItem });
return true;
}
