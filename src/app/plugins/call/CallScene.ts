import { MatrixClient, MatrixEvent, Room, RoomStateEvent } from 'matrix-js-sdk';
import { trimTrailingSlash } from '../../utils/common';

/**
 * astr.to: a room's `ink.astrius.room.scene` state event sets an animated pixel scene that is drawn
 * behind Element Call's tiles. The scenes are static pages under /public/scenes; the event content
 * becomes their URL fragment. Only known scene names and numeric/boolean parameters are passed on.
 */
export const SCENE_EVENT_TYPE = 'ink.astrius.room.scene';
export const SCENES = ['rain', 'aurora', 'harbour', 'space'] as const;

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
  (bars, f) => bars.map((h, i) => `<rect x="${f * 9 + 1 + i * 3}" y="${8 - h}" width="2" height="${h}" fill="#58d0bc"/>`).join('')
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
  if (typeof c.scene !== 'string' || !(SCENES as readonly string[]).includes(c.scene)) return undefined;
  const params = new URLSearchParams();
  Object.entries(c).forEach(([k, v]) => {
    if (k === 'scene' || !/^[a-z][a-z0-9]{0,23}$/i.test(k)) return;
    if (typeof v === 'number' && Number.isFinite(v)) params.set(k, String(v));  // integer percentages; kit.js scales
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
    Object.assign(callFrame.style, { position: 'relative', zIndex: '1', background: 'transparent' });
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
