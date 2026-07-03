import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Button from './Button';

describe('Button runtime style hooks', () => {
  it('applies constrained runtime visual styles on the button root', () => {
    render(
      <Button
        data-testid="runtime-button"
        runtimeStyle={{
          background: '#12345618',
          border: '1px solid #123456',
          color: '#123456',
        }}
      >
        Runtime
      </Button>,
    );

    const button = screen.getByTestId('runtime-button');
    expect(button.style.background).toBe('#12345618');
    expect(button.style.border).toBe('1px solid #123456');
    expect(button.style.color).toBe('#123456');
  });

  it('applies runtime CSS variables without requiring screen-level inline styles', () => {
    render(
      <Button data-testid="var-button" styleVars={{ '--role-color': '#abcdef' }}>
        Role
      </Button>,
    );

    expect(screen.getByTestId('var-button').style.getPropertyValue('--role-color')).toBe('#abcdef');
  });
});
