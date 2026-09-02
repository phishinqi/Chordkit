import { describe, expect, it } from 'vitest';
import { cardIntervals, cardSymbol, createCard, modifierConflicts, modifierIsDisabled } from './harmonyCards';

describe('harmony card semantics', () => {
  it('emits canonical extended and slash-equivalent symbols', () => {
    const cards = [
      createCard({ root: 'C', quality: 'minor', modifiers: ['9'] }),
      createCard({ root: 'Db', quality: 'major', modifiers: ['13', '#11'] }),
      createCard({ root: 'Bb', quality: 'major', modifiers: [], bass: 'C' }),
      createCard({ root: 'E', quality: 'major', modifiers: [], bass: 'Gb' }),
      createCard({ root: 'B', quality: 'major', modifiers: ['9', '#11'] }),
    ];
    expect(cards.map(cardSymbol)).toEqual(['Cm9', 'Db13(#11)', 'C9sus4(no5)', 'Gb9sus4(no5)', 'Bmaj9(#11)']);
    expect(cardIntervals(cards[0]!)).toEqual([0, 3, 7, 10, 14]);
    expect(cardIntervals(cards[1]!)).toEqual([0, 4, 7, 10, 14, 18, 21]);
  });

  it('exposes altered extensions and rejects conflicting modifier pairs', () => {
    const altered = createCard({ root: 'C', quality: '7', modifiers: ['b9', '#9', 'b5', '#5', '#11', 'b13', '#13'] });
    expect(cardSymbol(altered)).toBe('C7(b9,#9,b5,#5,#11,b13,#13)');
    expect(modifierIsDisabled(['9'], 'add9')).toBe(true);
    expect(modifierIsDisabled(['omit5'], 'b5')).toBe(true);
    expect(modifierConflicts(['9', 'add9'])).toEqual([['9', 'add9']]);
    expect(modifierConflicts(['b5', '#5'], true)).toEqual([]);
  });
});
