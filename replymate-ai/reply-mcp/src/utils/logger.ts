export function info(message: string, meta?: Record<string, unknown>): void {
  console.log(format("info", message, meta));
}

export function warn(message: string, meta?: Record<string, unknown>): void {
  console.warn(format("warn", message, meta));
}

export function error(message: string, meta?: Record<string, unknown>): void {
  console.error(format("error", message, meta));
}

function format(level: string, message: string, meta?: Record<string, unknown>): string {
  return meta ? `[${level}] ${message} ${JSON.stringify(meta)}` : `[${level}] ${message}`;
}

