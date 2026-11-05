import React, { useMemo } from 'react';

// The 3x5 pixel font of the traefik-404 page (contrib/astr/make_brand.py), row-major,
// 15 bits per glyph. Characters not listed render as a blank cell.
const GLYPHS: Record<string, string> = {
  0: '111101101101111',
  1: '010110010010111',
  2: '111001111100111',
  3: '111001111001111',
  4: '101101111001001',
  5: '111100111001111',
  6: '111100111101111',
  7: '111001001010010',
  8: '111101111101111',
  9: '111101111001111',
  A: '010101111101101',
  B: '110101110101110',
  C: '011100100100011',
  D: '110101101101110',
  E: '111100110100111',
  F: '111100110100100',
  G: '011100101101011',
  H: '101101111101101',
  I: '111010010010111',
  J: '001001001101010',
  K: '101101110101101',
  L: '100100100100111',
  M: '101111111101101',
  N: '110101101101101',
  O: '010101101101010',
  P: '110101110100100',
  Q: '010101101110011',
  R: '110101110101101',
  S: '011100010001110',
  T: '111010010010010',
  U: '101101101101111',
  V: '101101101101010',
  W: '101101111111101',
  X: '101101010101101',
  Y: '101101010010010',
  Z: '111001010100111',
  '.': '000000000000010',
  ':': '000010000010000',
  '/': '001001010100100',
  '-': '000000111000000',
  '>': '100010001010100',
  '!': '010010010000010',
  '?': '111001010000010',
  '#': '101111101111101',
  ',': '000000000010100',
  '(': '010100100100010',
  ')': '010001001001010',
  '+': '000010111010000',
  '=': '000111000111000',
  '%': '101001010100101',
  _: '000000000000111',
};

const INK = '#DEFF5C';
const SHADE = '#061422';

type Rect = { x: number; y: number };

/** Pixels of `text` on a grid of 2 units per font pixel, 1 unit of gap for the shade. */
export const wordmarkPixels = (text: string): { rects: Rect[]; width: number; height: number } => {
  const chars = Array.from(text.toUpperCase());
  const rects: Rect[] = [];
  chars.forEach((ch, n) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    for (let r = 0; r < 5; r += 1) {
      for (let q = 0; q < 3; q += 1) {
        if (glyph[r * 3 + q] === '1') rects.push({ x: (n * 4 + q) * 2, y: r * 2 });
      }
    }
  });
  return { rects, width: Math.max(chars.length * 4 - 1, 1) * 2 + 1, height: 5 * 2 + 1 };
};

type PixelWordmarkProps = {
  text: string;
  className?: string;
  color?: string;
};
export function PixelWordmark({ text, className, color = INK }: PixelWordmarkProps) {
  const { rects, width, height } = useMemo(() => wordmarkPixels(text), [text]);
  const path = (dx: number) => rects.map(({ x, y }) => `M${x + dx} ${y + dx}h2v2h-2z`).join('');

  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      style={{ aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label={text}
    >
      <path d={path(1)} fill={SHADE} fillOpacity={0.85} />
      <path d={path(0)} fill={color} />
    </svg>
  );
}
