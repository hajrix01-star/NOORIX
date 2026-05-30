/**
 * HR main screen — section + sub-tab routing (?section=…&tab=…)
 * Legacy flat ?tab=employees|payroll|leave|… is mapped on read and normalized in the URL.
 */

export const HR_SECTION_IDS = ['people', 'payroll', 'tools'] as const;
export type HrSectionId = (typeof HR_SECTION_IDS)[number];

export const HR_PEOPLE_TAB_IDS = ['list', 'leave', 'residency'] as const;
export const HR_PAYROLL_TAB_IDS = ['runs', 'advances'] as const;
export const HR_TOOLS_TAB_IDS = ['salary-calc', 'eos-calc', 'print'] as const;

export type HrPeopleTabId = (typeof HR_PEOPLE_TAB_IDS)[number];
export type HrPayrollTabId = (typeof HR_PAYROLL_TAB_IDS)[number];
export type HrToolsTabId = (typeof HR_TOOLS_TAB_IDS)[number];
export type HrSubTabId = HrPeopleTabId | HrPayrollTabId | HrToolsTabId;

export type HrScreenLocation = { section: HrSectionId; tab: HrSubTabId };

/** Flat ?tab= from pre-2026-05 HR screen */
export const LEGACY_HR_FLAT_TAB_MAP: Record<string, HrScreenLocation> = {
  employees: { section: 'people', tab: 'list' },
  leave: { section: 'people', tab: 'leave' },
  residency: { section: 'people', tab: 'residency' },
  payroll: { section: 'payroll', tab: 'runs' },
  advances: { section: 'payroll', tab: 'advances' },
  salaryCalc: { section: 'tools', tab: 'salary-calc' },
  eosCalc: { section: 'tools', tab: 'eos-calc' },
  printDocs: { section: 'tools', tab: 'print' },
};

const DEFAULT_SECTION: HrSectionId = 'people';

export function isHrSectionId(value: string | null | undefined): value is HrSectionId {
  return HR_SECTION_IDS.includes(value as HrSectionId);
}

export function tabsForHrSection(section: HrSectionId): readonly string[] {
  if (section === 'people') return HR_PEOPLE_TAB_IDS;
  if (section === 'payroll') return HR_PAYROLL_TAB_IDS;
  return HR_TOOLS_TAB_IDS;
}

export function defaultTabForHrSection(section: HrSectionId): HrSubTabId {
  if (section === 'people') return 'list';
  if (section === 'payroll') return 'runs';
  return 'salary-calc';
}

export function isValidHrSubTab(section: HrSectionId, tab: string | null | undefined): tab is HrSubTabId {
  if (!tab) return false;
  return (tabsForHrSection(section) as readonly string[]).includes(tab);
}

export function resolveHrScreenFromSearchParams(searchParams: URLSearchParams): HrScreenLocation {
  const rawSection = searchParams.get('section')?.trim();
  const rawTab = searchParams.get('tab')?.trim();

  if (isHrSectionId(rawSection)) {
    const tab = isValidHrSubTab(rawSection, rawTab)
      ? rawTab
      : defaultTabForHrSection(rawSection);
    return { section: rawSection, tab };
  }

  if (rawTab && LEGACY_HR_FLAT_TAB_MAP[rawTab]) {
    return LEGACY_HR_FLAT_TAB_MAP[rawTab];
  }

  return { section: DEFAULT_SECTION, tab: defaultTabForHrSection(DEFAULT_SECTION) };
}

function hrCanonicalQuerySnapshot(searchParams: URLSearchParams) {
  const resolved = resolveHrScreenFromSearchParams(searchParams);
  const canon = writeHrScreenToSearchParams(new URLSearchParams(), resolved);
  return {
    section: canon.get('section') ?? '',
    tab: canon.get('tab') ?? '',
  };
}

function hrCurrentQuerySnapshot(searchParams: URLSearchParams) {
  return {
    section: searchParams.get('section')?.trim() ?? '',
    tab: searchParams.get('tab')?.trim() ?? '',
  };
}

/** True when URL should be rewritten to canonical ?section=&tab= (legacy flat tab, invalid combo, redundant defaults). */
export function hrScreenUrlNeedsNormalization(searchParams: URLSearchParams): boolean {
  const rawTab = searchParams.get('tab')?.trim();
  if (!searchParams.get('section')?.trim() && rawTab && LEGACY_HR_FLAT_TAB_MAP[rawTab]) {
    return true;
  }
  const current = hrCurrentQuerySnapshot(searchParams);
  const canonical = hrCanonicalQuerySnapshot(searchParams);
  return current.section !== canonical.section || current.tab !== canonical.tab;
}

export function writeHrScreenToSearchParams(
  base: URLSearchParams,
  location: HrScreenLocation,
): URLSearchParams {
  const next = new URLSearchParams(base);
  const { section, tab } = location;
  const defTab = defaultTabForHrSection(section);

  if (section === DEFAULT_SECTION && tab === defTab) {
    next.delete('section');
    next.delete('tab');
  } else {
    next.set('section', section);
    if (tab === defTab) next.delete('tab');
    else next.set('tab', tab);
  }

  return next;
}
