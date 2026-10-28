import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateImage } from "@/lib/image-validation";
import { MAX_BYTES, commandSchema } from "@/lib/contracts";
describe("server image verification", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "fully decodes %s and hashes the original bytes",
    async (format) => {
      const bytes = await sharp({
        create: { width: 16, height: 12, channels: 3, background: "#416873" },
      })
        .toFormat(format)
        .toBuffer();
      const result = await validateImage(
        bytes,
        bytes.length,
        `image/${format}`,
      );
      expect(result).toMatchObject({
        width: 16,
        height: 12,
        size: bytes.length,
      });
      expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(
        (await validateImage(bytes, bytes.length, `image/${format}`)).sha256,
      ).toBe(result.sha256);
    },
  );
  it("rejects forged content types, corrupted bodies and mismatched sizes", async () => {
    const bytes = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(
      validateImage(bytes, bytes.length, "image/jpeg"),
    ).rejects.toThrow();
    const truncated = bytes.subarray(0, Math.floor(bytes.length / 2));
    await expect(
      validateImage(truncated, truncated.length, "image/png"),
    ).rejects.toThrow();
    await expect(
      validateImage(bytes, bytes.length + 1, "image/png"),
    ).rejects.toThrow();
    await expect(
      validateImage(Buffer.from("<script>alert(1)</script>"), 25, "image/png"),
    ).rejects.toThrow();
  });
  it("rejects oversized and decompression-bomb images", async () => {
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    await expect(
      validateImage(bytes, bytes.length, "image/png"),
    ).rejects.toThrow();
    const huge = await sharp({
      create: { width: 5001, height: 5001, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      validateImage(huge, huge.length, "image/png"),
    ).rejects.toThrow();
  });
  it("validates metadata and rejects client-injected privileged operations", () => {
    expect(
      commandSchema.safeParse({
        action: "reject_upload",
        key: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        action: "create_upload",
        key: crypto.randomUUID(),
        workspace_id: crypto.randomUUID(),
        metadata: { title: "A photo" },
        size: MAX_BYTES + 1,
        content_type: "image/png",
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        action: "save_note",
        key: crypto.randomUUID(),
        workspace_id: crypto.randomUUID(),
        metadata: { title: "기록" },
        content: "원문 보존",
      }).success,
    ).toBe(true);
  });
});
