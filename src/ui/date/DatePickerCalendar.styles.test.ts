import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const globalCss = readFileSync(resolve('src/index.css'), 'utf8');
const calendarCss = readFileSync(resolve('src/ui/date/DatePickerCalendar.module.css'), 'utf8');

describe('DatePickerCalendar style isolation', () => {
  it('scopes mobile dialog sizing to governed dialog actions', () => {
    expect(globalCss).not.toMatch(/\[role="dialog"\]\s+form\s+button\s*[,{}]/);
    expect(globalCss).not.toMatch(/\.modal-overlay\s+form\s+button\s*[,{}]/);
    expect(globalCss).toContain('[role="dialog"] form .nx-dialog-actions > .nx-btn');
  });

  it('resets calendar controls and clips every date to its own grid cell', () => {
    expect(calendarCss).toContain('.root .calendarButton');
    expect(calendarCss).toContain('min-width: 0;');
    expect(calendarCss).toContain('contain: layout paint;');
  });
});
