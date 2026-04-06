/**
 * Input — مكوّن حقل الإدخال الموحّد لنظام نووريكس
 *
 * يشمل: text, number, date, email, password, tel, search
 * وكذلك: Textarea (multiline=true) و Select (type="select")
 *
 * الاستخدام:
 *   <Input label="الاسم" value={name} onChange={e => setName(e.target.value)} />
 *   <Input type="number" label="المبلغ" required error="مطلوب" />
 *   <Input type="select" label="الحالة" value={status} onChange={...}>
 *     <option value="active">نشط</option>
 *   </Input>
 *   <Input multiline label="ملاحظات" rows={4} value={notes} onChange={...} />
 */
import React, { useId } from 'react';

/**
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.readOnly]
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.type='text'] - text|number|date|email|password|tel|search|select
 * @param {boolean} [props.multiline=false] - textarea
 * @param {number} [props.rows=3]
 * @param {string} [props.className]
 * @param {React.ReactNode} [props.prefix] - نص/أيقونة قبل الحقل (e.g. "SAR")
 * @param {React.ReactNode} [props.suffix] - نص/أيقونة بعد الحقل
 * @param {React.ReactNode} [props.children] - options لـ select
 */
export default function Input({
  label,
  hint,
  error,
  required,
  disabled,
  readOnly,
  size     = 'md',
  type     = 'text',
  multiline = false,
  rows     = 3,
  prefix,
  suffix,
  className = '',
  children,
  id: externalId,
  ...rest
}) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const isSelect    = type === 'select';
  const isTextarea  = multiline;
  const hasWrapper  = prefix || suffix;

  const fieldClass = [
    'nx-input__field',
    `nx-input__field--${size}`,
    error     ? 'nx-input__field--error'    : '',
    disabled  ? 'nx-input__field--disabled' : '',
    readOnly  ? 'nx-input__field--readonly' : '',
    prefix    ? 'nx-input__field--prefixed' : '',
    suffix    ? 'nx-input__field--suffixed' : '',
    isSelect  ? 'nx-input__field--select'   : '',
    isTextarea? 'nx-input__field--textarea' : '',
    className,
  ].filter(Boolean).join(' ');

  const renderField = () => {
    const shared = {
      id,
      className: fieldClass,
      disabled,
      readOnly,
      'aria-required':    required   || undefined,
      'aria-invalid':     !!error    || undefined,
      'aria-describedby': error      ? `${id}-error` : hint ? `${id}-hint` : undefined,
      ...rest,
    };

    if (isSelect) {
      return (
        <select {...shared}>
          {children}
        </select>
      );
    }
    if (isTextarea) {
      return (
        <textarea rows={rows} {...shared} />
      );
    }
    return <input type={type} {...shared} />;
  };

  return (
    <div className={`nx-input ${error ? 'nx-input--has-error' : ''}`}>
      {label && (
        <label htmlFor={id} className="nx-input__label">
          {label}
          {required && <span className="nx-input__required" aria-hidden="true"> *</span>}
        </label>
      )}

      {hasWrapper ? (
        <div className="nx-input__wrapper">
          {prefix && <span className="nx-input__prefix">{prefix}</span>}
          {renderField()}
          {suffix && <span className="nx-input__suffix">{suffix}</span>}
        </div>
      ) : (
        renderField()
      )}

      {hint && !error && (
        <p id={`${id}-hint`} className="nx-input__hint">{hint}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="nx-input__error">{error}</p>
      )}
    </div>
  );
}
