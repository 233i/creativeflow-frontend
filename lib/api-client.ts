interface ApiFailure {
  status: number;
  code: string | null;
  details: string[];
  fallbackMessage: string;
}

interface ApiClientOptions {
  baseUrl: string;
  createError: (failure: ApiFailure) => Error;
  networkErrorMessage?: string;
  statusErrorMessage?: (status: number) => string;
}

/**
 * 同源 JSON API 的公共传输层；各业务模块仍负责自己的错误类型和消息优先级。
 * 字符串正文按 JSON 发送，FormData 等正文由浏览器生成 Content-Type。
 */
export function createApiClient({
  baseUrl,
  createError,
  networkErrorMessage = "Failed to reach the API",
  statusErrorMessage = (status) => `Request failed with status ${status}`,
}: ApiClientOptions) {
  return async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (typeof init?.body === "string" && init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...init,
        credentials: "include",
        headers,
      });
    } catch {
      throw createError({
        status: 0,
        code: null,
        details: [],
        fallbackMessage: networkErrorMessage,
      });
    }

    if (response.status === 204) return undefined as T;
    if (!response.ok) {
      const { code, details } = await readErrorBody(response);
      throw createError({
        status: response.status,
        code,
        details,
        fallbackMessage: statusErrorMessage(response.status),
      });
    }

    return (await response.json()) as T;
  };
}

async function readErrorBody(response: Response): Promise<Pick<ApiFailure, "code" | "details">> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      const { error, details } = body as { error?: unknown; details?: unknown };
      return {
        code: typeof error === "string" ? error : null,
        details: Array.isArray(details)
          ? details.filter((detail): detail is string => typeof detail === "string")
          : [],
      };
    }
  } catch {
    // 代理可能返回 HTML 或空正文，保留业务模块按状态码生成的消息。
  }
  return { code: null, details: [] };
}
