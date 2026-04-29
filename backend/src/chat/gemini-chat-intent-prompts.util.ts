import { getGeminiModel } from '../config/gemini.config';

/** وصف حقل intent لـ responseJsonSchema — يبقى متطابقاً مع normalizeGeminiIntent */
export const GEMINI_INTENT_FIELD_SCHEMA_DESCRIPTION =
  'One of: sales, purchases, expenses, reports, dashboard_insights, vaults, invoices, suppliers, categories, expense_lines, hr, orders, help, finance_ratios, sales_month_compare, unknown';

export function getGeminiChatIntentRequestUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`;
}

/** مطالبة فهم النية (المحادثة) — جسم JSON فقط */
export const GEMINI_CHAT_INTENT_SYSTEM_PROMPT = `أنت مساعد لفهم أسئلة في نظام محاسبة سعودي (نوركس).
المهمة: استخرج من السؤال النية (intent) والفترة (period) فقط.
أرجع JSON صحيح فقط بدون أي نص إضافي.

النية (intent) — اختر واحدة فقط:
- sales: مبيعات، إيرادات، كم حققنا، كم بيعنا بالمبلغ، دخلنا، أرقام المبيعات
- purchases: مشتريات، كم اشترينا (كمية/مبلغ مشتريات)
- expenses: مصروفات، مصاريف، كم صرفنا
- reports: تقرير رسمي للأرباح والخسائر أو P&L (مثل: تقرير الأرباح والخسائر، تقرير الربح والخسارة، profit and loss report، P&L report) — ليس ملخص وضع الشهر العام
- dashboard_insights: كيف وضع الشهر، وضع الشهر، ملخص الشهر، اعطني ملخص الشهر، كيف الأداء المالي، هل المشتريات مرتفعة، هل الربح جيد، monthly summary، how is the month، are purchases high، is profit good — أسئلة تقييم/ملخص رؤى لوحة التحكم وليست تقرير P&L ولا أرقام مبيعات خام
- vaults: خزائن، أرصدة، رصيد، بنك
- invoices: فواتير، آخر فاتورة
- suppliers: موردين، مورد
- categories: فئات
- expense_lines: بنود مصروفات
- hr: موظفين، اسم الموظف، أسماء الموظفين، رواتب، إجازات، إقامات، مسيرة
- orders: طلبات، أصناف، منتجات
- help: مساعدة، ماذا تسأل، أسئلة، ماذا يمكن أن تفعل (طلب صريح لقائمة المساعدة)
- finance_ratios: نسب الخارج على المبيعات، نسبة المشتريات من المبيعات، نسبة المصروفات، نسب مشتريات أو مصروفات من المبيعات، نسب تشغيلية من الإيراد، purchase ratio، expenses ratio
- sales_month_compare: قارن مبيعات الشهر الماضي بالحالي، من 1 الشهر الماضي إلى نفس تاريخ اليوم مقابل من 1 الحالي إلى اليوم
- unknown: تحيات (مرحبا، أهلا، السلام، كيف الحال)، أسئلة عامة خارج المحاسبة، أو أي سؤال لا ينطبق على القائمة

الفترة (period) — اختر واحدة أو null:
- today: اليوم
- yesterday: أمس
- day_before_yesterday: أول أمس، قبل يومين
- this_week: هذا الأسبوع
- last_week: الأسبوع الماضي
- this_month: هذا الشهر
- last_month: الشهر الماضي
- year: السنة (إذا لم تذكر فترة أو ذكرت السنة)
- null: إذا لم تذكر فترة

الصيغة: {"intent":"...","period":"..." أو null}
مهم: أرجع JSON فقط بدون أي كلمات قبل أو بعد. لا تكتب "Here is" أو "النتيجة" أو أي نص آخر.`;
