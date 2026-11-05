import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export const Welcome = style({
  margin: 'auto',
  padding: toRem(32),
  maxWidth: toRem(720),
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: MONO,
  color: '#B8FFDE',
  textShadow: '0 1px 0 #061422',
});
export const Wordmark = style({
  display: 'block',
  height: 'clamp(3rem, 8vw, 6.5rem)',
  width: 'auto',
  maxWidth: '100%',
  imageRendering: 'pixelated',
});
export const Rule = style({
  height: toRem(6),
  width: 'min(100%, 18rem)',
  margin: `${toRem(16)} 0 ${toRem(12)}`,
  backgroundImage: 'linear-gradient(90deg, #DEFF5C 50%, transparent 50%)',
  backgroundSize: `${toRem(12)} ${toRem(6)}`,
});
export const Line = style({ margin: 0, fontSize: toRem(15) });
export const Prompt = style({ margin: `${toRem(28)} 0 0`, fontSize: toRem(13), opacity: 0.8 });
export const Source = style({
  display: 'inline-block',
  marginTop: toRem(10),
  fontSize: toRem(12),
  color: '#FF8FCB',
  opacity: 0.8,
});
