/**
 * حدّ للطلبات المتوازية لـ Gemini (`GEMINI_MAX_CONCURRENT`، افتراضي 2).
 */
export class GeminiConcurrencyGate {
  private active = 0;
  private wait: Array<() => void> = [];

  private maxConcurrent(): number {
    return Math.min(20, Math.max(1, parseInt(process.env.GEMINI_MAX_CONCURRENT || '2', 10)));
  }

  private async acquire(): Promise<void> {
    const max = this.maxConcurrent();
    if (this.active < max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.wait.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.wait.shift();
    if (next) next();
  }

  async with<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
