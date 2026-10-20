export function isAccessDenied(reason: unknown): boolean {
  return (
    !!reason &&
    typeof reason === "object" &&
    "status" in reason &&
    [401, 403, 404].includes(Number(reason.status))
  );
}

export function mutationError(reason: unknown, fallback: string): string {
  const message = reason instanceof Error ? reason.message : fallback;
  const status =
    reason && typeof reason === "object" && "status" in reason ? Number(reason.status) : 0;
  return status >= 400 && status < 500
    ? message
    : `${message}。结果可能尚未确认，请先重新查询状态；不会自动重复提交。`;
}
