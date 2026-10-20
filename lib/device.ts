/**
 * 设备身份握手。
 *
 * 与服务器一致的两层机制：
 *  - 服务器设置 JavaScript 无法读取的 HttpOnly Cookie；
 *  - 响应正文重复返回设备标识，以便同步到 localStorage，并在 Cookie 被清除后重新使用。
 *
 * 信号分为 `stable`（硬件或操作系统属性，可能跨浏览器匹配）和 `volatile`
 * （依赖浏览器，熵高但无法跨浏览器使用）。所有字段均可选；强化隐私保护的浏览器会隐藏部分信号，
 * 服务器会规范化缺失项，而不是拒绝请求。
 */

const STORAGE_KEY = "sol.device_id";

export interface DeviceIdentity {
  deviceId: string;
  visitorId: string;
  isNewDevice: boolean;
  /** Cookie 匹配为 1.0，localStorage 恢复为 0.95，跨浏览器推测为 0.6。 */
  confidence: number;
  method: "Deterministic" | "ProbabilisticCoarse" | "Manual";
}

function collectStable() {
  const nav = navigator as Navigator & { deviceMemory?: number };

  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    platform: nav.platform ?? null,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemoryGb: nav.deviceMemory ?? null,
    screen: {
      w: window.screen?.width ?? null,
      h: window.screen?.height ?? null,
      colorDepth: window.screen?.colorDepth ?? null,
      dpr: window.devicePixelRatio ?? null,
    },
    gpu: readGpu(),
    primaryLanguage: navigator.language ?? null,
  };
}

function collectVolatile() {
  return {
    userAgent: navigator.userAgent ?? null,
    languages: navigator.languages ? [...navigator.languages] : null,
    canvasHash: null,
    audioHash: null,
    fontsHash: null,
  };
}

/**
 * WEBGL_debug_renderer_info 是最有用的单项硬件信号，但正在逐步退出；
 * Firefox 正在弃用它，Safari 也对其加以限制。缺失应视为正常情况。
 */
function readGpu(): { vendor: string | null; renderer: string | null } {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) return { vendor: null, renderer: null };

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return { vendor: null, renderer: null };

    return {
      vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) ?? null,
      renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? null,
    };
  } catch {
    return { vendor: null, renderer: null };
  }
}

/**
 * 解析此浏览器的身份。操作具有幂等性，可在每次页面加载时安全调用；
 * 已持有 Cookie 的调用方无需任何指纹识别即可被认出。
 */
export async function handshake(): Promise<DeviceIdentity> {
  const response = await fetch("/api/v1/device/handshake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 即使通过重写代理同源访问，也必须设置此项才能发送并存储 Cookie。
    credentials: "include",
    body: JSON.stringify({
      v: 1,
      stable: collectStable(),
      volatile: collectVolatile(),
      clientStoredId: localStorage.getItem(STORAGE_KEY),
    }),
  });

  if (!response.ok) {
    throw new Error(`Device handshake failed: ${response.status}`);
  }

  const identity: DeviceIdentity = await response.json();

  // Cookie 为 HttpOnly，因此此镜像是 JavaScript 唯一可读取的副本，
  // 也是 Cookie 被清除后恢复身份的唯一方式。
  localStorage.setItem(STORAGE_KEY, identity.deviceId);

  return identity;
}

/** 无需联系服务器即可读取镜像标识。 */
export function storedDeviceId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
