import { analyzeIntervals, intervalsMatch } from './intervalAnalysis';

const notes = [60, 64, 67, 74]; // C3 E3 G3 D4
const analysis = analyzeIntervals(60, notes);

console.assert(JSON.stringify(analysis.pitchClasses) === JSON.stringify([0, 2, 4, 7]));
console.assert(JSON.stringify(analysis.simpleIntervals) === JSON.stringify([0, 2, 4, 7]));
console.assert(JSON.stringify(analysis.absoluteIntervals) === JSON.stringify([0, 4, 7, 14]));
console.assert(intervalsMatch([0, 4, 7, 14], [0, 4, 7, 14]));
console.assert(!intervalsMatch([0, 2, 4, 7], [0, 4, 7, 14]));
console.assert(!intervalsMatch([0, 4, 7, 17], [0, 4, 7, 14]));

console.log('interval analysis regression tests passed');
