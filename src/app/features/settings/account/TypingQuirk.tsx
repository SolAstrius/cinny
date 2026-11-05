import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  Input,
  Spinner,
  Text,
  toRem,
} from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { setOwnProfileField, useExtendedProfile } from '../../../hooks/useExtendedProfile';
import {
  isQuirkColor,
  parseQuirk,
  Quirk,
  QuirkCase,
  QUIRK_CASES,
  QUIRK_MAX_AFFIX,
  QUIRK_MAX_FROM,
  QUIRK_MAX_PAIRS,
  QUIRK_MAX_TO,
  QUIRK_PRESETS,
  QUIRK_PROFILE_KEY,
  serializeQuirk,
} from '../../../utils/quirk';
import { QuirkAffix, renderQuirkText } from '../../../components/quirk/Quirk';

const SAMPLE = 'Hello there! Is this thing on? The notes are at astr.to/s';

const CASE_LABELS: Record<QuirkCase, string> = {
  none: 'As typed',
  upper: 'Upper',
  lower: 'Lower',
  alternate: 'aLtErNaTe',
};

type Draft = {
  color: string;
  prefix: string;
  suffix: string;
  case: QuirkCase;
  replace: [string, string][];
};

const EMPTY_DRAFT: Draft = { color: '', prefix: '', suffix: '', case: 'none', replace: [] };

const quirkToDraft = (quirk: Quirk | undefined): Draft =>
  quirk
    ? {
        color: quirk.color ?? '',
        prefix: quirk.prefix,
        suffix: quirk.suffix,
        case: quirk.case,
        replace: quirk.replace.map(([a, b]) => [a, b]),
      }
    : EMPTY_DRAFT;

/** Draft → quirk exactly as other clients would parse it (incomplete pairs are dropped). */
const draftToQuirk = (draft: Draft): Quirk | undefined =>
  parseQuirk({
    color: draft.color || undefined,
    prefix: draft.prefix,
    suffix: draft.suffix,
    case: draft.case,
    replace: draft.replace.filter(([from]) => from !== ''),
  });

function QuirkPreview({ quirk }: { quirk?: Quirk }) {
  return (
    <Box
      style={{
        padding: config.space.S300,
        borderRadius: config.radii.R300,
        backgroundColor: color.Background.Container,
        color: color.Background.OnContainer,
      }}
    >
      <Text size="T400" style={{ whiteSpace: 'pre-wrap' }}>
        {quirk ? (
          <>
            <QuirkAffix text={quirk.prefix} quirk={quirk} />
            {renderQuirkText(SAMPLE, quirk)}
            <QuirkAffix text={quirk.suffix} quirk={quirk} />
          </>
        ) : (
          SAMPLE
        )}
      </Text>
    </Box>
  );
}

export function TypingQuirk() {
  const mx = useMatrixClient();
  const userId = mx.getSafeUserId();
  const profile = useExtendedProfile(userId);
  const raw = profile?.[QUIRK_PROFILE_KEY];
  const saved = useMemo(() => (raw === undefined ? undefined : parseQuirk(raw)), [raw]);
  const savedJson = JSON.stringify(saved ? serializeQuirk(saved) : null);

  const [draft, setDraft] = useState<Draft>(() => quirkToDraft(saved));
  useEffect(() => {
    setDraft(quirkToDraft(saved));
    // only resync when the stored quirk itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedJson]);

  const colorValid = draft.color === '' || isQuirkColor(draft.color);
  const preview = useMemo(
    () => (colorValid ? draftToQuirk(draft) : undefined),
    [draft, colorValid]
  );
  const previewJson = JSON.stringify(preview ? serializeQuirk(preview) : null);
  const hasChanges = previewJson !== savedJson;

  const [saveState, save] = useAsyncCallback(
    useCallback(
      (quirk: Quirk | undefined) =>
        setOwnProfileField(mx, QUIRK_PROFILE_KEY, quirk ? serializeQuirk(quirk) : undefined),
      [mx]
    )
  );
  const busy = saveState.status === AsyncStatus.Loading;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setPair = (index: number, side: 0 | 1, value: string) =>
    setDraft((d) => ({
      ...d,
      replace: d.replace.map((pair, i) => {
        if (i !== index) return pair;
        const next: [string, string] = [pair[0], pair[1]];
        next[side] = value;
        return next;
      }),
    }));

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Typing Quirk</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Preview"
          description="How this client shows your messages to others using it. The text you send is not changed; other clients see it plain."
        >
          <QuirkPreview quirk={preview} />
        </SettingTile>

        <SettingTile title="Presets">
          <Box gap="200" wrap="Wrap">
            {QUIRK_PRESETS.map((preset) => (
              <Chip
                key={preset.name}
                variant="Secondary"
                radii="Pill"
                onClick={() => setDraft(quirkToDraft(preset.quirk))}
                before={
                  <span
                    style={{
                      width: toRem(10),
                      height: toRem(10),
                      backgroundColor: preset.quirk.color,
                      display: 'inline-block',
                    }}
                  />
                }
              >
                <Text size="B300">{preset.name}</Text>
              </Chip>
            ))}
          </Box>
        </SettingTile>

        <SettingTile title="Colour">
          <Box gap="200" alignItems="Center">
            <input
              type="color"
              aria-label="Pick colour"
              value={
                isQuirkColor(draft.color) && draft.color.length === 7 ? draft.color : '#e0b0ff'
              }
              onChange={(evt) => update({ color: evt.currentTarget.value })}
              style={{
                width: toRem(36),
                height: toRem(36),
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
              }}
            />
            <Box grow="Yes" direction="Column">
              <Input
                value={draft.color}
                onChange={(evt) => update({ color: evt.currentTarget.value.trim() })}
                placeholder="#rrggbb, empty for none"
                maxLength={7}
                variant={colorValid ? 'Secondary' : 'Critical'}
                radii="300"
                size="400"
              />
            </Box>
            {draft.color && (
              <Button
                size="300"
                variant="Secondary"
                fill="None"
                radii="300"
                onClick={() => update({ color: '' })}
              >
                <Text size="B300">No colour</Text>
              </Button>
            )}
          </Box>
          {!colorValid && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              Use a hex colour like #e0b0ff.
            </Text>
          )}
        </SettingTile>

        <Box gap="300" wrap="Wrap">
          <Box grow="Yes" direction="Column" gap="100" style={{ minWidth: toRem(140) }}>
            <Text size="L400">Prefix</Text>
            <Input
              value={draft.prefix}
              onChange={(evt) => update({ prefix: evt.currentTarget.value })}
              maxLength={QUIRK_MAX_AFFIX}
              variant="Secondary"
              radii="300"
              size="400"
            />
          </Box>
          <Box grow="Yes" direction="Column" gap="100" style={{ minWidth: toRem(140) }}>
            <Text size="L400">Suffix</Text>
            <Input
              value={draft.suffix}
              onChange={(evt) => update({ suffix: evt.currentTarget.value })}
              maxLength={QUIRK_MAX_AFFIX}
              variant="Secondary"
              radii="300"
              size="400"
            />
          </Box>
        </Box>

        <SettingTile title="Letter Case">
          <Box gap="200" wrap="Wrap">
            {QUIRK_CASES.map((mode) => (
              <Chip
                key={mode}
                variant={draft.case === mode ? 'Primary' : 'Secondary'}
                outlined={draft.case === mode}
                aria-pressed={draft.case === mode}
                radii="Pill"
                onClick={() => update({ case: mode })}
              >
                <Text size="B300">{CASE_LABELS[mode]}</Text>
              </Chip>
            ))}
          </Box>
        </SettingTile>

        <SettingTile
          title="Replacements"
          description={`Swap characters or short strings, longest match first. Up to ${QUIRK_MAX_PAIRS}.`}
        >
          <Box direction="Column" gap="200">
            {draft.replace.map(([from, to], index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Box key={index} gap="200" alignItems="Center">
                <Box grow="Yes" direction="Column">
                  <Input
                    aria-label="Replace"
                    value={from}
                    placeholder="from"
                    onChange={(evt) => setPair(index, 0, evt.currentTarget.value)}
                    maxLength={QUIRK_MAX_FROM}
                    variant="Secondary"
                    radii="300"
                    size="400"
                  />
                </Box>
                <Text size="T300" priority="300">
                  →
                </Text>
                <Box grow="Yes" direction="Column">
                  <Input
                    aria-label="With"
                    value={to}
                    placeholder="to"
                    onChange={(evt) => setPair(index, 1, evt.currentTarget.value)}
                    maxLength={QUIRK_MAX_TO}
                    variant="Secondary"
                    radii="300"
                    size="400"
                  />
                </Box>
                <IconButton
                  aria-label="Remove replacement"
                  size="300"
                  radii="300"
                  variant="Secondary"
                  onClick={() =>
                    setDraft((d) => ({ ...d, replace: d.replace.filter((_, i) => i !== index) }))
                  }
                >
                  <Icon src={Icons.Cross} size="100" />
                </IconButton>
              </Box>
            ))}
            <Box>
              <Button
                size="300"
                variant="Secondary"
                fill="Soft"
                outlined
                radii="300"
                disabled={draft.replace.length >= QUIRK_MAX_PAIRS}
                before={<Icon src={Icons.Plus} size="100" />}
                onClick={() => setDraft((d) => ({ ...d, replace: [...d.replace, ['', '']] }))}
              >
                <Text size="B300">Add Replacement</Text>
              </Button>
            </Box>
          </Box>
        </SettingTile>

        <Box gap="200" alignItems="Center" wrap="Wrap">
          <Button
            size="400"
            variant={hasChanges ? 'Success' : 'Secondary'}
            fill={hasChanges ? 'Solid' : 'Soft'}
            outlined
            radii="300"
            disabled={!hasChanges || busy || !colorValid}
            onClick={() => save(preview)}
          >
            {busy && <Spinner variant="Success" fill="Solid" size="300" />}
            <Text size="B400">Save</Text>
          </Button>
          {hasChanges && (
            <Button
              size="400"
              variant="Secondary"
              fill="None"
              radii="300"
              disabled={busy}
              onClick={() => setDraft(quirkToDraft(saved))}
            >
              <Text size="B400">Revert</Text>
            </Button>
          )}
          {saved && (
            <Button
              size="400"
              variant="Critical"
              fill="None"
              radii="300"
              disabled={busy}
              onClick={() => save(undefined)}
            >
              <Text size="B400">Clear Quirk</Text>
            </Button>
          )}
          {saveState.status === AsyncStatus.Error && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              Could not save: {saveState.error instanceof Error ? saveState.error.message : 'error'}
            </Text>
          )}
        </Box>
      </SequenceCard>
    </Box>
  );
}
