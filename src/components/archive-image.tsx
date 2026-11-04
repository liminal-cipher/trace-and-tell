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
  revision,
  zoom = false,
}: {
  assetId: string;
  title: string;
  className?: string;
  revision?: number;
  zoom?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const source = `/api/archive/assets/${assetId}/file${revision ? `?revision=${revision}` : ""}`;
  return (
    <>
      {failed && (
        <p className="error">
          The original could not be loaded. Refresh records or sign in again.
        </p>
      )}
      <img
        className={className}
        src={source}
        alt={title}
        loading="lazy"
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
      {zoom && <a href={source} target="_blank" rel="noopener noreferrer">Open full original{revision ? ` · revision ${revision}` : ""} (new tab)</a>}
    </>
  );
}
