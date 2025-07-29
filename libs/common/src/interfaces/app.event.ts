export interface IAppEvent {
  getChannel(...args: any[]): string;
  getPayload(...args: any[]): any;
}
