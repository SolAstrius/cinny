import { style } from '@vanilla-extract/css';

// astr.to: the 404's nebula sky (contrib/astr/make_brand.py), scaled up crisp.
export const BackgroundDotPattern = style({
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
