import Image from "next/image";

export default function BrandLogo({ size = 56 }: { size?: number }) {
  return <Image src="/mahdi/brand/logo-v3.png" alt="لأجل المهدي" width={size} height={size} unoptimized style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />;
}
