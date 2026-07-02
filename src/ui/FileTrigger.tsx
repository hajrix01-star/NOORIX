import React, { forwardRef, useId } from 'react';
import Button, { type ButtonProps } from './Button';

export type FileTriggerProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type' | 'children'> & {
  label: React.ReactNode;
  buttonProps?: Omit<ButtonProps, 'children' | 'type' | 'onClick'>;
};

const FileTrigger = forwardRef<HTMLInputElement, FileTriggerProps>(function FileTrigger(
  { label, buttonProps, id: externalId, className = 'hidden', ...rest },
  ref,
) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <>
      <input ref={ref} id={id} type="file" className={className} {...rest} />
      <Button type="button" {...buttonProps} onClick={() => document.getElementById(id)?.click()}>
        {label}
      </Button>
    </>
  );
});

export default FileTrigger;
