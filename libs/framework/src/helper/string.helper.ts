export function bufferFromBufferString(bufferStr: string): Buffer {
  const hexValues = bufferStr
    .replace(/[<>]/g, '')
    .split(' ')
    .slice(1)
    .map((val) => parseInt(val, 16));

  return Buffer.from(hexValues);
}
