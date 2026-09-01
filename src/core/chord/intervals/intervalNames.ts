const SIMPLE_NAMES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7'];
const COMPOUND_NAMES: Record<number, string> = { 13: 'b9', 14: '9', 15: '#9', 17: '11', 18: '#11', 20: 'b13', 21: '13' };

export function intervalName(interval: number): string {
  return COMPOUND_NAMES[interval] ?? SIMPLE_NAMES[((interval % 12) + 12) % 12]!;
}

