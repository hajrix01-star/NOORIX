import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import React from 'react';
import { useHrScreenNavigation } from './useHrScreenNavigation';

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="search">{loc.search}</span>;
}

function wrapper(initial: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[`/hr${initial}`]}>
        {children}
        <LocationProbe />
      </MemoryRouter>
    );
  };
}

describe('useHrScreenNavigation', () => {
  it('setSubTab uses explicit section (payroll advances)', () => {
    const { result } = renderHook(() => useHrScreenNavigation(), {
      wrapper: wrapper('?section=payroll'),
    });

    act(() => {
      result.current.setSubTab('advances', 'payroll');
    });

    expect(result.current.section).toBe('payroll');
    expect(result.current.tab).toBe('advances');
  });

  it('navigateHrScreen applies section and tab atomically', () => {
    const { result } = renderHook(() => useHrScreenNavigation(), {
      wrapper: wrapper(''),
    });

    act(() => {
      result.current.navigateHrScreen({ section: 'people', tab: 'leave' });
    });

    expect(result.current.section).toBe('people');
    expect(result.current.tab).toBe('leave');
  });
});
