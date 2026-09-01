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
    expect(Number.parseFloat((screen.getByTitle('C#3') as HTMLElement).style.left)).toBeCloseTo(100 / 14, 10);
    expect(Number.parseFloat((screen.getByTitle('D#3') as HTMLElement).style.left)).toBeCloseTo(200 / 14, 10);
    fireEvent.click(screen.getByTitle('C#3'));
    expect(onToggle).toHaveBeenCalledWith('C#3', 49);
  });
});