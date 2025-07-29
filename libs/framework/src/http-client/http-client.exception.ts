export class HttpClientException extends Error {
  constructor(message: string, cause: Error['cause'], stack?: Error['stack']) {
    super(message);
    this.name = HttpClientException.name;
    this.cause = cause;
    this.stack = stack;
  }
}
