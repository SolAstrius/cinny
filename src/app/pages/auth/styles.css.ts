import { globalStyle, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

// astr.to sign-in, in the language of the catch-all 404 ("No route to host"):
// nebula sky, square shade panels, acid beacon, mint mono ink, magenta links.
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const INK = '#B8FFDE';
const ACID = '#DEFF5C';
const PINK = '#FF60B6';
const SHADE = '#061422';
const PANEL = 'rgba(6, 20, 34, 0.84)';
const EDGE = 'rgba(88, 208, 188, 0.35)';

export const AuthLayout = style({
  minHeight: '100vh',
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  color: INK,
  fontFamily: MONO,
  textShadow: `0 1px 0 ${SHADE}`,
});

export const Hud = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1em',
  padding: `${toRem(10)} ${toRem(14)}`,
  fontSize: toRem(12),
  opacity: 0.85,
});
export const HudDim = style({ opacity: 0.5 });
export const HudStatus = style({
  color: INK,
  selectors: {
    '&[data-status="online"]': { color: ACID },
    '&[data-status="unreachable"]': { color: PINK },
  },
});

export const Stage = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 26rem)',
  alignItems: 'center',
  gap: 'clamp(2rem, 6vw, 7rem)',
  padding: 'clamp(1rem, 5vw, 6rem)',
  maxWidth: toRem(1280),
  width: '100%',
  margin: '0 auto',
  boxSizing: 'border-box',
  '@media': {
    'screen and (max-width: 820px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      alignItems: 'start',
      gap: '1.5rem',
      padding: `${toRem(8)} ${toRem(16)} ${toRem(24)}`,
    },
  },
});

export const Hero = style({ minWidth: 0 });
export const HeroWordmark = style({
  display: 'block',
  height: 'clamp(3.5rem, 11vw, 9rem)',
  width: 'auto',
  maxWidth: '100%',
  imageRendering: 'pixelated',
});
export const HeroRule = style({
  height: toRem(6),
  width: 'min(100%, 22rem)',
  margin: `${toRem(18)} 0 ${toRem(14)}`,
  backgroundImage: `linear-gradient(90deg, ${ACID} 50%, transparent 50%)`,
  backgroundSize: `${toRem(12)} ${toRem(6)}`,
  opacity: 0.9,
  '@media': {
    'screen and (max-width: 820px)': { margin: `${toRem(12)} 0 ${toRem(10)}` },
  },
});
export const HeroTagline = style({
  margin: 0,
  fontSize: 'clamp(0.85rem, 1.6vw, 1.1rem)',
  color: INK,
});

export const Console = style({
  background: PANEL,
  border: `1px solid ${EDGE}`,
  boxShadow: `6px 6px 0 rgba(6, 20, 34, 0.55)`,
  color: INK,
  minWidth: 0,
});
export const ConsoleBar = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(10),
  padding: `${toRem(8)} ${toRem(12)}`,
  borderBottom: `1px solid ${EDGE}`,
  fontSize: toRem(12),
  opacity: 0.9,
});
export const ConsoleLogo = style({
  width: toRem(20),
  height: toRem(20),
  imageRendering: 'pixelated',
});
export const ConsoleBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(16),
  padding: toRem(18),
});
export const ConsoleStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(16),
});
export const ConsoleNote = style({
  margin: 0,
  fontSize: toRem(13),
  opacity: 0.85,
});

export const Prompt = style({
  display: 'grid',
  gridTemplateColumns: `${toRem(118)} minmax(0, 1fr)`,
  alignItems: 'center',
  gap: toRem(8),
  fontSize: toRem(13),
});
export const PromptKey = style({ color: INK, opacity: 0.8, whiteSpace: 'nowrap' });
export const PromptValue = style({ minWidth: 0 });
export const PromptText = style({ color: ACID });

export const EnterStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(10),
});
export const EnterButton = style({
  display: 'block',
  padding: `${toRem(14)} ${toRem(16)}`,
  background: ACID,
  color: '#0C1E3A',
  textShadow: 'none',
  textAlign: 'center',
  textDecoration: 'none',
  textTransform: 'uppercase',
  fontWeight: 700,
  fontSize: toRem(15),
  boxShadow: `4px 4px 0 ${SHADE}`,
  transition: 'transform 60ms steps(1), box-shadow 60ms steps(1)',
  selectors: {
    '&:hover': { transform: 'translate(-1px, -1px)', boxShadow: `5px 5px 0 ${SHADE}` },
    '&:active': { transform: 'translate(3px, 3px)', boxShadow: `1px 1px 0 ${SHADE}` },
    '&:focus-visible': { outline: `2px solid ${PINK}`, outlineOffset: toRem(3) },
  },
});

export const Fold = style({
  borderTop: `1px dashed ${EDGE}`,
  paddingTop: toRem(12),
});
export const FoldSummary = style({
  cursor: 'pointer',
  fontSize: toRem(13),
  listStyle: 'none',
  opacity: 0.85,
  selectors: {
    '&::-webkit-details-marker': { display: 'none' },
    '&:hover': { color: ACID, opacity: 1 },
  },
});
export const FoldBody = style({
  paddingTop: toRem(14),
  display: 'flex',
  flexDirection: 'column',
});

export const AuthFooter = style({
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1em',
  padding: `${toRem(8)} ${toRem(12)}`,
  fontSize: toRem(12),
  opacity: 0.7,
});
globalStyle(`${AuthFooter} a`, { color: INK });
globalStyle(`${AuthFooter} a:hover`, { color: ACID });
globalStyle(`${Console} a`, { color: PINK });
globalStyle(`${Console} a${EnterButton}`, { color: '#0C1E3A' });
globalStyle(`${Console} label`, { fontFamily: MONO, color: INK, opacity: 0.8 });
globalStyle(`${Console} input`, { fontFamily: MONO });

// kept for the register / reset-password pages that still use them
export const AuthCard = style({ width: '100%' });
export const AuthLogo = style({ width: toRem(32), height: toRem(32), imageRendering: 'pixelated' });
export const AuthHeader = style({ padding: `0 ${config.space.S400}` });
export const AuthCardContent = style({ width: '100%', gap: toRem(24) });
export const AuthWordmark = style({ height: toRem(30), imageRendering: 'pixelated' });
export const AuthErrorText = style({ color: color.Critical.Main });
