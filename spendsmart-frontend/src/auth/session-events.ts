type SessionExpiredHandler = () => Promise<void>;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function registerSessionExpiredHandler(handler: SessionExpiredHandler) {
  sessionExpiredHandler = handler;

  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

export async function notifySessionExpired() {
  await sessionExpiredHandler?.();
}
