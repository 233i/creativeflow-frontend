import type { NextConfig } from "next";

const API_ORIGIN = process.env.SOL_API_ORIGIN ?? "http://localhost:5298";

const nextConfig: NextConfig = {
  // 为 Docker 镜像生成自包含服务器包（.next/standalone），
  // 使运行阶段无需复制 node_modules 或完整源码树。
  output: "standalone",

  // 此仓库可能与拥有各自锁文件的其他项目相邻。将 Turbopack 文件系统边界固定在此处，
  // 不让它推断父级工作区。
  turbopack: {
    root: process.cwd(),
  },

  // 仅开发环境的覆盖徽章位于角落，而画布四角都有用途：顶部工具栏、左下缩放控件、右下小地图。
  // 它曾遮挡缩放控件。此设置仅影响开发环境，不改变生产构建。
  devIndicators: false,

  experimental: {
    // 重写代理默认套接字超时为 30 秒，而且是*空闲*超时：模型渲染期间图片生成不会在线路上传输内容，
    // 因此超过 30 秒的运行会被销毁套接字。随后 API 会看到客户端断开，触发 RequestAborted，
    // 上游调用以 TaskCanceledException 终止；这种取消看似超时，但源自此处而非供应商。
    //
    // 二十分钟与 Ai:RequestTimeoutSeconds 一致，使结果由供应商调用决定，
    // 而不是由前置代理决定。
    proxyTimeout: 20 * 60 * 1000,
  },

  // 通过此源代理 API，使浏览器始终只看到 localhost:3000。
  //
  // 若无此代理，设备 Cookie 会成为第三方 Cookie：SameSite=Lax 不会跨源发送，
  // SameSite=None 又要求 Secure，而开发环境的纯 HTTP 会拒绝安全 Cookie。
  // 生产环境应将两者置于同一反向代理源之后，并移除此设置。
  //
  // 注意：Next.js 可可靠代理 HTTP，但不能保证通过重写完成 WebSocket 升级。
  // 若开发环境中 /hubs 行为异常，可让 SignalR 客户端直接指向 SOL_API_ORIGIN，
  // 或回退到服务器发送事件和长轮询。
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
      { source: "/hubs/:path*", destination: `${API_ORIGIN}/hubs/:path*` },
    ];
  },
};

export default nextConfig;
