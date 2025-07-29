export function getBearToken(token?: string): string | null {
  if (!token) {
    return null;
  }
  return token.replace('Bearer ', '');
}
