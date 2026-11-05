import { style } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

// astr.to: pixel starfield tile instead of the dot grid.
export const BackgroundDotPattern = style({
  backgroundColor: color.Background.Container,
  backgroundImage: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' shape-rendering='crispEdges'><rect x='12' y='18' width='2' height='2' fill='%23ece8d6'/><rect x='70' y='6' width='2' height='2' fill='%238f8dab'/><rect x='110' y='40' width='2' height='2' fill='%23ece8d6'/><rect x='40' y='64' width='2' height='2' fill='%234b4d7a'/><rect x='92' y='88' width='2' height='2' fill='%238f8dab'/><rect x='20' y='108' width='2' height='2' fill='%23ece8d6'/><rect x='130' y='120' width='2' height='2' fill='%234b4d7a'/><rect x='150' y='20' width='2' height='2' fill='%234b4d7a'/><rect x='60' y='140' width='2' height='2' fill='%238f8dab'/><rect x='144' y='72' width='2' height='2' fill='%23ece8d6'/><rect x='100' y='128' width='2' height='2' fill='%23ffce54'/><rect x='98' y='130' width='2' height='2' fill='%23ffce54'/><rect x='100' y='130' width='2' height='2' fill='%23ffce54'/><rect x='102' y='130' width='2' height='2' fill='%23ffce54'/><rect x='100' y='132' width='2' height='2' fill='%23ffce54'/></svg>")`,
  backgroundSize: `${toRem(160)} ${toRem(160)}`,
  imageRendering: 'pixelated',
});
