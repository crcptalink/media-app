import { APP_NAME } from "@/lib/brand";

/**
 * CRC roundel (letters CRC inside the black circle).
 * Source of the mark: https://crcchurch.com
 */
export function BrandLogo({ className = "h-8", alt = APP_NAME }: { className?: string; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <span className={`inline-flex items-center justify-center rounded-full border-2 border-black bg-white p-0.5 ${className}`}>
      <img src="/crc-mark.png" alt={alt} width={512} height={512} className="aspect-square h-full w-auto rounded-full" />
    </span>
  );
}
