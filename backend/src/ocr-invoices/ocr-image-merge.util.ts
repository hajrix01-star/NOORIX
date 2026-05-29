export async function mergeOcrImageBuffersVertically(buffers: Buffer[]): Promise<Buffer> {
  if (!buffers.length) throw new Error('No images to merge');
  if (buffers.length === 1) return buffers[0];

  const sharpModule = await import('sharp');
  const sharpFactory = sharpModule.default;

  const metas = await Promise.all(
    buffers.map(async (buf) => sharpFactory(buf, { failOn: 'none' }).metadata()),
  );
  const targetWidth = Math.max(
    ...metas.map((meta) => Number(meta.width) || 0),
    1200,
  );

  const resized = await Promise.all(
    buffers.map(async (buf, index) => {
      const meta = metas[index];
      const width = Number(meta.width) || targetWidth;
      const height = Number(meta.height) || 1;
      if (width <= targetWidth) {
        return sharpFactory(buf, { failOn: 'none' }).rotate().png().toBuffer();
      }
      const nextHeight = Math.max(1, Math.round((height * targetWidth) / width));
      return sharpFactory(buf, { failOn: 'none' })
        .rotate()
        .resize({ width: targetWidth, height: nextHeight, fit: 'inside', withoutEnlargement: false })
        .png()
        .toBuffer();
    }),
  );

  const stackedMetas = await Promise.all(
    resized.map(async (buf) => sharpFactory(buf, { failOn: 'none' }).metadata()),
  );
  const canvasHeight = stackedMetas.reduce((sum, meta) => sum + (Number(meta.height) || 0), 0);
  const canvasWidth = targetWidth;

  let top = 0;
  const composites: { input: Buffer; top: number; left: number }[] = [];
  for (let i = 0; i < resized.length; i += 1) {
    const h = Number(stackedMetas[i].height) || 0;
    const w = Number(stackedMetas[i].width) || canvasWidth;
    composites.push({
      input: resized[i],
      top,
      left: Math.max(0, Math.floor((canvasWidth - w) / 2)),
    });
    top += h;
  }

  return sharpFactory({
    create: {
      width: canvasWidth,
      height: Math.max(canvasHeight, 1),
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(composites)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}
