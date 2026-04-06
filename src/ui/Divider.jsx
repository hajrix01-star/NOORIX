/**
 * Divider — فاصل أفقي/عمودي بسيط
 *
 * الاستخدام:
 *   <Divider />
 *   <Divider label="أو" />
 *   <Divider vertical style={{ height: 24 }} />
 */
import React from 'react';

export default function Divider({ label, vertical = false, className = '', ...rest }) {
  if (vertical) {
    return (
      <span
        className={['nx-divider', 'nx-divider--vertical', className].filter(Boolean).join(' ')}
        aria-hidden="true"
        {...rest}
      />
    );
  }
  if (label) {
    return (
      <div className={['nx-divider', 'nx-divider--labeled', className].filter(Boolean).join(' ')} {...rest}>
        <span className="nx-divider__line" aria-hidden="true" />
        <span className="nx-divider__label">{label}</span>
        <span className="nx-divider__line" aria-hidden="true" />
      </div>
    );
  }
  return (
    <hr
      className={['nx-divider', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      {...rest}
    />
  );
}
