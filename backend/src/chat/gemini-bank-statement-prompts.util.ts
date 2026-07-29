import { toYmd } from '../common/utils/to-ymd.util';

export type BankStatementPhase1Result = {
  companyName: string;
  reportDate: string;
  dataStartRow: number;
  dataEndRow: number;
  headerRow: number;
};

export type BankStatementHeaderMetadata = {
  customerName: string;
  bankName: string;
  periodFrom: string;
  periodTo: string;
};

export function buildBankStatementPhase1Prompt(raw: string[][]): string {
  const sample = raw.slice(0, 35).map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => String(cell ?? '').slice(0, 60)).join(' | '),
  );
  const textSample = sample.map((row, index) => `[${index}]: ${row}`).join('\n');
  const lastRow = raw.length - 1;

  return `Bank statement Excel sample:

${textSample}

Determine zero-based row positions:
1. companyName: company/customer name from the first rows, if present
2. reportDate: report date as YYYY-MM if present, otherwise null
3. headerRow: row number containing headers such as date, debit, credit, description
4. dataStartRow: first transaction row after headers
5. dataEndRow: last transaction row, not greater than ${lastRow}

Return JSON only:
{"companyName":"...","reportDate":"..." or null,"headerRow":number,"dataStartRow":number,"dataEndRow":number}`;
}

export function normalizeBankStatementPhase1(
  parsed: {
    companyName?: string;
    reportDate?: string | null;
    headerRow?: number;
    dataStartRow?: number;
    dataEndRow?: number;
  },
  rawLength: number,
): BankStatementPhase1Result | null {
  if (parsed.dataStartRow == null) return null;

  const lastRow = rawLength - 1;
  const dataStartRow = Math.max(0, Math.min(lastRow, Math.floor(Number(parsed.dataStartRow) || 0)));
  const dataEndRow = Math.max(
    dataStartRow,
    Math.min(lastRow, Math.floor(Number(parsed.dataEndRow) ?? lastRow)),
  );
  const headerRow = Math.max(0, Math.min(dataStartRow, Math.floor(Number(parsed.headerRow ?? dataStartRow - 1) || 0)));

  return {
    companyName: String(parsed.companyName ?? '').trim() || '',
    reportDate: parsed.reportDate && String(parsed.reportDate).trim() !== 'null' ? String(parsed.reportDate).trim() : '',
    dataStartRow,
    dataEndRow,
    headerRow,
  };
}

export function buildBankStatementPhase2Prompt(raw: string[][], dataStartRow: number, headerRow: number): {
  prompt: string;
  colCount: number;
} {
  const colCount = Math.max(...raw.map((row) => (Array.isArray(row) ? row.length : 0)), 1);
  const headerCells = (raw[headerRow] || [])
    .map((cell, index) => `col${index}:"${String(cell ?? '').slice(0, 30)}"`)
    .join(', ');
  const sampleRows = raw
    .slice(dataStartRow, dataStartRow + 5)
    .map((row, rowIndex) => {
      const cells = (Array.isArray(row) ? row : [])
        .map((cell, cellIndex) => `[${cellIndex}]:"${String(cell ?? '').slice(0, 25)}"`)
        .join(' ');
      return `row${rowIndex}: ${cells}`;
    })
    .join('\n');

  return {
    colCount,
    prompt: `Bank statement headers, row ${headerRow}:
${headerCells}

Data sample:
${sampleRows}

For each column 0 to ${colCount - 1}, choose one of:
date | debit | credit | amount | description | notes | balance | reference | ignore

Return JSON only: {"0":"type","1":"type",...}`,
  };
}

export function normalizeBankStatementColumnTypes(parsed: Record<string, string>, colCount: number): Record<number, string> {
  const validTypes = new Set([
    'date',
    'debit',
    'credit',
    'amount',
    'description',
    'notes',
    'balance',
    'reference',
    'ignore',
  ]);
  const columnTypes: Record<number, string> = {};

  for (let index = 0; index < colCount; index += 1) {
    const type = String(parsed[String(index)] ?? 'ignore').toLowerCase();
    columnTypes[index] = validTypes.has(type) ? type : 'ignore';
  }

  return columnTypes;
}

export function buildBankStatementHeaderMetadataPrompt(raw: string[][]): string {
  const headerText = raw
    .slice(0, Math.min(22, raw.length))
    .map((row, rowIndex) => {
      const parts = (row || []).map((cell, cellIndex) => {
        if (cell === '' || cell == null) return '';
        const value = String(cell).trim().slice(0, 120);
        return value ? `[${cellIndex}]${value}` : '';
      });
      return `row ${rowIndex}: ${parts.filter(Boolean).join(' | ')}`;
    })
    .join('\n');

  return `Analyze this bank statement header and extract:

${headerText}

- customer_name: account owner company/customer name, not the bank name
- bank_name: bank name
- period_from: period start date as YYYY-MM-DD
- period_to: period end date as YYYY-MM-DD

Return JSON only. Use "" for missing fields.`;
}

export function normalizeBankStatementHeaderMetadata(parsed: {
  customer_name?: string;
  bank_name?: string;
  period_from?: string;
  period_to?: string;
}): BankStatementHeaderMetadata {
  const norm = (value: unknown) => String(value ?? '').trim().slice(0, 200);
  return {
    customerName: norm(parsed.customer_name),
    bankName: norm(parsed.bank_name),
    periodFrom: toYmd(norm(parsed.period_from)),
    periodTo: toYmd(norm(parsed.period_to)),
  };
}
