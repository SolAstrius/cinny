import temml from 'temml';
import './temml.css';

export type MathsRender = { html: string } | { error: string };

export const MAX_TEX_LENGTH = 4000;

export const renderTex = (tex: string, display: boolean): MathsRender => {
  if (tex.length > MAX_TEX_LENGTH) return { error: 'Formula is too long to render' };
  try {
    const html = temml.renderToString(tex, {
      displayMode: display,
      throwOnError: true,
      trust: false,
      strict: false,
      maxExpand: 500,
    });
    return { html };
  } catch (e) {
    return { error: (e instanceof Error ? e.message : String(e)).trim() };
  }
};
