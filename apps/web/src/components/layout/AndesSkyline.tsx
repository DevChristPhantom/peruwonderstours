import Image from 'next/image';

/** Decorative, locally hosted artwork supplied by the client's previous site. */
export function AndesSkyline({ className }: { className?: string }) {
  return <Image
    src="/brand/andes-travelers.png"
    alt=""
    aria-hidden="true"
    width={1600}
    height={252}
    loading="lazy"
    unoptimized
    className={className}
  />;
}
