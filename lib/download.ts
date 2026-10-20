/** 下载 UTF-8 JSON，同时不离开当前页面。 */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  // 在部分浏览器中，同步撤销会取消下载。
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
