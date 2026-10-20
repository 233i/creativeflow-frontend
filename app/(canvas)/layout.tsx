/**
 * 画布使用全出血外壳。没有页眉、页脚和最大宽度；图编辑器占据整个视口并管理自己的浮动面板。
 *
 * `overflow-hidden` 很重要：画布通过变换超大子元素实现平移；若无此设置，页面本身会滚动。
 */
export default function CanvasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="h-dvh w-dvw overflow-hidden">{children}</div>;
}
