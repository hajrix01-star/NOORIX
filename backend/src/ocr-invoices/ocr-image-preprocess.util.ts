type OcrImageMetadata = {
  format: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
};

type OcrImageQualityDiagnostics = {
  original: OcrImageMetadata;
  processed: OcrImageMetadata;
  preprocessApplied: boolean;
  reason?: string;
};

export type OcrPreprocessResult = {
  buffer: Buffer;
  mimeType: string;
  qualityFlags: string[];
  diagnostics: OcrImageQualityDiagnostics;
};

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

function readNumberEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

function toMeta(
  sizeBytes: number,
  metadata: { format?: string; width?: number; height?: number } | null | undefined,
): OcrImageMetadata {
  return {
    format: metadata?.format || null,
    width: metadata?.width ?? null,
    height: metadata?.height ?? null,
    sizeBytes,
  };
}

function ensureImageQualityFlags(
  flags: Set<string>,
  meta: { width?: number; height?: number } | null | undefined,
  stats: { entropy?: number; sharpness?: number } | null | undefined,
): void {
  const minSideThreshold = readNumberEnv('OCR_IMAGE_MIN_SIDE_PX', 900, 320, 2500);
  const entropyThreshold = readNumberEnv('OCR_IMAGE_MIN_ENTROPY', 3.2, 0.5, 8);
  const sharpnessThreshold = readNumberEnv('OCR_IMAGE_MIN_SHARPNESS', 6, 0.5, 40);

  const width = meta?.width ?? 0;
  const height = meta?.height ?? 0;
  if (width > 0 && height > 0 && Math.min(width, height) < minSideThreshold) {
    flags.add('image_low_resolution');
  }
  if (typeof stats?.entropy === 'number' && stats.entropy < entropyThreshold) {
    flags.add('image_low_entropy');
  }
  if (typeof stats?.sharpness === 'number' && stats.sharpness < sharpnessThreshold) {
    flags.add('image_low_sharpness');
  }
}

export async function preprocessOcrImageForExtraction(
  sourceBuffer: Buffer,
  sourceMimeType: string,
): Promise<OcrPreprocessResult> {
  const enabled = readBoolEnv('OCR_IMAGE_PREPROCESS_ENABLED', true);
  const maxDimension = readNumberEnv('OCR_IMAGE_MAX_DIMENSION', 2200, 960, 4096);
  const jpegQuality = readNumberEnv('OCR_IMAGE_JPEG_QUALITY', 88, 65, 95);
  const flags = new Set<string>();

  try {
    const sharpModule = await import('sharp');
    const sharpFactory = sharpModule.default;

    const originalImage = sharpFactory(sourceBuffer, { failOn: 'none' });
    const originalMetadata = await originalImage.metadata();
    const originalStats = await originalImage.stats();
    ensureImageQualityFlags(flags, originalMetadata, originalStats);

    if (!enabled) {
      return {
        buffer: sourceBuffer,
        mimeType: sourceMimeType,
        qualityFlags: Array.from(flags),
        diagnostics: {
          original: toMeta(sourceBuffer.length, originalMetadata),
          processed: toMeta(sourceBuffer.length, originalMetadata),
          preprocessApplied: false,
          reason: 'disabled_by_env',
        },
      };
    }

    let pipeline = sharpFactory(sourceBuffer, { failOn: 'none' }).rotate();
    const width = originalMetadata.width ?? 0;
    const height = originalMetadata.height ?? 0;
    const longEdge = Math.max(width, height);
    if (longEdge > maxDimension) {
      pipeline = pipeline.resize({
        width: width >= height ? maxDimension : undefined,
        height: height > width ? maxDimension : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
      flags.add('image_resized_for_ocr');
    }

    const processedBuffer = await pipeline
      .normalize()
      .sharpen(1.1)
      .jpeg({
        quality: jpegQuality,
        mozjpeg: true,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();

    const processedMetadata = await sharpFactory(processedBuffer, { failOn: 'none' }).metadata();
    if (processedBuffer.length < sourceBuffer.length) {
      flags.add('image_optimized');
    }

    return {
      buffer: processedBuffer,
      mimeType: 'image/jpeg',
      qualityFlags: Array.from(flags),
      diagnostics: {
        original: toMeta(sourceBuffer.length, originalMetadata),
        processed: toMeta(processedBuffer.length, processedMetadata),
        preprocessApplied: true,
      },
    };
  } catch {
    flags.add('image_preprocess_failed');
    return {
      buffer: sourceBuffer,
      mimeType: sourceMimeType,
      qualityFlags: Array.from(flags),
      diagnostics: {
        original: toMeta(sourceBuffer.length, null),
        processed: toMeta(sourceBuffer.length, null),
        preprocessApplied: false,
        reason: 'sharp_processing_failed',
      },
    };
  }
}
