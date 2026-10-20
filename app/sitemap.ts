import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// "" 对应画布，也就是整个应用。其内容按设备限定作用域，没有所有者 Cookie 便无法访问，
// 因此没有更深层内容值得列入站点地图。
const ROUTES = [""];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${env.NEXT_PUBLIC_SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
