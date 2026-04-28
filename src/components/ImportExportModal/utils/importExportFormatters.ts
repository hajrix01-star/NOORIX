import type { ImportProgressState } from '../types';

export function importProgressPercent(progress: ImportProgressState): number {
  return progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
}
