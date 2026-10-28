"use client";
/* eslint-disable @next/next/no-img-element -- Authenticated originals must bypass the image optimiser. */
import { useEffect, useRef, useState } from "react";
export function UploadPreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <figure className="upload-preview">
      <img ref={image} alt={`Local preview of ${file.name}`} />
      <figcaption>Local preview · not saved</figcaption>
    </figure>
  );
}
export function PrivateImage({
  assetId,
  title,
  className,
}: {
  assetId: string;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      {failed && (
        <p className="error">
          The original could not be loaded. Refresh records or sign in again.
        </p>
      )}
      <img
        className={className}
        src={`/api/archive/assets/${assetId}/file`}
        alt={title}
        loading="lazy"
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
    </>
  );
}
