import { APP_NAME } from "@/lib/brand";

/**
 * Official CRC wordmark (white on transparent).
 * Source: https://crcchurch.com/_next/static/media/logo.0wuxmjuh~p2zn.webp
 * Put it on a black background so the white lockup stays visible.
 */
export function BrandLogo({ className = "h-8", alt = APP_NAME }: { className?: string; alt?: string }) {
  // Plain img: the file is already small, and the image optimizer is extra memory on the church PC.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/crc-logo.png" alt={alt} width={304} height={116} className={`${className} w-auto`} />
  );
}
