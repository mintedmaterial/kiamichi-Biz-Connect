const EXPECTED_DISCONNECT_PATTERNS = [
  /websocket:close/i,
  /responseStreamDisconnected/i,
  /^canceled$/i,
  /Durable Object reset because its code was updated/i,
  /response stream disconnected/i,
  /client disconnect/i,
  /stream.*cancel/i,
];

function matchesExpectedDisconnect(value: unknown): boolean {
  if (typeof value === "string") {
    return EXPECTED_DISCONNECT_PATTERNS.some((pattern) => pattern.test(value));
  }

  if (value instanceof Error) {
    const text = `${value.name} ${value.message}`;
    return EXPECTED_DISCONNECT_PATTERNS.some((pattern) => pattern.test(text));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.values(record).some((entry) => matchesExpectedDisconnect(entry));
  }

  return false;
}

export function installExpectedDisconnectLogging(): void {
  const globalState = globalThis as typeof globalThis & {
    __kbcExpectedDisconnectLoggingInstalled?: boolean;
  };

  if (globalState.__kbcExpectedDisconnectLoggingInstalled) return;

  const originalError = console.error.bind(console);
  const originalInfo = console.info.bind(console);

  globalState.__kbcExpectedDisconnectLoggingInstalled = true;

  console.error = (...args: unknown[]) => {
    if (args.some((arg) => matchesExpectedDisconnect(arg))) {
      originalInfo("[Expected disconnect]", ...args);
      return;
    }

    originalError(...args);
  };
}

export function isExpectedWebSocketClose(
  code?: number,
  reason?: string,
  wasClean?: boolean,
): boolean {
  const normalizedReason = reason || "";

  return Boolean(
    wasClean ||
      code === 1000 ||
      code === 1001 ||
      /updated|upgrade|reset|restart|deploy|hibernat/i.test(normalizedReason),
  );
}

export function logWebSocketClose(
  scope: string,
  details: { code?: number; reason?: string; wasClean?: boolean; extra?: Record<string, unknown> } = {},
): void {
  const { code, reason, wasClean, extra } = details;
  const payload = {
    code: code ?? null,
    reason: reason || "",
    wasClean: wasClean ?? null,
    ...(extra || {}),
  };

  if (isExpectedWebSocketClose(code, reason, wasClean)) {
    console.info(`[${scope}] WebSocket closed`, payload);
    return;
  }

  console.warn(`[${scope}] Abnormal WebSocket close`, payload);
}

export function logExpectedDisconnect(scope: string, message: string, extra?: Record<string, unknown>): void {
  console.info(`[${scope}] ${message}`, extra || {});
}
