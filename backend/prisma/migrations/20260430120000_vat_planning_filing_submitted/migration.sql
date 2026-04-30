-- اعتماد التقديم في سجل HAJRI TAX (قابل لإعادة الفتح)
ALTER TABLE "vat_planning_quarters" ADD COLUMN "filing_submitted" BOOLEAN NOT NULL DEFAULT false;
