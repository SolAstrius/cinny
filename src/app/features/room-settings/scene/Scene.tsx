import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  color,
  Icon,
  IconButton,
  Icons,
  Input,
  Scroll,
  Spinner,
  Switch,
  Text,
} from 'folds';
import { MatrixError } from 'matrix-js-sdk';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { SequenceCardStyle } from '../styles.css';
import { useRoom } from '../../../hooks/useRoom';
import { useRoomScene } from '../../../hooks/useRoomScene';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import {
  randomSceneSeed,
  SCENE_INFO,
  SCENE_SEED_MAX,
  SceneContent,
  sceneContent,
  SceneName,
  SceneNumberParam,
  SCENES,
  sceneUrl,
} from '../../../plugins/call/CallScene';
import { trimTrailingSlash } from '../../../utils/common';
import * as css from './styles.css';

const thumbUrl = (name: SceneName) =>
  `${trimTrailingSlash(import.meta.env.BASE_URL)}/public/scenes/thumbs/${name}.png`;

const sameScene = (a: SceneContent | undefined, b: SceneContent | undefined) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// The scene pages read their params once on load, so the preview reloads (new query) whenever the
// draft settles; a short delay keeps a dragged slider from reloading it on every step.
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return settled;
}

function ScenePreview({ draft, changed }: { draft: SceneContent | undefined; changed: boolean }) {
  const settled = useSettled(draft, 250);
  const url = useMemo(
    () => (settled ? sceneUrl(settled, `preview-${Object.values(settled).join('_')}`) : undefined),
    [settled]
  );
  const previewRef = useRef<HTMLDivElement>(null);

  return (
    <div className={css.Preview} ref={previewRef}>
      {url ? (
        <iframe
          key={url}
          className={css.PreviewFrame}
          title="Scene preview"
          src={url}
          sandbox="allow-scripts"
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : (
        <div className={css.PreviewEmpty}>
          <Text size="T300" priority="300" align="Center">
            No scene. Calls in this room show Element Call&apos;s plain background.
          </Text>
        </div>
      )}
      {changed && (
        <Text as="span" size="T200" className={css.PreviewBadge}>
          Preview, not saved
        </Text>
      )}
      {url && document.fullscreenEnabled && (
        <Button
          className={css.PreviewExpand}
          variant="Secondary"
          fill="Solid"
          size="300"
          radii="300"
          onClick={() =>
            document.fullscreenElement
              ? document.exitFullscreen()
              : previewRef.current?.requestFullscreen()
          }
        >
          <Text size="B300">Full Screen</Text>
        </Button>
      )}
    </div>
  );
}

type SceneTilesProps = {
  value: SceneName | undefined;
  disabled: boolean;
  onChange: (name: SceneName | undefined) => void;
};
function SceneTiles({ value, disabled, onChange }: SceneTilesProps) {
  return (
    <div className={css.Tiles} role="group" aria-label="Scene">
      <button
        type="button"
        className={css.Tile}
        aria-pressed={value === undefined}
        disabled={disabled}
        onClick={() => onChange(undefined)}
      >
        <span className={css.TileImage} />
        <Text as="span" size="T300" className={css.TileLabel}>
          None
        </Text>
      </button>
      {SCENES.map((name) => (
        <button
          key={name}
          type="button"
          className={css.Tile}
          aria-pressed={value === name}
          disabled={disabled}
          onClick={() => onChange(name)}
          title={SCENE_INFO[name].description}
        >
          <img className={css.TileImage} src={thumbUrl(name)} alt="" loading="lazy" />
          <Text as="span" size="T300" className={css.TileLabel}>
            {SCENE_INFO[name].label}
          </Text>
        </button>
      ))}
    </div>
  );
}

type NumberControlProps = {
  param: SceneNumberParam;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
};
function NumberControl({ param, value, disabled, onChange }: NumberControlProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const clamp = (n: number) => Math.min(param.max, Math.max(param.min, Math.round(n)));

  const handleText = (evt: ChangeEvent<HTMLInputElement>) => {
    setText(evt.target.value);
    const n = Number(evt.target.value);
    if (evt.target.value.trim() !== '' && Number.isInteger(n) && n >= param.min && n <= param.max) {
      onChange(n);
    }
  };

  return (
    <SettingTile title={param.label} description={param.description}>
      <Box alignItems="Center" gap="300">
        <input
          className={css.Slider}
          type="range"
          min={param.min}
          max={param.max}
          step={1}
          value={value}
          disabled={disabled}
          aria-label={param.label}
          onChange={(evt) => onChange(clamp(Number(evt.target.value)))}
        />
        <Input
          className={css.NumberInput}
          variant="Background"
          size="300"
          radii="300"
          type="number"
          inputMode="numeric"
          min={param.min}
          max={param.max}
          step={1}
          value={text}
          disabled={disabled}
          outlined
          aria-label={`${param.label} value`}
          onChange={handleText}
          onBlur={() => {
            const n = Number(text);
            const next = Number.isFinite(n) && text.trim() !== '' ? clamp(n) : value;
            setText(String(next));
            if (next !== value) onChange(next);
          }}
        />
      </Box>
    </SettingTile>
  );
}

type SceneParamsProps = {
  draft: SceneContent;
  disabled: boolean;
  onChange: (content: SceneContent) => void;
};
function SceneParams({ draft, disabled, onChange }: SceneParamsProps) {
  const info = SCENE_INFO[draft.scene];
  const set = (key: string, value: number | boolean) =>
    onChange(sceneContent(draft.scene, { ...draft, [key]: value }));

  const seed = typeof draft.seed === 'number' ? draft.seed : info.seed;
  const [seedText, setSeedText] = useState(String(seed));
  useEffect(() => setSeedText(String(seed)), [seed]);

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">{info.label}</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        {info.params.map((param) =>
          param.kind === 'number' ? (
            <NumberControl
              key={param.key}
              param={param}
              value={draft[param.key] as number}
              disabled={disabled}
              onChange={(v) => set(param.key, v)}
            />
          ) : (
            <SettingTile
              key={param.key}
              title={param.label}
              description={param.description}
              after={
                <Switch
                  value={draft[param.key] as boolean}
                  disabled={disabled}
                  onChange={(v: boolean) => set(param.key, v)}
                />
              }
            />
          )
        )}
        <SettingTile
          title="Seed"
          description="The same seed draws the same scene for everyone in the call."
          after={
            <Box alignItems="Center" gap="200">
              <Input
                className={css.SeedInput}
                variant="Background"
                size="300"
                radii="300"
                type="number"
                inputMode="numeric"
                min={0}
                max={SCENE_SEED_MAX}
                step={1}
                value={seedText}
                disabled={disabled}
                outlined
                aria-label="Seed"
                onChange={(evt: ChangeEvent<HTMLInputElement>) => {
                  setSeedText(evt.target.value);
                  const n = Number(evt.target.value);
                  if (
                    evt.target.value.trim() !== '' &&
                    Number.isInteger(n) &&
                    n >= 0 &&
                    n <= SCENE_SEED_MAX
                  ) {
                    set('seed', n);
                  }
                }}
                onBlur={() => setSeedText(String(seed))}
              />
              <Button
                variant="Secondary"
                fill="Soft"
                size="300"
                radii="300"
                outlined
                disabled={disabled}
                onClick={() => set('seed', randomSceneSeed())}
                before={<Icon size="100" src={Icons.Reload} />}
              >
                <Text size="B300">Shuffle</Text>
              </Button>
            </Box>
          }
        />
        <SettingTile
          title="Defaults"
          description={`Restore the ${info.label.toLowerCase()} scene's default settings.`}
          after={
            <Button
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
              disabled={disabled}
              onClick={() => onChange(sceneContent(draft.scene))}
            >
              <Text size="B300">Reset</Text>
            </Button>
          }
        />
      </SequenceCard>
    </Box>
  );
}

type SceneProps = {
  requestClose: () => void;
};
export function Scene({ requestClose }: SceneProps) {
  const room = useRoom();
  const { scene, canEdit, send } = useRoomScene(room);

  const [draft, setDraft] = useState<SceneContent | undefined>(scene);
  const [touched, setTouched] = useState(false);
  // follow the saved scene until the user starts editing, and again once a save has synced back
  useEffect(() => {
    if (!touched) setDraft(scene);
  }, [scene, touched]);
  useEffect(() => {
    if (touched && sameScene(draft, scene)) setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const changed = !sameScene(draft, scene);

  const [saveState, save] = useAsyncCallback(send);
  const saving = saveState.status === AsyncStatus.Loading;
  const disabled = !canEdit || saving;

  const edit = (content: SceneContent | undefined) => {
    setTouched(true);
    setDraft(content);
  };

  const handlePick = (name: SceneName | undefined) => {
    if (!name) {
      edit(undefined);
      return;
    }
    if (draft?.scene === name) return;
    // switching back to the saved scene restores its saved settings
    edit(sceneContent(name, scene));
  };

  // the draft stays until the sent event syncs back (see above); errors show under the buttons
  const handleSave = () => {
    save(draft).catch(() => undefined);
  };

  const handleRemove = () => {
    edit(undefined);
    save(undefined).catch(() => undefined);
  };

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Scene
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="500">
              <ScenePreview draft={draft} changed={changed} />
              {!canEdit && (
                <Text size="T300" style={{ color: color.Warning.Main }}>
                  Your power level in this room is too low to change its scene.
                </Text>
              )}
              <SceneTiles value={draft?.scene} disabled={disabled} onChange={handlePick} />
              {draft && <SceneParams draft={draft} disabled={disabled} onChange={edit} />}
              {canEdit && (
                <Box direction="Column" gap="200">
                  <Box gap="200" wrap="Wrap" alignItems="Center">
                    <Button
                      variant="Primary"
                      size="400"
                      radii="300"
                      disabled={!changed || saving}
                      onClick={handleSave}
                      before={saving && <Spinner variant="Primary" fill="Solid" size="100" />}
                    >
                      <Text size="B400">Save</Text>
                    </Button>
                    {changed && (
                      <Button
                        variant="Secondary"
                        fill="Soft"
                        size="400"
                        radii="300"
                        disabled={saving}
                        onClick={() => {
                          setDraft(scene);
                          setTouched(false);
                        }}
                      >
                        <Text size="B400">Discard Changes</Text>
                      </Button>
                    )}
                    <Box grow="Yes" />
                    {scene && (
                      <Button
                        variant="Critical"
                        fill="Soft"
                        size="400"
                        radii="300"
                        disabled={saving}
                        onClick={handleRemove}
                        before={<Icon size="100" src={Icons.Delete} />}
                      >
                        <Text size="B400">Remove Scene</Text>
                      </Button>
                    )}
                  </Box>
                  {saveState.status === AsyncStatus.Error && (
                    <Text size="T200" style={{ color: color.Critical.Main }}>
                      {(saveState.error as MatrixError).message}
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
