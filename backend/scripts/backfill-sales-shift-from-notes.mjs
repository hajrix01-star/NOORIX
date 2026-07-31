/**
 * يحدّث عمود shift من وسم الملاحظات `[شفت: …]` للملخصات المحفوظة كـ all.
 * Usage: node backend/scripts/backfill-sales-shift-from-notes.mjs [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

const TAG_RE = /\[شفت:\s*([^\]]+)\]/;

function shiftFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const m = notes.match(TAG_RE);
  if (!m) return null;
  const label = m[1].trim();
  if (label.includes('صباح')) return 'morning';
  if (label.includes('مساء')) return 'evening';
  if (label.includes('كامل')) return 'all';
  return null;
}

async function main() {
  const rows = await prisma.dailySalesSummary.findMany({
    where: { shift: 'all', notes: { contains: '[شفت:' } },
    select: { id: true, summaryNumber: true, notes: true, shift: true },
  });

  let updated = 0;
  for (const row of rows) {
    const next = shiftFromNotes(row.notes);
    if (!next || next === 'all' || next === row.shift) continue;
    console.log(`${dryRun ? '[dry-run] ' : ''}${row.summaryNumber}: all → ${next}`);
    if (!dryRun) {
      await prisma.dailySalesSummary.update({
        where: { id: row.id },
        data: { shift: next },
      });
    }
    updated += 1;
  }

  console.log(`Done. ${updated} row(s) ${dryRun ? 'would be ' : ''}updated (scanned ${rows.length}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
