/**
 * Client-side image compression utility.
 * All images are drawn through Canvas, which strips EXIF metadata
 * (including GPS location, camera info, etc.) automatically.
 */

interface CompressOptions {
  /** Max width/height in pixels (default: 1024) */
  maxSize?: number;
  /** Target max file size in bytes (default: 300KB) */
  maxFileSize?: number;
  /** Initial JPEG quality 0-1 (default: 0.85) */
  initialQuality?: number;
  /** Minimum JPEG quality floor (default: 0.6) */
  minQuality?: number;
}

/**
 * Compress and strip EXIF from an image Blob/File.
 * Returns a JPEG Blob with EXIF removed and size optimized.
 */
export async function compressImage(
  source: Blob | File,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxSize = 1024,
    maxFileSize = 300 * 1024, // 300KB
    initialQuality = 0.85,
    minQuality = 0.6,
  } = options;

  // Load image from blob
  const bitmap = await createImageBitmap(source);
  const { width, height } = bitmap;

  // Calculate scaled dimensions (maintain aspect ratio)
  let sw = width;
  let sh = height;
  if (sw > maxSize || sh > maxSize) {
    const ratio = Math.min(maxSize / sw, maxSize / sh);
    sw = Math.round(sw * ratio);
    sh = Math.round(sh * ratio);
  }

  // Draw to canvas — this strips all EXIF metadata
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, sw, sh);
  bitmap.close();

  // Compress with decreasing quality until under maxFileSize
  let quality = initialQuality;
  const step = 0.1;

  while (quality >= minQuality) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= maxFileSize || quality <= minQuality) {
      return blob;
    }
    quality -= step;
  }

  // Fallback: return at minQuality
  return canvasToBlob(canvas, minQuality);
}

/**
 * Compress a cropped region (used by ImageCropper).
 * Draws a specific crop area to a square canvas, optionally with circular clip.
 */
export async function compressCroppedImage(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  outputSize: number,
  round: boolean,
  options: CompressOptions = {}
): Promise<Blob> {
  const {
    maxFileSize = 300 * 1024,
    initialQuality = 0.85,
    minQuality = 0.6,
  } = options;

  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  if (round) {
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, outputSize, outputSize
  );

  // Compress with decreasing quality
  let quality = initialQuality;
  const step = 0.1;

  while (quality >= minQuality) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= maxFileSize || quality <= minQuality) {
      return blob;
    }
    quality -= step;
  }

  return canvasToBlob(canvas, minQuality);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/jpeg", quality);
  });
}
