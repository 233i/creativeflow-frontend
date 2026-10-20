/** 主命中与同文档相邻片段共用交付数量上限，与服务端知识端口契约保持一致。 */
export const DEFAULT_CONTEXT_CHUNKS = 8;
export const MAX_CONTEXT_CHUNKS = 32;

export function validChunkCount(value: number | undefined): boolean {
  return (
    value !== undefined && Number.isInteger(value) && value >= 1 && value <= MAX_CONTEXT_CHUNKS
  );
}
