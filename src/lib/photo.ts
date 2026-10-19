export const PHOTO_WIDTH = 413;
export const PHOTO_HEIGHT = 531;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export type PhotoResult = { url: string; sizeKB: string; width: number; height: number; backgroundRemoved: boolean };

export function validatePhoto(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPG, PNG or WebP image.";
  if (file.size > MAX_UPLOAD_BYTES) return "This photo is over 12 MB. Choose a smaller image.";
  if (file.size === 0) return "That file is empty. Choose another photo.";
  return null;
}

export async function setJpegDpi(blob: Blob, dpi = 300): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Could not create a valid JPEG.");
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes[offset + 2] * 256 + bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) break;
    if (marker === 0xe0 && length >= 16 && String.fromCharCode(...bytes.subarray(offset + 4, offset + 9)) === "JFIF\0") {
      bytes[offset + 11] = 1;
      bytes[offset + 12] = (dpi >> 8) & 255; bytes[offset + 13] = dpi & 255;
      bytes[offset + 14] = (dpi >> 8) & 255; bytes[offset + 15] = dpi & 255;
      return new Blob([bytes], { type: "image/jpeg" });
    }
    offset += 2 + length;
  }
  // Insert a standard JFIF density segment immediately after the start-of-image marker.
  const header = new Uint8Array([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, (dpi >> 8) & 255, dpi & 255, (dpi >> 8) & 255, dpi & 255, 0, 0]);
  return new Blob([bytes.subarray(0, 2), header, bytes.subarray(2)], { type: "image/jpeg" });
}

export async function exportCompressedJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  for (let quality = 0.92; quality >= 0.25; quality -= 0.07) {
    const raw = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (raw) {
      const blob = await setJpegDpi(raw, 300);
      if (blob.size <= 50 * 1024) return blob;
    }
  }
  throw new Error("This photo could not be compressed below 50 KB at acceptable quality. Try a simpler photo with less detail.");
}

export async function makePassportPhoto(file: File, removeBackground: boolean): Promise<PhotoResult> {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width < 240 || bitmap.height < 320) { bitmap.close(); throw new Error("This image is too small. Use a photo at least 240 × 320 pixels."); }
  if (bitmap.width > 8000 || bitmap.height > 8000) { bitmap.close(); throw new Error("This image is too large to process. Choose a smaller photo."); }
  let source: CanvasImageSource = bitmap;
  let backgroundRemoved = false;
  if (removeBackground) {
    try {
      const { removeBackground: remove } = await import("@imgly/background-removal");
      const cutout = await remove(file, { output: { format: "image/png", quality: 0.9 } });
      source = await createImageBitmap(cutout);
      backgroundRemoved = true;
    } catch { /* Continue with a white canvas and disclose that the original background may remain. */ }
  }
  const canvas = document.createElement("canvas"); canvas.width = PHOTO_WIDTH; canvas.height = PHOTO_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Your browser could not prepare the image."); }
  context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
  const sw = source instanceof ImageBitmap ? source.width : bitmap.width;
  const sh = source instanceof ImageBitmap ? source.height : bitmap.height;
  const scale = Math.max(PHOTO_WIDTH / sw, PHOTO_HEIGHT / sh);
  const cropWidth = PHOTO_WIDTH / scale, cropHeight = PHOTO_HEIGHT / scale;
  // Center crop follows standard portrait framing. For best placement, upload a selfie with shoulders visible.
  context.drawImage(source, (sw - cropWidth) / 2, (sh - cropHeight) / 2, cropWidth, cropHeight, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  bitmap.close();
  if (source instanceof ImageBitmap && source !== bitmap) source.close();
  const blob = await exportCompressedJpeg(canvas);
  return { url: URL.createObjectURL(blob), sizeKB: (blob.size / 1024).toFixed(1), width: PHOTO_WIDTH, height: PHOTO_HEIGHT, backgroundRemoved };
}
