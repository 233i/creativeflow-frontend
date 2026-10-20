// 验证到 CreativeFlowHub 的真实 WebSocket 连接和设备分组绑定。
// 运行方式：node scripts/verify-realtime.mjs
import * as signalR from "@microsoft/signalr";

const API = process.env.SOL_API ?? "http://localhost:5298";
const EMAIL = process.env.SOL_VERIFY_EMAIL;
const PASSWORD = process.env.SOL_VERIFY_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error(
    "Set SOL_VERIFY_EMAIL and SOL_VERIFY_PASSWORD to a disposable CreativeFlow test account.",
  );
}

const stable = {
  timeZone: "Asia/Shanghai",
  platform: "MacIntel",
  hardwareConcurrency: 8,
  deviceMemoryGb: 8,
  screen: { w: 1512, h: 982, colorDepth: 24, dpr: 2 },
  gpu: { vendor: "Apple", renderer: "Apple M1 Pro" },
  primaryLanguage: "zh",
};

// 1. 先登录，再携带账户会话执行握手。设备 Cookie 本身不是应用凭据。
const login = await fetch(`${API}/api/v1/auth/password/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) throw new Error(`login failed: ${login.status}`);

const sessionCookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const handshake = await fetch(`${API}/api/v1/device/handshake`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: sessionCookie },
  body: JSON.stringify({
    v: 1,
    stable,
    volatile: { userAgent: "node-verify", canvasHash: "node-canvas" },
    clientStoredId: null,
  }),
});
if (!handshake.ok) throw new Error(`handshake failed: ${handshake.status}`);

const identity = await handshake.json();
const deviceCookie = handshake.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const cookie = `${sessionCookie}; ${deviceCookie}`;
console.log("handshake:", identity.deviceId.slice(0, 8), identity.method, identity.confidence);

// 2. 通过 WebSocket 连接并提供 Cookie，使 Hub 可以绑定连接。
const connection = new signalR.HubConnectionBuilder()
  .withUrl(`${API}/hubs/creativeflow`, {
    transport: signalR.HttpTransportType.WebSockets,
    skipNegotiation: false,
    headers: { Cookie: cookie },
  })
  .build();

const received = [];
connection.on("ReceiveMessage", (envelope) => received.push(envelope));

await connection.start();
console.log("connected:", connection.connectionId?.slice(0, 12), "state:", connection.state);

// 3. 往返调用一个 Hub 方法，证明 JSON 协议可配合源生成元数据工作。
const pong = await connection.invoke("Ping");
console.log("Ping ->", pong);

await new Promise((r) => setTimeout(r, 500));
await connection.stop();
console.log("disconnected cleanly; messages received:", received.length);

if (pong !== "pong") {
  console.error("FAIL: unexpected Ping response");
  process.exit(1);
}
console.log("OK");
