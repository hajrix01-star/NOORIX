import {
  GEMINI_CHAT_INTENT_SYSTEM_PROMPT,
  GEMINI_INTENT_FIELD_SCHEMA_DESCRIPTION,
} from './gemini-chat-intent-prompts.util';
import { DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT } from './gemini.service';

describe('Gemini chat intent prompt & schema description', () => {
  it('includes dashboard_insights in the system prompt with mapped examples', () => {
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('dashboard_insights');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('كيف وضع الشهر');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('ملخص الشهر');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('حلل المشتريات');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('purchase analysis');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('هل الربح جيد');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('اعطني ملخص الشهر');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toMatch(/how is the month/i);
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toMatch(/monthly summary/i);
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toMatch(/are purchases high/i);
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toMatch(/is profit good/i);
  });

  it('keeps formal P&L under reports in the prompt', () => {
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('تقرير الأرباح والخسائر');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toMatch(/profit and loss report/i);
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toMatch(/P&L report/i);
  });

  it('keeps finance_ratios examples for ratio phrases', () => {
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('finance_ratios');
    expect(GEMINI_CHAT_INTENT_SYSTEM_PROMPT).toContain('نسبة المشتريات من المبيعات');
  });

  it('lists dashboard_insights in GEMINI_INTENT_FIELD_SCHEMA_DESCRIPTION', () => {
    expect(GEMINI_INTENT_FIELD_SCHEMA_DESCRIPTION).toContain('dashboard_insights');
  });
});

describe('DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT', () => {
  it('forbids new calculations and invention (grounding rules)', () => {
    expect(DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT).toMatch(/Do not calculate new financial numbers/i);
    expect(DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT).toMatch(/Do not invent missing data/i);
    expect(DASHBOARD_INSIGHTS_LLM_SYSTEM_PROMPT).toMatch(/only the provided Dashboard Insights JSON/i);
  });
});
