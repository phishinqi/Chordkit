export const CHORD_FIXTURES = [
  { label: 'major triad', input: ['C4', 'E4', 'G4'], primary: 'C' },
  { label: 'minor triad', input: ['C4', 'Eb4', 'G4'], primary: 'Cm' },
  { label: 'sus2', input: ['C4', 'D4', 'G4'], primary: 'Csus2' },
  { label: 'add9', input: ['C3', 'E3', 'G3', 'D4'], primary: 'Cadd9' },
  { label: 'add11', input: ['C3', 'E3', 'G3', 'F4'], primary: 'Cadd11' },
  { label: 'dominant 9', input: ['C3', 'E3', 'G3', 'Bb3', 'D4'], primary: 'C9' },
  { label: 'dominant 13 without 9', input: ['C3', 'E3', 'G3', 'Bb3', 'A4'], primary: 'C13(no9)' },
  { label: 'first inversion', input: ['E3', 'G3', 'C4'], primary: 'C/E' },
  { label: 'major shell', input: ['C4', 'E4'], primary: 'C(no5)' },
  { label: 'diminished seventh', input: ['C4', 'Eb4', 'Gb4', 'A4'], primary: 'Cdim7' },
  { label: 'altered dominant', input: ['C3', 'E3', 'G3', 'Bb3', 'Db4'], primary: 'C7(b9)' },
] as const;

