import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Temp from '../Temp';

describe('Temp (VTL-98)', () => {
  it('shows °F first with a muted °C beside it', () => {
    const { container } = render(<Temp value={42} />);
    expect(container.textContent).toBe('42°F 6°C');
    expect(container.querySelector('.temp-alt')?.textContent).toBe(' 6°C');
  });

  it('accepts Celsius readings, such as road weather sensors', () => {
    const { container } = render(<Temp value={-3.2} unit="C" />);
    expect(container.textContent).toBe('26°F -3°C');
  });
});
