import React from 'react';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function ImportPhaseSteps({
  phase,
  importing,
  t,
}: {
  phase: string;
  importing: boolean;
  t: TFn;
}) {
  const steps = [
    { n: 1, label: t('importStep1Label') },
    { n: 2, label: t('importStep2Label') },
    { n: 3, label: t('importStep3Label') },
    { n: 4, label: t('importStep4Label') },
    { n: 5, label: t('importStep5Label') },
  ];
  let active = 1;
  if (phase === 'parsing') active = 2;
  else if (phase === 'validated' && !importing) active = 3;
  else if (importing) active = 4;
  else if (phase === 'done') active = 5;

  return (
    <div className="flex items-center gap-6 rounded-xl flex-wrap border border-noorix-border py-3 px-[14px] bg-noorix-bg mb-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          {i > 0 && <span className="text-noorix-muted text-[12px] select-none">{t('importStepSep')}</span>}
          <span
            className={`whitespace-nowrap rounded-lg px-2 py-1 text-[12px] ${
              active === s.n ? 'bg-noorix-blue/10 font-extrabold text-noorix-blue' : 'font-medium text-noorix-muted'
            }`}
          >
            {s.n}. {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
