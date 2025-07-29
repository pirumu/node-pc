export function isNetworkError(error: any): boolean {
  return (
    error.name === 'MongoNetworkError' ||
    error.name === 'MongoTimeoutError' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNABORTED'
  );
}
