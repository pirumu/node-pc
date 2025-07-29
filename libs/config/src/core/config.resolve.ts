export function resolve<T>(
  target: string,
  parser: (value: unknown) => T,
  options?: {
    require?: boolean;
    default?: T;
  },
): T {
  const rawValue = process.env[target];

  if (rawValue === undefined || rawValue === '') {
    if (options?.require) {
      throw new Error(`Missing required environment variable: ${target}`);
    }

    if (options?.default !== undefined) {
      return options.default;
    }

    return undefined as unknown as T;
  }

  try {
    return parser(rawValue);
  } catch (err) {
    const ex = err as Error;
    throw new Error(`Failed to parse environment variable "${target}": ${ex.message}`);
  }
}
