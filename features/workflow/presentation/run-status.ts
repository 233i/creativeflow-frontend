/** 把后端执行状态映射为管理界面文案。 */
export function statusLabel(status: string): string {
  return (
    (
      {
        queued: "排队中",
        pending: "等待中",
        running: "进行中",
        succeeded: "成功",
        failed: "失败",
        cancelled: "已取消",
        skipped: "已跳过",
      } as Record<string, string>
    )[status] ?? status
  );
}
