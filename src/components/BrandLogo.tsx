import { APP_NAME } from "@/lib/brand";

/**
 * CRC roundel only (the letters CRC inside the circle).
 * The full wordmark includes "Christian Revival Church", so the header uses this mark.
 * Source of the mark: https://crcchurch.com/favicon.ico
 */
export function BrandLogo({ className = "h-8", alt = APP_NAME }: { className?: string; alt?: string }) {
  // Plain img: the file is already small, and the image optimizer is extra memory on the church PC.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/crc-mark.png" alt={alt} width={512} height={512} className={`${className} aspect-square w-auto`} />
  );
}
