import {
  isSceneName,
  randomSceneSeed,
  SCENE_INFO,
  SCENE_SEED_MAX,
  SceneContent,
  sceneContent,
  SCENES,
} from './CallScene';

export const SCENE_COMMAND_USAGE = `/scene ${SCENES.join('|')}|off [key=value ...]`;

const OFF_WORDS = ['off', 'none', 'remove', 'clear'];
const TRUE_WORDS = ['on', 'true', 'yes', '1'];
const FALSE_WORDS = ['off', 'false', 'no', '0'];

/** `rain intensity=70 wind=-35 lightning=on seed=1105` */
export const describeScene = (content: SceneContent): string => {
  const info = SCENE_INFO[content.scene];
  const params = info.params.map((p) => {
    const v = content[p.key];
    if (typeof v === 'boolean') return `${p.key}=${v ? 'on' : 'off'}`;
    return `${p.key}=${v}`;
  });
  return [content.scene, ...params, `seed=${content.seed}`].join(' ');
};

export type SceneCommand =
  | { action: 'show' }
  | { action: 'off' }
  | { action: 'set'; content: SceneContent };

/**
 * Parses the payload of `/scene`. A scene name starts from that scene's current settings when it is
 * the one already set, from its defaults otherwise; `key=value` pairs alone edit the current scene.
 * Throws an Error with a user-facing message on anything invalid.
 */
export function parseSceneCommand(
  payload: string,
  current: SceneContent | undefined
): SceneCommand {
  const words = payload.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { action: 'show' };

  const first = words[0].toLowerCase();
  if (OFF_WORDS.includes(first)) {
    if (words.length > 1) throw new Error(`"/scene ${first}" takes no settings.`);
    return { action: 'off' };
  }

  let base: SceneContent;
  let pairs: string[];
  if (first.includes('=')) {
    if (!current) {
      throw new Error(`No scene is set. Name one first: ${SCENE_COMMAND_USAGE}`);
    }
    base = current;
    pairs = words;
  } else {
    if (!isSceneName(first)) {
      throw new Error(`Unknown scene "${words[0]}". Scenes: ${SCENES.join(', ')}, or off.`);
    }
    base = sceneContent(first, current);
    pairs = words.slice(1);
  }

  const info = SCENE_INFO[base.scene];
  const content: SceneContent = { ...base };
  const keys = [...info.params.map((p) => p.key), 'seed'];

  pairs.forEach((pair) => {
    const match = pair.match(/^([a-z]+)=(.*)$/i);
    if (!match) throw new Error(`Expected key=value, got "${pair}".`);
    const key = match[1].toLowerCase();
    const raw = match[2].toLowerCase();

    if (key === 'seed') {
      if (raw === 'random' || raw === 'shuffle') {
        content.seed = randomSceneSeed();
        return;
      }
      const n = Number(raw);
      if (!/^\d+$/.test(raw) || n > SCENE_SEED_MAX) {
        throw new Error(`seed must be a whole number from 0 to ${SCENE_SEED_MAX}, or random.`);
      }
      content.seed = n;
      return;
    }

    const param = info.params.find((p) => p.key === key);
    if (!param) {
      throw new Error(`${info.label} has no "${key}". Settings: ${keys.join(', ')}.`);
    }
    if (param.kind === 'boolean') {
      if (TRUE_WORDS.includes(raw)) content[key] = true;
      else if (FALSE_WORDS.includes(raw)) content[key] = false;
      else throw new Error(`${key} must be on or off.`);
      return;
    }
    const n = Number(raw);
    if (raw === '' || !/^[+-]?\d+$/.test(raw) || n < param.min || n > param.max) {
      throw new Error(`${key} must be a whole number from ${param.min} to ${param.max}.`);
    }
    content[key] = n;
  });

  return { action: 'set', content: sceneContent(content.scene, content) };
}
