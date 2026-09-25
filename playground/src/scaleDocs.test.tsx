import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { analyzeScale, analyzeScalePitchClasses, SCALE_DEFINITIONS, ScaleInputError, type ScaleAnalysisResult } from '@chordkit/scale';
import { runInvocation } from './api';
import { DocsTab } from './components/DocsTab';
import { docsExamples, docsSections, type DocsExample, type DocsLocaleText } from './docs';
import { t } from './i18n';
import { apiRegistry } from './registry';
import { json } from './runtime';
import { prettyNote, scaleMessages } from './scaleLabels';
import { defaultWorkspace, encodeWorkspace, loadWorkspace, saveWorkspace } from './workspace';

const scaleExamples = docsExamples.filter((example) => example.module === 'scale');
const exampleById = (id: string): DocsExample => {
  const example = scaleExamples.find((item) => item.id === id);
  if (!example) throw new Error(`Missing scale documentation example ${id}`);
  return example;
};

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

async function invokeExample(example: DocsExample) {
  const entry = apiRegistry.find((item) => item.module === 'scale' && item.name === example.name);
  expect(entry?.kind).toBe('function');
  if (!entry) throw new Error(`Missing public registry entry ${example.name}`);
  const args = freezeDeep(JSON.parse(json(example.args)) as unknown[]);
  const before = json(args);
  const result = await runInvocation(entry, args);
  expect(json(args)).toBe(before);
  return result;
}

async function resultFor(id: string): Promise<ScaleAnalysisResult> {
  const invocation = await invokeExample(exampleById(id));
  if (invocation.status !== 'success') throw new Error(invocation.error.message);
  return invocation.value as ScaleAnalysisResult;
}

function expectBilingual(value: DocsLocaleText): void {
  expect(value.zh.trim()).not.toBe('');
  expect(value.en.trim()).not.toBe('');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('executable scale documentation', () => {
  it('documents both public recognition functions, not internal helpers', () => {
    expect(scaleExamples).toHaveLength(8);
    expect(new Set(docsExamples.map((example) => example.id)).size).toBe(docsExamples.length);
    const functions = apiRegistry.filter((entry) => entry.module === 'scale' && entry.kind === 'function').map((entry) => entry.name).sort();
    expect(functions).toEqual(['analyzeScale', 'analyzeScalePitchClasses']);
    expect([...new Set(scaleExamples.map((example) => example.name))].sort()).toEqual(functions);
    expect(scaleExamples.filter((example) => example.expectedError).map((example) => example.id)).toEqual(['scale-validation']);
  });

  it.each(scaleExamples)('runs $id through its registered public API with immutable arguments', async (example) => {
    const result = await invokeExample(example);
    if (example.expectedError) {
      expect(result).toMatchObject({ status: 'error', error: { name: 'ScaleInputError', code: 'INVALID_SCALE_INPUT', message: expect.any(String) } });
      return;
    }
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error(result.error.message);
    const analysis = result.value as ScaleAnalysisResult;
    expect(analysis.status).toBe('matched');
    expect(analysis.inputMode).toBe(example.name === 'analyzeScale' ? 'registered' : 'pitch-class');
    expect(analysis).not.toHaveProperty('primary');
    expect(analysis).not.toHaveProperty('key');
    for (const candidate of [...analysis.exactMatches, ...analysis.suggestions]) {
      expect(analysis.inputPitchClasses.every((pc) => candidate.pitchClasses.includes(pc))).toBe(true);
      expect(candidate.notes).toHaveLength(candidate.pitchClasses.length);
      expect(candidate.missingNotes).toHaveLength(candidate.missingPitchClasses.length);
      expect(candidate.match).toBe(candidate.missingNotes.length ? 'subset' : 'exact');
    }
  });

  it('provides complete bilingual scale-specific parameters, fields, errors, and FAQ', () => {
    const section = docsSections.find((item) => item.id === 'scale')!;
    expectBilingual(section.title);
    expectBilingual(section.summary);
    expect(section.title.zh).toContain(scaleMessages.zh.title);
    expect(section.title.en).toBe(scaleMessages.en.title);
    expect(SCALE_DEFINITIONS).toHaveLength(17);
    for (const example of scaleExamples) {
      [example.title, example.description, example.guidance].forEach(expectBilingual);
      expect(example.parameters?.map((item) => item.name.en)).toEqual([
        example.name === 'analyzeScale' ? 'notes' : 'pitchClasses', 'options', 'options.tonic', 'options.preferFlats',
      ]);
      for (const item of [...example.parameters!, ...example.responseFields!]) {
        [item.name, item.type, item.description].forEach(expectBilingual);
        if (item.defaultValue) expectBilingual(item.defaultValue);
        if (item.constraint) expectBilingual(item.constraint);
      }
      const fields = example.responseFields!.map((item) => item.name.en);
      if (example.expectedError) expect(fields).toEqual(['error.name', 'error.code', 'error.message']);
      else {
        expect(fields).toEqual([
          'status', 'inputMode', 'inputPitchClasses', 'exactMatches', 'suggestions',
          'candidate.id', 'candidate.scaleId', 'candidate.name', 'candidate.aliases', 'candidate.tonic',
          'candidate.tonicPitchClass', 'candidate.notes', 'candidate.pitchClasses', 'candidate.missingNotes',
          'candidate.missingPitchClasses', 'candidate.tonicMissing', 'candidate.match',
        ]);
        const catalog = example.responseFields!.find((item) => item.name.en === 'candidate.scaleId')!.constraint!;
        for (const definition of SCALE_DEFINITIONS) {
          expect(catalog.zh).toContain(definition.id);
          expect(catalog.en).toContain(definition.id);
        }
      }
      expect(example.errors!.some((item) => item.code.en.includes('INVALID_SCALE_INPUT'))).toBe(true);
      expect(example.errors!.some((item) => item.code.en.includes('ChordInputError'))).toBe(false);
      example.errors!.forEach((item) => [item.code, item.when, item.resolution].forEach(expectBilingual));
      expect(example.faq!.length).toBeGreaterThanOrEqual(8);
      example.faq!.forEach((item) => [item.question, item.answer].forEach(expectBilingual));
    }
  });

  it('keeps all seven CDEFGAB interpretations without a unique primary', async () => {
    const result = await resultFor('scale-ambiguity');
    expect(result.inputPitchClasses).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(result.exactMatches.map((candidate) => candidate.id)).toEqual([
      '0:major', '2:dorian', '4:phrygian', '5:lydian', '7:mixolydian', '9:naturalMinor', '11:locrian',
    ]);
    expect(result).not.toHaveProperty('primary');
  });

  it('returns untruncated CEG suggestions sorted by missing count, including absent A', async () => {
    const result = await resultFor('scale-suggestions');
    expect(result.exactMatches).toEqual([]);
    expect(result.suggestions.length).toBeGreaterThan(8);
    const counts = result.suggestions.map((candidate) => candidate.missingNotes.length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(result.suggestions.find((candidate) => candidate.id === '9:minorPentatonic')).toMatchObject({
      tonic: 'A', missingNotes: ['A', 'D'], missingPitchClasses: [9, 2], tonicMissing: true, match: 'subset',
    });
    expect(result.suggestions.some((candidate) => candidate.scaleId === 'chromatic')).toBe(false);
  });

  it('preserves E# in explicit F# major even with preferFlats enabled', async () => {
    const result = await resultFor('scale-f-sharp');
    expect(result.exactMatches.find((candidate) => candidate.scaleId === 'major')?.notes).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    expect(result.exactMatches.every((candidate) => candidate.tonic === 'F#')).toBe(true);
    const numeric = analyzeScalePitchClasses([6, 8, 10, 11, 1, 3, 5], { tonic: 6, preferFlats: true });
    expect(numeric.exactMatches.find((candidate) => candidate.scaleId === 'major')?.tonic).toBe('Gb');
  });

  it('retains all diminished, whole-tone, and chromatic symmetric interpretations', async () => {
    const diminished = await resultFor('scale-half-whole');
    expect(diminished.exactMatches.map((candidate) => candidate.id).sort()).toEqual([
      ...[0, 3, 6, 9].map((tonic) => `${tonic}:halfWholeDiminished`),
      ...[1, 4, 7, 10].map((tonic) => `${tonic}:wholeHalfDiminished`),
    ].sort());
    expect(analyzeScalePitchClasses([0, 2, 4, 6, 8, 10]).exactMatches).toHaveLength(6);
    const chromatic = await resultFor('scale-chromatic');
    expect(chromatic.exactMatches).toHaveLength(12);
    expect(chromatic.exactMatches.every((candidate) => candidate.scaleId === 'chromatic')).toBe(true);
    expect(chromatic.suggestions).toEqual([]);
    expect(analyzeScalePitchClasses([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toMatchObject({ status: 'no-match', exactMatches: [], suggestions: [] });
  });

  it('matches registered octave crossings and their true MIDI equivalents', async () => {
    const result = await resultFor('scale-registered');
    expect(result).toEqual(analyzeScale([60, 62, 64, 65, 67, 69, 71]));
    expect(analyzeScale(['B#3', 'Cb4', 'F##3'])).toEqual(analyzeScale([60, 59, 55]));
    expect(() => analyzeScale(['Cb-1', 'C4', 'E4'])).toThrow(ScaleInputError);
    expect(() => analyzeScale(['B#9', 'C4', 'E4'])).toThrow(ScaleInputError);
  });

  it('round-trips Unicode/ASCII double accidentals and candidate spellings', async () => {
    const result = await resultFor('scale-double-accidentals');
    const sharp = result.exactMatches.find((candidate) => candidate.id === '8:major')!;
    expect(sharp.notes).toContain('F##');
    const flat = analyzeScalePitchClasses(['D𝄫', 'E𝄫', 'F♭', 'G𝄫', 'A𝄫', 'B𝄫', 'C♭'], { tonic: 'Dbb' }).exactMatches.find((candidate) => candidate.scaleId === 'major')!;
    expect(flat.notes).toEqual(['Dbb', 'Ebb', 'Fb', 'Gbb', 'Abb', 'Bbb', 'Cb']);
    for (const candidate of [sharp, flat]) {
      const roundTrip = analyzeScalePitchClasses(candidate.notes, { tonic: candidate.tonic });
      expect(roundTrip.exactMatches.find((item) => item.id === candidate.id)).toEqual(candidate);
      const unicode = analyzeScalePitchClasses(candidate.notes.map(prettyNote), { tonic: prettyNote(candidate.tonic) });
      expect(unicode.exactMatches.find((item) => item.id === candidate.id)).toEqual(candidate);
    }
  });

  it('requires three distinct pitch classes and distinguishes the two numeric contracts', () => {
    expect(analyzeScale([60, 72, 64, 76])).toMatchObject({ status: 'insufficient-input', inputPitchClasses: [0, 4], exactMatches: [], suggestions: [] });
    expect(analyzeScalePitchClasses(['C', 'B#', 'E'])).toMatchObject({ status: 'insufficient-input', inputPitchClasses: [0, 4] });
    expect(analyzeScale([12, 16, 19]).inputPitchClasses).toEqual([0, 4, 7]);
    expect(() => analyzeScalePitchClasses([12, 16, 19])).toThrow(ScaleInputError);
    expect(() => analyzeScale(['C', 'E', 'G'])).toThrow(ScaleInputError);
    expect(() => analyzeScalePitchClasses(['C4', 'E4', 'G4'])).toThrow(ScaleInputError);
    expect(() => analyzeScale([60, 64, 67], { tonic: 'C4' })).toThrow(ScaleInputError);
  });
});

describe('Scale Docs tab', () => {
  it.each(['zh', 'en'] as const)('renders, runs, edits and resets %s examples without workspace, URL or audio side effects', async (locale) => {
    const workspace = { ...defaultWorkspace, notes: ['C3', 'E3', 'G3'], scaleTonic: 'F#', flats: true };
    saveWorkspace(workspace);
    history.replaceState(null, '', '/#' + encodeWorkspace(workspace));
    const initialStorage = { ...localStorage };
    const initialHash = location.hash;
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const storageRemove = vi.spyOn(Storage.prototype, 'removeItem');
    const storageClear = vi.spyOn(Storage.prototype, 'clear');
    const replace = vi.spyOn(history, 'replaceState');
    const push = vi.spyOn(history, 'pushState');
    const Audio = vi.fn();
    vi.stubGlobal('AudioContext', Audio);
    vi.stubGlobal('webkitAudioContext', Audio);
    const tx = t(locale);
    const { container } = render(<DocsTab locale={locale} />);
    const example = exampleById('scale-f-sharp');
    fireEvent.click(screen.getByText(example.title[locale], { selector: 'button' }));
    expect(screen.getByText("import { analyzeScalePitchClasses } from '@phishinqi/chordkit/scale'")).toBeTruthy();
    for (const title of [tx.docsParameters, tx.docsResponseFields, tx.docsErrors, tx.docsFaq]) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
    expect(screen.getByRole('rowheader', { name: 'options.tonic' })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'candidate.tonicMissing' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tx.run }));
    await screen.findByText(tx.docsSuccess);
    const readResult = () => JSON.parse(container.querySelector('.docs-result pre')!.textContent!);
    expect(readResult().exactMatches[0].notes).toContain('E#');

    fireEvent.change(screen.getByLabelText(tx.docsArgs), { target: { value: json([['C', 'E', 'G'], { tonic: 'A' }]) } });
    fireEvent.click(screen.getByRole('button', { name: tx.run }));
    await waitFor(() => expect(readResult().inputPitchClasses).toEqual([0, 4, 7]));
    expect(readResult().suggestions.some((candidate: { tonicMissing: boolean }) => candidate.tonicMissing)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: tx.docsReset }));
    expect((screen.getByLabelText(tx.docsArgs) as HTMLTextAreaElement).value).toBe(json(example.args));
    expect(container.querySelector('.docs-result')).toBeNull();

    fireEvent.click(screen.getByText(exampleById('scale-validation').title[locale], { selector: 'button' }));
    expect(screen.getByRole('heading', { name: tx.docsErrorFields })).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'error.code' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tx.run }));
    await screen.findByText(tx.docsExpectedError);
    expect(readResult()).toMatchObject({ status: 'error', error: { name: 'ScaleInputError', code: 'INVALID_SCALE_INPUT' } });

    expect(loadWorkspace()).toEqual(workspace);
    expect({ ...localStorage }).toEqual(initialStorage);
    expect(location.hash).toBe(initialHash);
    for (const write of [storageWrite, storageRemove, storageClear, replace, push, Audio]) expect(write).not.toHaveBeenCalled();
    expect(example.args).toEqual([['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'], { tonic: 'F#', preferFlats: true }]);
  });
});
