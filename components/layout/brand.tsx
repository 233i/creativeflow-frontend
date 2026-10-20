import Image from "next/image";
import { cn } from "@/lib/utils";

/** 品牌只负责展示，不携带导航或账号状态，画布与后台共用。 */
export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
      <Image
        src="/favicon.png"
        alt={compact ? "CreativeFlow" : ""}
        width={28}
        height={28}
        priority
      />
      {!compact && <span className="text-sm font-semibold tracking-tight">CreativeFlow</span>}
    </span>
  );
}
