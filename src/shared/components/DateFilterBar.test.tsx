import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import DateFilterBar, { useDateFilter } from './DateFilterBar';

function Harness() {
  const filter = useDateFilter();
  return (
    <>
      <div data-testid="applied-label">{filter.label}</div>
      <DateFilterBar filter={filter} />
    </>
  );
}

afterEach(() => {
  cleanup();
});

describe('DateFilterBar shared shim', () => {
  it('keeps the legacy shared export wired to the official date filter', () => {
    render(
      <AppTestProviders appValue={{ ...defaultAppTestContextValue, language: 'en' }}>
        <Harness />
      </AppTestProviders>,
    );

    expect(screen.getByRole('button', { name: 'Month' })).toBeTruthy();
    expect(screen.getByTestId('applied-label').textContent).toBeTruthy();
  });
});
