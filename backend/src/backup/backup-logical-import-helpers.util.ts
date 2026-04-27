import { Prisma } from '@prisma/client';

export function importSnapshotArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function importSnapshotDec(v: unknown): Prisma.Decimal {
  if (v == null || v === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(v));
}

export function importSnapshotDdate(v: unknown): Date {
  if (v instanceof Date) return v;
  return new Date(String(v));
}
