let fallbackCounter = 0;

/**
 * 在具有或不具有安全上下文的浏览器中生成标识。
 *
 * 并非所有浏览器都会在纯 HTTP 源上公开 `crypto.randomUUID`。画布标识是客户端本地标识，
 * 因此原生 UUID 生成器不可用时，时间戳加进程内计数器已经足够。
 */
export function newClientId(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  fallbackCounter += 1;
  return `n${Date.now().toString(36)}-${fallbackCounter}`;
}
