import Image from "next/image";
import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand-link" href={href} aria-label="Скинуться">
      <Image src="/logo.svg" width={38} height={38} alt="" priority />
      <span>Скинуться</span>
    </Link>
  );
}
