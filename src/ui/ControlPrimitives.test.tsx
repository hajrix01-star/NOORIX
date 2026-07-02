import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Checkbox from './Checkbox';
import FileInput from './FileInput';
import Radio from './Radio';

afterEach(() => {
  cleanup();
});

describe('control primitives', () => {
  it('renders Checkbox with label and checked state', () => {
    render(<Checkbox label="Enabled" checked readOnly />);

    const input = screen.getByLabelText('Enabled') as HTMLInputElement;
    expect(input.type).toBe('checkbox');
    expect(input.checked).toBe(true);
  });

  it('renders Radio with label and selected state', () => {
    render(<Radio label="Replace" checked readOnly />);

    const input = screen.getByLabelText('Replace') as HTMLInputElement;
    expect(input.type).toBe('radio');
    expect(input.checked).toBe(true);
  });

  it('renders FileInput as a native file input', () => {
    render(<FileInput label="Upload" accept=".csv" />);

    const input = screen.getByLabelText('Upload') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.csv');
  });
});
