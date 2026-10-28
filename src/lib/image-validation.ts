import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { MAX_BYTES, mimeSchema } from "./contracts";
export class ImageValidationError extends Error {}
export async function validateImage(
  bytes: Buffer,
  expectedSize: number,
  expectedType: string,
) {
  if (
    !bytes.length ||
    bytes.length > MAX_BYTES ||
    bytes.length !== expectedSize
  )
    throw new ImageValidationError(
      "File size does not match the upload intent or exceeds 6 MiB.",
    );
  mimeSchema.parse(expectedType);
  try {
    const options = {
      limitInputPixels: 24_000_000,
      failOn: "warning" as const,
      animated: true,
    };
    const meta = await sharp(bytes, options).metadata();
    const types: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    if (
      types[meta.format ?? ""] !== expectedType ||
      !meta.width ||
      !meta.height ||
      (meta.pages ?? 1) !== 1
    )
      throw new Error("format");
    // Decode every pixel: header-only validation accepts truncated image data.
    await sharp(bytes, options).raw().toBuffer();
    return {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: meta.width,
      height: meta.height,
      content_type: expectedType,
      size: bytes.length,
    };
  } catch {
    throw new ImageValidationError(
      "The file is damaged, animated, too large in pixel dimensions, or does not match its JPEG, PNG or WebP type.",
    );
  }
}
