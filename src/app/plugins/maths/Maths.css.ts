import { globalStyle, style } from '@vanilla-extract/css';
import { config } from 'folds';

export const MathsInline = style({
  fontSize: '1.1em',
  lineHeight: 'normal',
});

export const MathsDisplay = style({
  display: 'block',
  margin: `${config.space.S200} 0`,
  padding: `${config.space.S100} 0`,
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  fontSize: '1.15em',
  selectors: {
    '&:first-child': {
      marginTop: 0,
    },
    '&:last-child': {
      marginBottom: 0,
    },
  },
});

globalStyle(`${MathsDisplay} math`, {
  width: 'max-content',
  minWidth: '100%',
});

export const MathsFallback = style({
  cursor: 'help',
});
