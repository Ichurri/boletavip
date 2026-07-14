import Image from "next/image";
import { cn } from "@/lib/utils";

/** Üticket wordmark (brand v1.0): purple ü + "ticket". Theme-aware pair —
 * `logo-light` has dark-gray text for light mode, `logo-dark` the negative
 * (near-white) text for dark mode. Source asset: /public/brand/logo.png. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center", className)}>
      <Image
        src="/brand/logo-light.png"
        alt="Üticket"
        width={604}
        height={160}
        priority
        className="h-8 w-auto dark:hidden"
      />
      <Image
        src="/brand/logo-dark.png"
        alt="Üticket"
        width={604}
        height={160}
        priority
        className="hidden h-8 w-auto dark:block"
      />
    </span>
  );
}
