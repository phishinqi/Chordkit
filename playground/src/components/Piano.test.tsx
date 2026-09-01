import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Piano } from './Piano';

describe('Piano geometry', () => {
  it('renders fixed white and black key layers without changing the white-key count', () => {
    const onToggle = vi.fn();
    const { container } = render(<Piano selected={['C3', 'C#3']} enabled onToggle={onToggle} />);
    expect(container.querySelectorAll('.piano .white')).toHaveLength(14);
    expect(container.querySelectorAll('.piano .black')).toHaveLength(10);
    expect(container.querySelector('.white.selected')).toBeTruthy();
    expect(container.querySelector('.black.selected')).toBeTruthy();
    fireEvent.click(screen.getByTitle('C#3'));
    expect(onToggle).toHaveBeenCalledWith('C#3', 49);
  });
});