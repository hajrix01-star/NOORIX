-- إظهار الخزينة كخيار سداد في المبيعات والمشتريات (افتراضي: مفعّل)
ALTER TABLE "vaults" ADD COLUMN "show_as_payment_method" BOOLEAN NOT NULL DEFAULT true;
