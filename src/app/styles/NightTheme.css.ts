import { globalStyle } from '@vanilla-extract/css';
import { config } from 'folds';

// astr.to: the 404's panels are square-cornered; keep only a hint of rounding.
globalStyle('.night-theme', {
  vars: {
    [config.radii.R300]: '2px',
    [config.radii.R400]: '3px',
    [config.radii.R500]: '4px',
  },
});
