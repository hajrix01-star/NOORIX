import { promisify } from 'util';
import * as zlib from 'zlib';

const gzipAsync = promisify(zlib.gzip);

export async function gzipBufferLevel9(data: Buffer): Promise<Buffer> {
  return gzipAsync(data, { level: 9 });
}
