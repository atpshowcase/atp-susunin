export function createSequentialIdFactory(prefix: string) {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}
