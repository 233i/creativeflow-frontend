import "@testing-library/jest-dom";

// Node 26 未配置持久化文件时会公开值为未定义的实验性 `localStorage` 全局变量。
// Vitest 会将该描述符覆盖到 JSDOM 的可用实现上，因此为测试画布缓存的用例显式提供浏览器契约。
if (!window.localStorage) {
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorage,
  });
}
