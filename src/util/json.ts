export function stringifyIfNotString(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
