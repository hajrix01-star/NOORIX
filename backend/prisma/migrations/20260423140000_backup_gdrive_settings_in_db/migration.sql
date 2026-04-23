-- رابط Apps Script ومعرّف مجلد Drive لكل من إعدادات النظام وإعدادات نسخ الشركة
ALTER TABLE "system_backup_config" ADD COLUMN "gdrive_script_url" TEXT;
ALTER TABLE "system_backup_config" ADD COLUMN "gdrive_folder_id" TEXT;

ALTER TABLE "company_backup_config" ADD COLUMN "gdrive_script_url" TEXT;
ALTER TABLE "company_backup_config" ADD COLUMN "gdrive_folder_id" TEXT;
