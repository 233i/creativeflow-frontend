const key = ({ file, rule, message }) => JSON.stringify([file, rule, message]);

/** 例外精确到文件、函数诊断及出现次数；提高复杂度、增加函数和过期记录都会失败。 */
export function complexityViolations(findings, exceptions) {
  const actual = new Map();
  for (const finding of findings) {
    const id = key(finding);
    actual.set(id, (actual.get(id) ?? 0) + 1);
  }
  const failures = [];
  const seen = new Set();
  for (const exception of exceptions) {
    const id = key(exception);
    if (seen.has(id) || !exception.reason?.trim() || !exception.owner?.trim()) {
      failures.push(`${exception.file}: 例外重复，或缺少保留原因与后续归属。`);
    }
    seen.add(id);
    if (!Number.isInteger(exception.count) || exception.count < 1) {
      failures.push(`${exception.file}: 例外次数必须为正整数。`);
    } else if ((actual.get(id) ?? 0) < exception.count) {
      failures.push(`${exception.file}: 删除或收紧已过期的例外：${exception.message}`);
    } else if (actual.get(id) > exception.count) {
      failures.push(`${exception.file}: 超标函数数量增加：${exception.message}`);
    }
    actual.delete(id);
  }
  for (const id of actual.keys()) {
    const [file, , message] = JSON.parse(id);
    failures.push(`${file}: 新的复杂度问题：${message}`);
  }
  return failures;
}
