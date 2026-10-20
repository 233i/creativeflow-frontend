/** 创建测试账号之前，分别确认直连 API 与前端构建时冻结的代理目标。 */
export async function verifyBrowserEnvironment({
  baseURL,
  apiOrigin,
  environment,
  fetcher = fetch,
}) {
  if (!["Development", "MigrationBaseline", "Testing"].includes(environment))
    throw new Error("Browser checks require Development, MigrationBaseline, or Testing.");
  for (const [label, value] of [
    ["API", apiOrigin],
    ["Web proxy", baseURL],
  ]) {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error(`${label} must be an HTTP origin without credentials, path, or query.`);
    const response = await fetcher(new URL("/api/v1/system/info", url), {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`${label} preflight failed (${response.status}).`);
    const info = await response.json();
    if (info.service !== "creativeflow-api" || info.environment !== environment)
      throw new Error(`${label} does not target the expected ${environment} test API.`);
  }
}
