export function createGenealogy(userId: string, genealogy?: string): string {
  return genealogy ? `${genealogy}${userId}-` : `-${userId}-`;
}

export function isAncestor(userId: string, genealogy?: string): boolean {
  if (!genealogy) {
    return false;
  }
  return new RegExp(`-${userId}-`).test(genealogy);
}
