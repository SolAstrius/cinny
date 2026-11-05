import { globalStyle, style } from '@vanilla-extract/css';
import { config } from 'folds';

// astr.to: the 404's panels are square-cornered; keep only a hint of rounding.
globalStyle('.night-theme', {
  vars: {
    [config.radii.R300]: '2px',
    [config.radii.R400]: '3px',
    [config.radii.R500]: '4px',
  },
  backgroundColor: '#0C1E3A',
  backgroundImage: 'url(/public/res/astr/sky.png)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed',
  imageRendering: 'pixelated',
  '@media': {
    '(orientation: portrait)': { backgroundImage: 'url(/public/res/astr/sky-tall.png)' },
  },
});
// images inside the app keep smooth scaling; only the sky is pixelated
globalStyle('.night-theme img, .night-theme video, .night-theme canvas', {
  imageRendering: 'auto',
});

const DESKTOP = 'screen and (min-width: 750px)';
const GAP = '14px';

// The client shell: panels float over the sky with gaps between them.
export const AstrShell = style({});
globalStyle(`.night-theme ${AstrShell}`, {
  '@media': { [DESKTOP]: { padding: GAP, gap: GAP } },
});

export const AstrRow = style({});
globalStyle(`.night-theme ${AstrRow}`, {
  '@media': { [DESKTOP]: { gap: GAP } },
});

// One floating panel: translucent shade, teal hairline, hard pixel shadow,
// square corners — no rounding, no notches.
export const AstrPanel = style({});
globalStyle(`.night-theme ${AstrPanel}`, {
  backgroundColor: 'rgba(10, 24, 46, 0.72)',
  '@media': {
    [DESKTOP]: {
      border: '1px solid rgba(88, 208, 188, 0.28)',
      borderRadius: 0,
    },
  },
});
// the main reading surface is a touch more opaque
export const AstrPanelMain = style({});
globalStyle(`.night-theme ${AstrPanelMain}`, {
  backgroundColor: 'rgba(12, 30, 58, 0.84)',
});

// The rail: transparent column holding two panels; the hole between them is sky.
export const AstrRail = style({});
globalStyle(`.night-theme ${AstrRail}`, {
  backgroundColor: 'transparent',
  '@media': { [DESKTOP]: { gap: GAP } },
});
export const AstrRailPart = style({ flex: '0 1 auto', minHeight: 0 });
export const AstrHole = style({ flex: '1 1 0', minHeight: 0 });
// On narrow screens nothing floats (no gaps around the panels), so a hole of raw sky in the
// rail reads as a rendering defect: fill it with the panel shade there.
globalStyle(`.night-theme ${AstrHole}`, {
  backgroundColor: 'rgba(10, 24, 46, 0.72)',
  '@media': { [DESKTOP]: { backgroundColor: 'transparent' } },
});
