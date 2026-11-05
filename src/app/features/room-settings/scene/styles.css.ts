import { globalStyle, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

const TEAL = '#58d0bc';
const SKY = '#0a142e';

// The preview: the scene at 16:9 across the whole page width, behind a teal hairline.
export const Preview = style({
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 9',
  backgroundColor: SKY,
  border: `1px solid rgba(88, 208, 188, 0.35)`,
  overflow: 'hidden',
});

export const PreviewFrame = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 'none',
  pointerEvents: 'none',
});

export const PreviewEmpty = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: config.space.S400,
});

export const PreviewBadge = style({
  position: 'absolute',
  left: config.space.S200,
  top: config.space.S200,
  padding: `${config.space.S100} ${config.space.S200}`,
  backgroundColor: 'rgba(8, 12, 32, 0.78)',
  color: '#e6f1ff',
});

export const Tiles = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: config.space.S300,
  '@media': {
    'screen and (max-width: 750px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
  },
});

export const Tile = style({
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S100,
  padding: 0,
  border: `2px solid transparent`,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  selectors: {
    '&:hover:not(:disabled)': { borderColor: 'rgba(88, 208, 188, 0.45)' },
    '&:focus-visible': { outline: `2px solid ${TEAL}`, outlineOffset: 2 },
    '&[aria-pressed=true]': { borderColor: TEAL },
    '&:disabled': { cursor: 'default', opacity: 0.6 },
    '&[aria-pressed=true]:disabled': { opacity: 1 },
  },
});

export const TileImage = style({
  display: 'block',
  width: '100%',
  aspectRatio: '16 / 9',
  objectFit: 'cover',
  backgroundColor: SKY,
});
globalStyle(`${TileImage}`, { imageRendering: 'pixelated' });
globalStyle(`.night-theme ${TileImage}`, { imageRendering: 'pixelated' });

export const TileLabel = style({
  padding: `0 ${config.space.S200} ${config.space.S200}`,
});

// Flat pixel slider: a thin teal-tinted track and a square teal thumb, no rounding, no fill gradient.
const THUMB = { width: 10, height: 18, border: 'none', borderRadius: 0, backgroundColor: TEAL };
export const Slider = style({
  appearance: 'none',
  width: '100%',
  minWidth: toRem(120),
  height: 18,
  margin: 0,
  background: 'transparent',
  cursor: 'pointer',
  selectors: {
    '&:disabled': { cursor: 'default' },
    '&:focus-visible': { outline: `2px solid ${TEAL}`, outlineOffset: 4 },
    '&::-webkit-slider-runnable-track': {
      height: 6,
      backgroundColor: 'rgba(88, 208, 188, 0.16)',
      border: '1px solid rgba(88, 208, 188, 0.4)',
    },
    '&::-webkit-slider-thumb': { ...THUMB, appearance: 'none', marginTop: -7 },
    '&:disabled::-webkit-slider-thumb': { backgroundColor: '#5d6b80' },
    '&::-moz-range-track': {
      height: 6,
      backgroundColor: 'rgba(88, 208, 188, 0.16)',
      border: '1px solid rgba(88, 208, 188, 0.4)',
    },
    '&::-moz-range-thumb': THUMB,
    '&:disabled::-moz-range-thumb': { backgroundColor: '#5d6b80' },
  },
});

export const PreviewExpand = style({
  position: 'absolute',
  right: config.space.S200,
  top: config.space.S200,
});

export const NumberInput = style({
  width: toRem(84),
});

export const SeedInput = style({
  width: toRem(120),
});
