# 前端部署

前端和后端需要分别构建。本文的服务器示例为 **Linux 单机**：
后端监听 `127.0.0.1:5298`，前端监听 `127.0.0.1:3000`，Nginx 提供 HTTPS。
其他拓扑需要替换内部地址，不能把容器内的 `localhost` 误当成宿主机。

## 1. 配置构建环境

```bash
cp .env.production.example .env.production.local
```

修改为自己的地址，保留已有配置时不要重复覆盖：

```dotenv
API_BASE_URL=http://127.0.0.1:5298
SOL_API_ORIGIN=http://127.0.0.1:5298
NEXT_PUBLIC_SITE_URL=https://creativeflow.example.com
```

`.env.production.example` 不会自动加载。
生产时进程环境和 `.env.production.local` 优先于 `.env.local`；不要把本机 `.env.local`
带入发布。`SOL_API_ORIGIN` 的 rewrite、`NEXT_PUBLIC_*` 值需要在**构建时**提供，
只在启动时改值不能重写已构建的客户端和路由。
配置不包含模型 Key，所有 `NEXT_PUBLIC_*` 都应视为公开。

## 2. 选择一种运行方式

### Node standalone

使用 `.node-version` 指定的 Node：

```bash
npm ci
npm run build
cp -R public .next/standalone/
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/
HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js
```

项目使用 `output: "standalone"`；常规部署运行 `server.js`，不要只复制 `.next`
却漏掉 `public` 和静态资源。停止之前的开发/生产实例后再占用同一端口。
正式服务使用进程管理器或容器自动重启，不依赖 SSH 终端保持连接。

`npm start` 对应 `next start`，当前浏览器测试配置仍使用它，standalone 模式可能给出警告；
这不是本文推荐的发布入口。

### Docker

仓库 Dockerfile 用 Bun 和 `bun.lock` 构建，不读取私有 `.env`。
Linux 同机部署可以显式传参并使用 host 网络：

```bash
docker build \
  --build-arg API_BASE_URL=http://127.0.0.1:5298 \
  --build-arg SOL_API_ORIGIN=http://127.0.0.1:5298 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://creativeflow.example.com \
  -t creativeflow/web:release .

docker run -d --name creativeflow-web --restart unless-stopped \
  --network host \
  -e HOSTNAME=127.0.0.1 -e PORT=3000 \
  -e API_BASE_URL=http://127.0.0.1:5298 \
  -e NEXT_PUBLIC_SITE_URL=https://creativeflow.example.com \
  creativeflow/web:release
```

用实际提交对应的固定标签或 digest 替换 `release`；示例要求容器名尚未占用。
升级时按受控流程替换原容器，保留旧镜像以便前端回滚。
Docker Desktop 或 bridge 网络需另行设计地址和端口映射，不能直接复制 `--network host`。

## 3. 同源反向代理

后端 `Authentication__PublicOrigin` 设置为浏览器的 HTTPS 地址。
Nginx 示例放在其 `http` 配置上下文；域名、证书文件和内部端口必须替换为自己的值：

```nginx
map $http_upgrade $creativeflow_connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    server_name creativeflow.example.com;
    ssl_certificate     /etc/nginx/certs/creativeflow.fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/creativeflow.key;

    # 按实际文件需求设置，同时保留后端本身的文件大小校验。
    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:5298;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1200s;
    }

    location /hubs/ {
        proxy_pass http://127.0.0.1:5298;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $creativeflow_connection_upgrade;
        proxy_buffering off;
        proxy_read_timeout 1200s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

该例不公开后端 `/health` 和 `/swagger`，运维直接访问私网后端。
证书签发、HTTP 到 HTTPS 跳转及服务器防火墙由部署者设置。
检查 `nginx -t` 成功后再重载；不要用 `curl -k` 或关闭鉴权掩盖配置错误。

## 4. 发布验收

- 前端页面及 `/_next/static/*`、`/examples/workflow-agui.mjs` 可读取。
- `/api/v1/system/info` 来自预期后端；管理员和普通用户均能正确登录。
- 无模型回显工作流、素材上传/下载及刷新持久化通过。
- SignalR 建连并可恢复；外部 SSE/AG-UI 在运行完成前增量到达，而不是被代理集中缓冲。
- 普通用户不能修改管理配置，API Key 不能读取其他 Key 的运行。

公网验收必须使用合成数据；不得把浏览器测试套件指向 Production。
本机验证生产前端时，可使用 HTTP，但后端保持 Development。
测试门禁与已知限制见[维护说明](frontend-maintenance.md)，后端发布见
[后端部署指南](https://github.com/233i/creativeflow-backend/blob/main/docs/deployment.md)。
