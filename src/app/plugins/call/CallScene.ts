import { MatrixClient, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
import { trimTrailingSlash } from '../../utils/common';

/**
 * astr.to: a room's `ink.astrius.room.scene` state event sets an animated pixel scene that is drawn
 * behind Element Call's tiles. The scenes are static pages under /public/scenes; the event content
 * becomes their URL fragment. Only known scene names and numeric/boolean parameters are passed on.
 */
export const SCENE_EVENT_TYPE = 'ink.astrius.room.scene';
export const SCENES = ['rain', 'aurora', 'harbour', 'space'] as const;
export type SceneName = typeof SCENES[number];

export type SceneNumberParam = {
  kind: 'number';
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  default: number;
};
export type SceneBooleanParam = {
  kind: 'boolean';
  key: string;
  label: string;
  description: string;
  default: boolean;
};
export type SceneParam = SceneNumberParam | SceneBooleanParam;
export type SceneContent = { scene: SceneName } & Record<string, number | boolean | string>;

export const SCENE_SEED_MAX = 99999;

// One place for every scene's parameters and defaults: the settings page, the call menu and the
// /scene command all read this. Values are integers (canonical JSON has no floats); fractional
// settings are percentages that kit.js divides by 100. Defaults match each page's EVENT.content.
export const SCENE_INFO: Record<
  SceneName,
  { label: string; description: string; seed: number; params: SceneParam[] }
> = {
  rain: {
    label: 'Rain',
    description: 'A city skyline at night under rain clouds, with lightning.',
    seed: 1105,
    params: [
      {
        kind: 'number',
        key: 'intensity',
        label: 'Intensity',
        description: 'How hard it rains.',
        min: 0,
        max: 100,
        default: 70,
      },
      {
        kind: 'number',
        key: 'wind',
        label: 'Wind',
        description: 'Slant of the rain; negative blows left.',
        min: -100,
        max: 100,
        default: -35,
      },
      {
        kind: 'boolean',
        key: 'lightning',
        label: 'Lightning',
        description: 'Strikes that light up the clouds.',
        default: true,
      },
    ],
  },
  aurora: {
    label: 'Aurora',
    description: 'Northern lights over a fjord, pines and a cabin.',
    seed: 2611,
    params: [
      {
        kind: 'number',
        key: 'intensity',
        label: 'Intensity',
        description: 'Brightness and reach of the aurora.',
        min: 0,
        max: 100,
        default: 80,
      },
      {
        kind: 'boolean',
        key: 'snow',
        label: 'Snow',
        description: 'Snowfall and chimney smoke.',
        default: true,
      },
    ],
  },
  harbour: {
    label: 'Harbour',
    description: 'A moonlit headland with a lighthouse, boats and drifting clouds.',
    seed: 3107,
    params: [
      {
        kind: 'number',
        key: 'clouds',
        label: 'Clouds',
        description: 'How much of the sky is covered.',
        min: 0,
        max: 100,
        default: 50,
      },
      {
        kind: 'number',
        key: 'wind',
        label: 'Wind',
        description: 'Cloud drift; negative drifts left.',
        min: -100,
        max: 100,
        default: 25,
      },
      {
        kind: 'boolean',
        key: 'beam',
        label: 'Lighthouse beam',
        description: 'The rotating beam of light.',
        default: true,
      },
    ],
  },
  space: {
    label: 'Space',
    description: 'Parallax stars, a nebula and a ringed planet.',
    seed: 4404,
    params: [
      {
        kind: 'number',
        key: 'speed',
        label: 'Speed',
        description: 'Star drift speed; 100 is normal.',
        min: 0,
        max: 300,
        default: 100,
      },
      {
        kind: 'boolean',
        key: 'comet',
        label: 'Comet',
        description: 'A comet now and then.',
        default: true,
      },
    ],
  },
};

export const isSceneName = (name: unknown): name is SceneName =>
  typeof name === 'string' && (SCENES as readonly string[]).includes(name);

export const SCENE_DEFAULTS: Record<SceneName, SceneContent> = Object.fromEntries(
  SCENES.map((name) => {
    const info = SCENE_INFO[name];
    const content: SceneContent = { scene: name };
    info.params.forEach((p) => {
      content[p.key] = p.default;
    });
    content.seed = info.seed;
    return [name, content];
  })
) as Record<SceneName, SceneContent>;

const clampInt = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(v)));

/**
 * A complete, valid content for `name`: known params from `base` (when it is the same scene) over
 * the defaults, numbers rounded and clamped. Unknown keys are dropped.
 */
export function sceneContent(name: SceneName, base?: unknown): SceneContent {
  const b =
    base && typeof base === 'object' && (base as Record<string, unknown>).scene === name
      ? (base as Record<string, unknown>)
      : {};
  const content: SceneContent = { ...SCENE_DEFAULTS[name] };
  SCENE_INFO[name].params.forEach((p) => {
    const v = b[p.key];
    if (p.kind === 'number' && typeof v === 'number' && Number.isFinite(v)) {
      content[p.key] = clampInt(v, p.min, p.max);
    }
    if (p.kind === 'boolean' && typeof v === 'boolean') content[p.key] = v;
  });
  if (typeof b.seed === 'number' && Number.isFinite(b.seed)) {
    content.seed = clampInt(b.seed, 0, SCENE_SEED_MAX);
  }
  return content;
}

export const randomSceneSeed = () => 1 + Math.floor(Math.random() * SCENE_SEED_MAX);

const STYLE_ID = 'astr-scene-style';

// "Speaking" as a pixel equalizer next to the name instead of Element Call's gradient-filled tile:
// a 4-frame sprite (9x8 px per frame, three 2-px bars), stepped, drawn at 2x.
const EQ_FRAMES = [
  [3, 6, 4],
  [5, 3, 7],
  [7, 5, 3],
  [4, 7, 5],
];
const EQ_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="8" shape-rendering="crispEdges">${EQ_FRAMES.map(
  (bars, f) =>
    bars
      .map(
        (h, i) =>
          `<rect x="${f * 9 + 1 + i * 3}" y="${8 - h}" width="2" height="${h}" fill="#58d0bc"/>`
      )
      .join('')
).join('')}</svg>`;
const EQ_URL = `url("data:image/svg+xml,${encodeURIComponent(EQ_SVG)}")`;

// Element Call paints an opaque canvas colour on <body>, a grey on every tile and gradients on the
// speaking/hand-raised tiles and the header/footer fades. With a scene set: transparent body,
// translucent tiles, no gradients, and the equalizer marks who is talking. The hashed class names
// belong to the pinned @element-hq/element-call-embedded 0.20.1; recheck them when it is upgraded.
const CALL_CSS = `
html, body, #root { background: transparent !important; }
:root, [class*=cpd-theme-] { --video-tile-background: rgba(5, 9, 26, 0.42) !important; }
[class*="_tile_"][class*="_speaking_"] { outline: none !important; }
[class*="_tile_"][class*="_speaking_"]::before { background: none !important; opacity: 0 !important; }
[class*="_tile_"][class*="_handRaised_"]::before { background: rgba(214, 160, 40, 0.3) !important; }
[class*="_header_15f4n_"], [class*="_buttonBar_1mrho_"], [class*="_bar_1lobl_"]::before { background: none !important; }
[class*="_nameTag_"] { background-color: rgba(8, 12, 32, 0.72) !important; }
[class*="_speaking_"] [class*="_nameTag_"]::after {
  content: ""; flex-shrink: 0; width: 18px; height: 16px; margin-inline: 2px 6px;
  background: ${EQ_URL} 0 0 / 72px 16px no-repeat; image-rendering: pixelated;
  animation: astr-eq 0.6s steps(4) infinite;
}
@keyframes astr-eq { to { background-position: -72px 0; } }
`;

export function sceneUrl(content: unknown, version: string): string | undefined {
  if (!content || typeof content !== 'object') return undefined;
  const c = content as Record<string, unknown>;
  if (!isSceneName(c.scene)) return undefined;
  const params = new URLSearchParams();
  Object.entries(c).forEach(([k, v]) => {
    if (k === 'scene' || !/^[a-z][a-z0-9]{0,23}$/i.test(k)) return;
    if (typeof v === 'number' && Number.isFinite(v))
      params.set(k, String(v)); // integer percentages; kit.js scales
    else if (typeof v === 'boolean') params.set(k, v ? '1' : '0');
  });
  // the query changes with the event so an edited scene reloads (a fragment change alone would not)
  const base = trimTrailingSlash(import.meta.env.BASE_URL);
  return `${base}/public/scenes/${c.scene}.html?v=${encodeURIComponent(version)}#${params}`;
}

export class CallScene {
  private frame?: HTMLIFrameElement;

  private readonly onStateEvent = (ev: MatrixEvent) => {
    if (ev.getRoomId() === this.room.roomId && ev.getType() === SCENE_EVENT_TYPE) this.apply();
  };

  private readonly onCallLoad = () => this.styleCall();

  constructor(
    private readonly mx: MatrixClient,
    private readonly room: Room,
    private readonly container: HTMLElement,
    private readonly callFrame: HTMLIFrameElement
  ) {
    Object.assign(callFrame.style, {
      position: 'relative',
      zIndex: '1',
      background: 'transparent',
    });
    callFrame.addEventListener('load', this.onCallLoad);
    mx.on(RoomStateEvent.Events, this.onStateEvent);
    this.apply();
  }

  private currentUrl(): string | undefined {
    const ev = this.room.currentState.getStateEvents(SCENE_EVENT_TYPE, '');
    return ev ? sceneUrl(ev.getContent(), ev.getId() ?? '0') : undefined;
  }

  private apply() {
    const url = this.currentUrl();
    if (url) {
      if (!this.frame) {
        const f = document.createElement('iframe');
        f.title = 'Call scene';
        f.sandbox.value = 'allow-scripts';
        f.setAttribute('aria-hidden', 'true');
        f.tabIndex = -1;
        Object.assign(f.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          border: 'none',
          pointerEvents: 'none',
          zIndex: '0',
        });
        this.container.prepend(f);
        this.frame = f;
      }
      if (this.frame.dataset.src !== url) {
        this.frame.dataset.src = url;
        this.frame.src = url;
      }
    } else if (this.frame) {
      this.frame.remove();
      this.frame = undefined;
    }
    this.styleCall();
  }

  private styleCall() {
    const doc = this.callFrame.contentDocument;
    if (!doc?.head) return;
    const existing = doc.getElementById(STYLE_ID);
    if (this.frame && !existing) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CALL_CSS;
      doc.head.appendChild(style);
    } else if (!this.frame && existing) {
      existing.remove();
    }
  }

  public dispose() {
    this.mx.off(RoomStateEvent.Events, this.onStateEvent);
    this.callFrame.removeEventListener('load', this.onCallLoad);
    this.frame?.remove();
    this.frame = undefined;
  }
}
