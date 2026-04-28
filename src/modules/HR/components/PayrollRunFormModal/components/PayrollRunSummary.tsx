import React from 'react';
import { hrFmt } from '../../../utils/hrFmt';

type Props = {
  totalLabel: string;
  totalNet: number;
};

/** إجمالي المسيرة — نفس تنسيق ما قبل التفكيك (hrFmt)، عرض فقط. */
export function PayrollRunSummary({ totalLabel, totalNet }: Props) {
  return (
    <div className="font-extrabold nx-font-numbers text-[clamp(15px,2.4vw,17px)]">
      {totalLabel}: {hrFmt(totalNet)}
    </div>
  );
}
