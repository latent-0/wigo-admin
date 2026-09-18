import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, formatMoney, formatDate } from './ui';

describe('ui helpers', () => {
  it('formats money in MXN', () => {
    // 500000 cents = 5,000.00 MXN
    expect(formatMoney(500000)).toContain('5,000');
  });

  it('formats a null date as an em dash', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('renders a status badge with a normalized label', () => {
    render(<StatusBadge status="in_review" />);
    expect(screen.getByText('in review')).toBeInTheDocument();
  });
});
