/** نصوص رد المحادثة الذكية عند عدم مطابقة أي معالج — ثنائية اللغة */

const EXAMPLES_AR = [
  '«كيف وضع الشهر؟» أو «ملخص الشهر»',
  '«نسبة المشتريات من المبيعات»',
  '«كم مبيعاتنا هذا الشهر؟»',
  '«تقرير الأرباح والخسائر»',
  '«كم رصيد الخزينة؟»',
];

const EXAMPLES_EN = [
  '"How is the month?" or "monthly summary"',
  '"Purchase ratio to sales"',
  '"How much did we sell this month?"',
  '"Profit and loss report"',
  '"What is the vault balance?"',
];

export const SMART_CHAT_UNSUPPORTED_ANSWER_AR = `لم أفهم السؤال في نطاق المحادثة الذكية الحالي.

جرّب أحد الأمثلة التالية:
${EXAMPLES_AR.map((l) => `• ${l}`).join('\n')}

أو اكتب «مساعدة» لعرض الأسئلة المدعومة.`;

export const SMART_CHAT_UNSUPPORTED_ANSWER_EN = `I could not match your question to a supported Smart Chat topic.

Try one of these examples:
${EXAMPLES_EN.map((l) => `• ${l}`).join('\n')}

Or type "help" to see supported questions.`;
