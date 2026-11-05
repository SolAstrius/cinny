import { find as linkifyFind } from 'linkifyjs';

export const QUIRK_PROFILE_KEY = 'ink.astrius.quirk';

export type QuirkCase = 'none' | 'upper' | 'lower' | 'alternate';
export const QUIRK_CASES: QuirkCase[] = ['none', 'upper', 'lower', 'alternate'];

export type Quirk = {
  color?: string;
  prefix: string;
  suffix: string;
  case: QuirkCase;
  replace: [string, string][];
};

export const QUIRK_MAX_AFFIX = 24;
export const QUIRK_MAX_PAIRS = 16;
export const QUIRK_MAX_FROM = 8;
export const QUIRK_MAX_TO = 8;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const isQuirkColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR.test(value);

const isAffix = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= QUIRK_MAX_AFFIX && !/[\n\r]/.test(value);

const isPair = (value: unknown): value is [string, string] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'string' &&
  typeof value[1] === 'string' &&
  value[0].length > 0 &&
  value[0].length <= QUIRK_MAX_FROM &&
  value[1].length <= QUIRK_MAX_TO &&
  !/[\n\r]/.test(value[0] + value[1]);

export const isQuirkEffective = (quirk: Quirk): boolean =>
  !!quirk.color ||
  quirk.prefix !== '' ||
  quirk.suffix !== '' ||
  quirk.case !== 'none' ||
  quirk.replace.length > 0;

/**
 * Strict parse of the `ink.astrius.quirk` profile field. Accepts the object itself
 * or a JSON string of it. Anything malformed is dropped field by field; an empty
 * result is treated as no quirk at all.
 */
export const parseQuirk = (raw: unknown): Quirk | undefined => {
  let value = raw;
  if (typeof value === 'string') {
    if (value.length > 4096) return undefined;
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const obj = value as Record<string, unknown>;

  const replace: [string, string][] = [];
  if (Array.isArray(obj.replace)) {
    obj.replace.slice(0, QUIRK_MAX_PAIRS).forEach((pair) => {
      if (isPair(pair)) replace.push([pair[0], pair[1]]);
    });
  }

  const quirk: Quirk = {
    color: isQuirkColor(obj.color) ? obj.color : undefined,
    prefix: isAffix(obj.prefix) ? obj.prefix : '',
    suffix: isAffix(obj.suffix) ? obj.suffix : '',
    case: QUIRK_CASES.includes(obj.case as QuirkCase) ? (obj.case as QuirkCase) : 'none',
    replace,
  };

  return isQuirkEffective(quirk) ? quirk : undefined;
};

export const serializeQuirk = (quirk: Quirk): Record<string, unknown> => ({
  ...(quirk.color ? { color: quirk.color } : {}),
  prefix: quirk.prefix,
  suffix: quirk.suffix,
  case: quirk.case,
  replace: quirk.replace,
});

export type QuirkCaseState = { letter: number };

const isLetter = (ch: string) => ch.toUpperCase() !== ch.toLowerCase();

const applyCase = (ch: string, mode: QuirkCase, state: QuirkCaseState): string => {
  if (mode === 'upper') return ch.toUpperCase();
  if (mode === 'lower') return ch.toLowerCase();
  if (mode === 'alternate' && isLetter(ch)) {
    const out = state.letter % 2 === 0 ? ch.toLowerCase() : ch.toUpperCase();
    // eslint-disable-next-line no-param-reassign
    state.letter += 1;
    return out;
  }
  return ch;
};

/**
 * Single left-to-right pass: at each position the longest matching replacement
 * key wins and its output is inserted literally; every other character goes
 * through the case mode. Replacements never chain into each other.
 */
export const transformQuirkString = (
  text: string,
  quirk: Quirk,
  state: QuirkCaseState = { letter: 0 }
): string => {
  const pairs = [...quirk.replace].sort((a, b) => b[0].length - a[0].length);
  const chars = Array.from(text);
  let out = '';
  let i = 0;
  while (i < chars.length) {
    let matched = false;
    for (let p = 0; p < pairs.length; p += 1) {
      const [from, to] = pairs[p];
      const fromChars = Array.from(from);
      if (chars.slice(i, i + fromChars.length).join('') === from) {
        out += to;
        i += fromChars.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += applyCase(chars[i], quirk.case, state);
      i += 1;
    }
  }
  return out;
};

export type QuirkSegment = { text: string; keep: boolean };

const MATRIX_ID_REG = /[@#!+][\w.=\-/]+:[\w.-]+(?::\d+)?/g;

/**
 * Split text into parts the quirk may change and parts it must leave alone
 * (links, emails, Matrix IDs), so linkification and mentions keep working.
 */
export const splitQuirkSegments = (text: string): QuirkSegment[] => {
  const ranges: [number, number][] = [];
  try {
    linkifyFind(text).forEach((m) => ranges.push([m.start, m.end]));
  } catch {
    // ignore
  }
  Array.from(text.matchAll(MATRIX_ID_REG)).forEach((m) => {
    if (m.index !== undefined) ranges.push([m.index, m.index + m[0].length]);
  });
  ranges.sort((a, b) => a[0] - b[0]);

  const segments: QuirkSegment[] = [];
  let cursor = 0;
  ranges.forEach(([start, end]) => {
    if (start < cursor) {
      if (end > cursor) {
        const last = segments[segments.length - 1];
        if (last?.keep) last.text += text.slice(cursor, end);
        cursor = end;
      }
      return;
    }
    if (start > cursor) segments.push({ text: text.slice(cursor, start), keep: false });
    segments.push({ text: text.slice(start, end), keep: true });
    cursor = end;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), keep: false });
  return segments;
};

export const QUIRK_PRESETS: { name: string; quirk: Quirk }[] = [
  {
    name: 'Comet',
    quirk: { color: '#ffd27f', prefix: '', suffix: ' ☄', case: 'none', replace: [['o', '°']] },
  },
  {
    name: 'Whisper',
    quirk: {
      color: '#a9b8d8',
      prefix: '( ',
      suffix: ' )',
      case: 'lower',
      replace: [
        ['!', '.'],
        ['?', '..?'],
      ],
    },
  },
  {
    name: 'Static',
    quirk: {
      color: '#7ef0c8',
      prefix: '> ',
      suffix: '',
      case: 'lower',
      replace: [
        ['t', '+'],
        ['l', '|'],
      ],
    },
  },
  {
    name: 'Ember',
    quirk: { color: '#ff8a5c', prefix: '~', suffix: '~', case: 'upper', replace: [['s', '$']] },
  },
];
