export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

export type ValidImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
};

export type ImageValidationFailure = "empty" | "too_large" | "unsupported" | "invalid" | "dimensions";

export class ImageValidationError extends Error {
  readonly reason: ImageValidationFailure;
  constructor(reason: ImageValidationFailure) {
    super(reason);
    this.reason = reason;
  }
}

export function inspectImage(filename: string, declaredMime: string, bytes: Uint8Array): ValidImage {
  if (!bytes.length) throw new ImageValidationError("empty");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ImageValidationError("too_large");
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (!["jpg", "jpeg", "png", "webp"].includes(extension)) throw new ImageValidationError("unsupported");

  const result = parsePng(bytes) ?? parseJpeg(bytes) ?? parseWebp(bytes);
  if (!result) throw new ImageValidationError("invalid");
  const extensionMatches = result.extension === "jpg" ? extension === "jpg" || extension === "jpeg" : extension === result.extension;
  if (!extensionMatches || (declaredMime && declaredMime !== result.mime)) throw new ImageValidationError("unsupported");
  if (result.width * result.height > MAX_IMAGE_PIXELS) throw new ImageValidationError("dimensions");
  return result;
}

function parsePng(bytes: Uint8Array): ValidImage | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const iend = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value) || !iend.every((value, index) => bytes[bytes.length - iend.length + index] === value)) return null;
  if (readU32(bytes, 8) !== 13 || ascii(bytes, 12, 16) !== "IHDR") return null;
  const width = readU32(bytes, 16);
  const height = readU32(bytes, 20);
  return width > 0 && height > 0 ? { mime: "image/png", extension: "png", width, height } : null;
}

function parseJpeg(bytes: Uint8Array): ValidImage | null {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length - 2) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda || offset + 2 > bytes.length) break;
    const length = readU16(bytes, offset);
    if (length < 2 || offset + length > bytes.length) return null;
    const sof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (sof && length >= 7) {
      const height = readU16(bytes, offset + 3);
      const width = readU16(bytes, offset + 5);
      return width > 0 && height > 0 ? { mime: "image/jpeg", extension: "jpg", width, height } : null;
    }
    offset += length;
  }
  return null;
}

function parseWebp(bytes: Uint8Array): ValidImage | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP" || readU32Le(bytes, 4) + 8 > bytes.length) return null;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + readU24Le(bytes, 24);
    const height = 1 + readU24Le(bytes, 27);
    return { mime: "image/webp", extension: "webp", width, height };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const width = 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8));
    const height = 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
    return { mime: "image/webp", extension: "webp", width, height };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return width > 0 && height > 0 ? { mime: "image/webp", extension: "webp", width, height } : null;
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}
function readU16(bytes: Uint8Array, offset: number): number { return (bytes[offset] << 8) | bytes[offset + 1]; }
function readU32(bytes: Uint8Array, offset: number): number { return ((bytes[offset] * 0x1000000) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0; }
function readU32Le(bytes: Uint8Array, offset: number): number { return (bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + (bytes[offset + 3] * 0x1000000)) >>> 0; }
function readU24Le(bytes: Uint8Array, offset: number): number { return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16); }
