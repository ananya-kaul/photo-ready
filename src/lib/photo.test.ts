import { describe, expect, it } from "vitest";
import { exportCompressedJpeg, PHOTO_HEIGHT, PHOTO_WIDTH, validatePhoto } from "./photo";
import { createHmac } from "node:crypto";
import { validSignature } from "../app/api/payment/verify/route";

describe("photo preparation constraints", () => {
  it("targets 413 × 531 pixels", () => { expect([PHOTO_WIDTH, PHOTO_HEIGHT]).toEqual([413, 531]); });
  it("rejects unsupported formats and files over 12 MB", () => {
    expect(validatePhoto(new File(["x"], "photo.gif", { type: "image/gif" }))).toContain("JPG, PNG or WebP");
    expect(validatePhoto(new File([new Uint8Array(12 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" }))).toContain("12 MB");
  });
  it("accepts supported image formats", () => {
    expect(validatePhoto(new File(["image"], "selfie.webp", { type: "image/webp" }))).toBeNull();
  });
  it("keeps reducing quality until the JPEG is below 50 KB", async () => {
    const qualities: number[] = [];
    const canvas = { toBlob(callback: BlobCallback, _type?: string, quality?: number) {
      qualities.push(quality ?? 1);
      const bytes = jpeg(quality && quality > 0.65 ? 60_000 : 45_000);
      callback(new Blob([bytes.buffer as ArrayBuffer], { type: "image/jpeg" }));
    } } as HTMLCanvasElement;
    const output = await exportCompressedJpeg(canvas);
    expect(output.size).toBeLessThanOrEqual(50 * 1024);
    expect(qualities.length).toBeGreaterThan(1);
    const bytes = new Uint8Array(await output.arrayBuffer());
    expect(bytes[13]).toBe(1); // JFIF density units: dots per inch
    expect((bytes[14] << 8) + bytes[15]).toBe(300);
    expect((bytes[16] << 8) + bytes[17]).toBe(300);
  });
  it("fails clearly if output cannot meet the size limit", async () => {
    const canvas = { toBlob(callback: BlobCallback) { callback(new Blob([jpeg(55_000).buffer as ArrayBuffer])); } } as HTMLCanvasElement;
    await expect(exportCompressedJpeg(canvas)).rejects.toThrow("below 50 KB");
  });
});

function jpeg(size: number): Uint8Array {
  const bytes = new Uint8Array(size); bytes.set([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,1,1,0,0,1,0,1,0,0]);
  bytes[bytes.length - 2] = 0xff; bytes[bytes.length - 1] = 0xd9; return bytes;
}

describe("Razorpay signature verification", () => {
  it("accepts a matching HMAC and rejects a modified signature", () => {
    const orderId = "order_123"; const paymentId = "pay_456"; const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    expect(validSignature(orderId, paymentId, signature, secret)).toBe(true);
    expect(validSignature(orderId, paymentId, `${signature.slice(0, -1)}0`, secret)).toBe(false);
  });
});
