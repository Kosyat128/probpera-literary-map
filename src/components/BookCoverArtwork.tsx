import { useEffect, useState, type ReactNode } from "react";

/** Keep the canonical text fallback usable when an otherwise permitted image
 * is absent offline or fails to load. This never invents edition artwork. */
export default function BookCoverArtwork({ className, src, srcSet, sizes, alt, loading, children }: {
  className: string;
  src?: string;
  srcSet?: string;
  sizes: string;
  alt: string;
  loading?: "lazy" | "eager";
  children: ReactNode;
}) {
  const identity = JSON.stringify([src, srcSet]);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const available = Boolean(src) && failedImage !== identity;
  useEffect(() => {
    if (failedImage !== identity) return;
    const retry = () => setFailedImage(null);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failedImage, identity]);
  return <div className={`${className}${available ? " has-image" : ""}`}>
    {available ? <img src={src} srcSet={srcSet} sizes={sizes} alt={alt}
      loading={loading} decoding="async" onError={() => setFailedImage(identity)} /> : children}
  </div>;
}
