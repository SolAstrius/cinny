import type { MathsRender } from './temml';

export type { MathsRender };

type RenderTex = (tex: string, display: boolean) => MathsRender;

let renderTex: RenderTex | undefined;
let loading: Promise<RenderTex> | undefined;

const CACHE_LIMIT = 500;
const cache = new Map<string, MathsRender>();

/** Loads Temml and its stylesheet on first use; later calls share the same promise. */
export const loadMaths = (): Promise<RenderTex> => {
  if (!loading) {
    loading = import('./temml').then((m) => {
      renderTex = m.renderTex;
      return m.renderTex;
    });
    loading.catch(() => {
      loading = undefined;
    });
  }
  return loading;
};

/** Renders synchronously when Temml is already loaded, otherwise returns undefined. */
export const renderMathsSync = (tex: string, display: boolean): MathsRender | undefined => {
  const key = `${display ? 'd' : 'i'}:${tex}`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (!renderTex) return undefined;
  const result = renderTex(tex, display);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, result);
  return result;
};
