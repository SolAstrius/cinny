import React, { MouseEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  color,
  config,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  Menu,
  MenuItem,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  RectCords,
  Scroll,
  Spinner,
  Text,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { stopPropagation } from '../../utils/keyboard';
import { getStateEvent, getStateEvents } from '../../utils/room';
import { StateEvent } from '../../../types/matrix/room';
import { getRoomPermissionsAPI } from '../../hooks/useRoomPermissions';
import { getRoomCreatorsForRoomId } from '../../hooks/useRoomCreators';
import { getPowersLevelFromMatrixEvent } from '../../hooks/usePowerLevels';
import {
  ImageUsage,
  isPackGlobal,
  PackAddress,
  PackContent,
  slugifyShortcode,
} from '../../plugins/custom-emoji';
import {
  collectCandidates,
  CollectResult,
  downloadMxc,
  importPack,
  ImportCandidate,
  ImportDestination,
  ImportResult,
  isZipBytes,
  ItemStatus,
  MAX_IMAGES,
  needsResize,
  readLocalFiles,
  readZip,
  targetSize,
} from './pipeline';

export type StickerImportSource =
  | { kind: 'mxc'; mxc: string; name: string }
  | { kind: 'files'; files: File[] };

type LoadState =
  | { state: 'downloading'; loaded: number; total: number }
  | { state: 'reading' }
  | { state: 'ready'; result: CollectResult }
  | { state: 'error'; message: string };

type RoomPackOption = { stateKey: string; name: string };

const packNameFromFile = (name: string): string =>
  name
    .replace(/\.zip$/i, '')
    .replace(/[_]+/g, ' ')
    .trim() || 'Stickers';

const formatBytes = (n: number): string =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;

const getWritableRooms = (mx: MatrixClient): Room[] => {
  const userId = mx.getUserId();
  if (!userId) return [];
  return mx
    .getRooms()
    .filter((room) => {
      if (room.getMyMembership() !== 'join') return false;
      const powerLevels = getPowersLevelFromMatrixEvent(
        getStateEvent(room, StateEvent.RoomPowerLevels)
      );
      const permissions = getRoomPermissionsAPI(
        getRoomCreatorsForRoomId(mx, room.roomId),
        powerLevels
      );
      return permissions.stateEvent(StateEvent.PoniesRoomEmotes, userId);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

const getRoomPackOptions = (room: Room): RoomPackOption[] =>
  getStateEvents(room, StateEvent.PoniesRoomEmotes)
    .map((ev) => {
      const stateKey = ev.getStateKey() ?? '';
      const content = ev.getContent<PackContent>();
      if (!content.pack && !content.images) return undefined;
      return { stateKey, name: content.pack?.display_name || stateKey || room.name };
    })
    .filter((p): p is RoomPackOption => !!p);

const USAGE_OPTIONS: { label: string; usage: ImageUsage[] }[] = [
  { label: 'Sticker', usage: [ImageUsage.Sticker] },
  { label: 'Emoji', usage: [ImageUsage.Emoticon] },
  { label: 'Both', usage: [ImageUsage.Sticker, ImageUsage.Emoticon] },
];

function RoomPicker({
  rooms,
  selected,
  onSelect,
}: {
  rooms: Room[];
  selected?: Room;
  onSelect: (room: Room) => void;
}) {
  const [anchor, setAnchor] = useState<RectCords>();
  const handleOpen: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PopOut
      anchor={anchor}
      position="Bottom"
      align="Start"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setAnchor(undefined),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu style={{ maxHeight: toRem(320), maxWidth: toRem(320), display: 'flex' }}>
            <Scroll size="300" hideTrack visibility="Hover">
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {rooms.map((room) => (
                  <MenuItem
                    key={room.roomId}
                    size="300"
                    radii="300"
                    variant={room === selected ? 'SurfaceVariant' : 'Surface'}
                    aria-selected={room === selected}
                    onClick={() => {
                      onSelect(room);
                      setAnchor(undefined);
                    }}
                  >
                    <Text size="T300" truncate>
                      {room.name}
                    </Text>
                  </MenuItem>
                ))}
              </Box>
            </Scroll>
          </Menu>
        </FocusTrap>
      }
    >
      <Button
        type="button"
        variant="Secondary"
        fill="Soft"
        size="300"
        radii="300"
        outlined
        onClick={handleOpen}
        after={<Icon src={Icons.ChevronBottom} size="100" />}
        disabled={rooms.length === 0}
      >
        <Text size="B300" truncate>
          {selected?.name ?? 'Choose a room'}
        </Text>
      </Button>
    </PopOut>
  );
}

function CandidateTile({
  candidate,
  previewUrl,
  shortcode,
  include,
  status,
  disabled,
  onShortcodeChange,
  onIncludeChange,
}: {
  candidate: ImportCandidate;
  previewUrl: string;
  shortcode: string;
  include: boolean;
  status?: ItemStatus;
  disabled: boolean;
  onShortcodeChange: (value: string) => void;
  onIncludeChange: (value: boolean) => void;
}) {
  const { w, h } = targetSize(candidate);
  let note = `${candidate.width}×${candidate.height}`;
  if (candidate.detected.animated) note = `animated ${candidate.detected.kind.toUpperCase()}`;
  else if (needsResize(candidate)) note = `${candidate.width} → ${w}×${h}`;

  let statusNode: React.ReactNode = null;
  if (status?.state === 'uploading') {
    statusNode = (
      <Text size="T200" priority="300">
        {`Uploading ${Math.round(status.progress * 100)}%`}
      </Text>
    );
  } else if (status?.state === 'done') {
    statusNode = (
      <Text size="T200" style={{ color: color.Success.Main }}>
        Uploaded
      </Text>
    );
  } else if (status?.state === 'error') {
    statusNode = (
      <Text size="T200" style={{ color: color.Critical.Main }} truncate title={status.message}>
        {status.message}
      </Text>
    );
  }

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S200,
        borderRadius: config.radii.R400,
        backgroundColor: color.SurfaceVariant.Container,
        border: `${config.borderWidth.B300} solid ${
          include ? color.SurfaceVariant.ContainerLine : 'transparent'
        }`,
        opacity: include ? 1 : 0.5,
      }}
    >
      <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
        <Checkbox
          size="200"
          variant="Primary"
          checked={include}
          disabled={disabled}
          onClick={() => onIncludeChange(!include)}
          aria-label={`Include ${shortcode}`}
        />
        <Text size="T200" priority="300" truncate>
          {note}
        </Text>
      </Box>
      <Box
        justifyContent="Center"
        alignItems="Center"
        style={{ height: toRem(104), cursor: disabled ? undefined : 'pointer' }}
        onClick={() => !disabled && onIncludeChange(!include)}
      >
        <img
          src={previewUrl}
          alt={shortcode}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </Box>
      <Input
        size="300"
        variant="Background"
        radii="300"
        value={shortcode}
        disabled={disabled || !include}
        onChange={(evt) => onShortcodeChange(evt.currentTarget.value)}
        onBlur={(evt) =>
          onShortcodeChange(slugifyShortcode(evt.currentTarget.value, candidate.defaultShortcode))
        }
        aria-label="Shortcode"
      />
      {statusNode}
    </Box>
  );
}

type StickerImportDialogProps = {
  source: StickerImportSource;
  defaultRoomId?: string;
  requestClose: () => void;
};

export function StickerImportDialog({
  source,
  defaultRoomId,
  requestClose,
}: StickerImportDialogProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const [load, setLoad] = useState<LoadState>(() =>
    source.kind === 'mxc' ? { state: 'downloading', loaded: 0, total: 0 } : { state: 'reading' }
  );
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const [shortcodes, setShortcodes] = useState<Map<string, string>>(new Map());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const defaultName = useMemo(() => {
    if (source.kind === 'mxc') return packNameFromFile(source.name);
    const zip = source.files.find((f) => /\.zip$/i.test(f.name));
    return packNameFromFile(zip?.name ?? 'Stickers');
  }, [source]);
  const [packName, setPackName] = useState(defaultName);
  const [usage, setUsage] = useState<ImageUsage[]>([ImageUsage.Sticker]);

  const writableRooms = useMemo(() => getWritableRooms(mx), [mx]);
  const [destKind, setDestKind] = useState<'user' | 'room'>('user');
  const [roomId, setRoomId] = useState<string | undefined>(() =>
    writableRooms.find((r) => r.roomId === defaultRoomId) ? defaultRoomId : undefined
  );
  const room = writableRooms.find((r) => r.roomId === roomId);
  const roomPacks = useMemo(() => (room ? getRoomPackOptions(room) : []), [room]);
  const [packKey, setPackKey] = useState<string>();
  const [useEverywhere, setUseEverywhere] = useState(true);

  const [statuses, setStatuses] = useState<Map<string, ItemStatus>>(new Map());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string>();
  const [done, setDone] = useState<ImportResult>();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        let entries: { name: string; data: Uint8Array }[];
        if (source.kind === 'mxc') {
          const data = await downloadMxc(mx, source.mxc, useAuthentication, (loaded, total) => {
            if (!cancelled) setLoad({ state: 'downloading', loaded, total });
          });
          if (cancelled) return;
          setLoad({ state: 'reading' });
          if (!isZipBytes(data)) throw new Error('This file is not a zip archive');
          entries = await readZip(data);
        } else {
          entries = await readLocalFiles(source.files);
        }
        const result = await collectCandidates(entries);
        if (cancelled) return;
        setPreviews(new Map(result.candidates.map((c) => [c.id, URL.createObjectURL(c.blob)])));
        setShortcodes(new Map(result.candidates.map((c) => [c.id, c.defaultShortcode])));
        if (result.manifestName) setPackName(result.manifestName);
        setLoad({ state: 'ready', result });
      } catch (e) {
        if (!cancelled) {
          setLoad({
            state: 'error',
            message: e instanceof Error ? e.message : 'Could not read the file',
          });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mx, source, useAuthentication]);

  useEffect(
    () => () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    },
    [previews]
  );

  const candidates = load.state === 'ready' ? load.result.candidates : [];
  const selected = candidates.filter((c) => !excluded.has(c.id));

  const handleStatus = useCallback((id: string, status: ItemStatus) => {
    setStatuses((s) => new Map(s).set(id, status));
  }, []);

  const destination: ImportDestination | undefined = useMemo(() => {
    if (destKind === 'user') return { kind: 'user' };
    if (!roomId) return undefined;
    if (packKey !== undefined && roomPacks.find((p) => p.stateKey === packKey)) {
      return { kind: 'room-pack', address: new PackAddress(roomId, packKey) };
    }
    return { kind: 'new-room-pack', roomId };
  }, [destKind, roomId, packKey, roomPacks]);

  const alreadyGlobal = destination?.kind === 'room-pack' && isPackGlobal(mx, destination.address);

  const canImport =
    !importing &&
    !done &&
    selected.length > 0 &&
    !!destination &&
    (destination.kind !== 'new-room-pack' || packName.trim().length > 0);

  const handleImport = async () => {
    if (!canImport || !destination) return;
    setImporting(true);
    setImportError(undefined);
    setStatuses(new Map(selected.map((c) => [c.id, { state: 'waiting' }])));
    try {
      const result = await importPack(
        mx,
        {
          destination,
          packName: packName.trim(),
          usage,
          useEverywhere: useEverywhere && !alreadyGlobal,
        },
        selected.map((candidate) => ({
          candidate,
          shortcode: slugifyShortcode(
            shortcodes.get(candidate.id) ?? '',
            candidate.defaultShortcode
          ),
        })),
        handleStatus
      );
      setDone(result);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  let destinationName = 'My stickers';
  if (destination?.kind === 'room-pack') {
    destinationName =
      roomPacks.find((p) => p.stateKey === destination.address.stateKey)?.name ?? 'pack';
  } else if (destination?.kind === 'new-room-pack') {
    destinationName = packName.trim();
  }

  const renderLoad = () => {
    if (load.state === 'downloading') {
      const pct = load.total ? Math.round((load.loaded / load.total) * 100) : undefined;
      return (
        <Box alignItems="Center" gap="200">
          <Spinner size="200" variant="Secondary" />
          <Text size="T300">
            {pct !== undefined
              ? `Downloading ${pct}% of ${formatBytes(load.total)}`
              : `Downloading ${formatBytes(load.loaded)}`}
          </Text>
        </Box>
      );
    }
    if (load.state === 'reading') {
      return (
        <Box alignItems="Center" gap="200">
          <Spinner size="200" variant="Secondary" />
          <Text size="T300">Reading images</Text>
        </Box>
      );
    }
    if (load.state === 'error') {
      return (
        <Text size="T300" style={{ color: color.Critical.Main }}>
          {load.message}
        </Text>
      );
    }
    return null;
  };

  const ready = load.state === 'ready';
  const summary = ready
    ? [
        `${candidates.length} image${candidates.length === 1 ? '' : 's'}`,
        load.result.skipped > 0 ? `${load.result.skipped} other files skipped` : undefined,
        load.result.truncated ? `only the first ${MAX_IMAGES} are shown` : undefined,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const locked = importing || !!done;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => {
              if (!importing) requestClose();
            },
            clickOutsideDeactivates: false,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal
            variant="Surface"
            size="500"
            style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
          >
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
                borderBottomWidth: config.borderWidth.B300,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4">Import Sticker Pack</Text>
              </Box>
              <IconButton size="300" onClick={requestClose} radii="300" disabled={importing}>
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box grow="Yes" style={{ minHeight: 0 }}>
              <Scroll size="300" hideTrack visibility="Hover">
                <Box direction="Column" gap="500" style={{ padding: config.space.S400 }}>
                  {renderLoad()}
                  {ready && candidates.length === 0 && (
                    <Text size="T300">
                      No PNG, GIF, WebP or JPEG images were found in this file.
                    </Text>
                  )}
                  {ready && candidates.length > 0 && (
                    <>
                      <Box direction="Column" gap="300">
                        <Box direction="Column" gap="100">
                          <Text size="L400">Save to</Text>
                          <Box gap="200" wrap="Wrap">
                            <Chip
                              radii="Pill"
                              variant={destKind === 'user' ? 'Primary' : 'SurfaceVariant'}
                              outlined={destKind === 'user'}
                              aria-pressed={destKind === 'user'}
                              disabled={locked}
                              onClick={() => setDestKind('user')}
                            >
                              <Text size="B300">My stickers</Text>
                            </Chip>
                            <Chip
                              radii="Pill"
                              variant={destKind === 'room' ? 'Primary' : 'SurfaceVariant'}
                              outlined={destKind === 'room'}
                              aria-pressed={destKind === 'room'}
                              disabled={locked || writableRooms.length === 0}
                              onClick={() => setDestKind('room')}
                            >
                              <Text size="B300">Room pack</Text>
                            </Chip>
                          </Box>
                          {writableRooms.length === 0 && (
                            <Text size="T200" priority="300">
                              You cannot edit packs in any of your rooms.
                            </Text>
                          )}
                        </Box>
                        {destKind === 'room' && (
                          <Box direction="Column" gap="300">
                            <Box direction="Column" gap="100">
                              <Text size="L400">Room</Text>
                              <Box>
                                <RoomPicker
                                  rooms={writableRooms}
                                  selected={room}
                                  onSelect={(r) => {
                                    setRoomId(r.roomId);
                                    setPackKey(undefined);
                                  }}
                                />
                              </Box>
                            </Box>
                            {room && (
                              <Box direction="Column" gap="100">
                                <Text size="L400">Pack</Text>
                                <Box gap="200" wrap="Wrap">
                                  <Chip
                                    radii="Pill"
                                    variant={packKey === undefined ? 'Primary' : 'SurfaceVariant'}
                                    outlined={packKey === undefined}
                                    aria-pressed={packKey === undefined}
                                    disabled={locked}
                                    onClick={() => setPackKey(undefined)}
                                    before={<Icon size="50" src={Icons.Plus} />}
                                  >
                                    <Text size="B300">New pack</Text>
                                  </Chip>
                                  {roomPacks.map((p) => (
                                    <Chip
                                      key={p.stateKey}
                                      radii="Pill"
                                      variant={
                                        packKey === p.stateKey ? 'Primary' : 'SurfaceVariant'
                                      }
                                      outlined={packKey === p.stateKey}
                                      aria-pressed={packKey === p.stateKey}
                                      disabled={locked}
                                      onClick={() => setPackKey(p.stateKey)}
                                    >
                                      <Text size="B300">{p.name}</Text>
                                    </Chip>
                                  ))}
                                </Box>
                              </Box>
                            )}
                            {room && (
                              <Box as="label" alignItems="Center" gap="200">
                                <Checkbox
                                  size="200"
                                  variant="Primary"
                                  checked={alreadyGlobal || useEverywhere}
                                  disabled={locked || alreadyGlobal}
                                  onClick={() => setUseEverywhere((v) => !v)}
                                />
                                <Text size="T300">
                                  {alreadyGlobal
                                    ? 'This pack is already in your stickers everywhere'
                                    : 'Use everywhere'}
                                </Text>
                              </Box>
                            )}
                          </Box>
                        )}
                        {destination?.kind === 'new-room-pack' && (
                          <Box direction="Column" gap="100">
                            <Text size="L400">Pack name</Text>
                            <Input
                              variant="Background"
                              size="400"
                              radii="300"
                              value={packName}
                              disabled={locked}
                              onChange={(evt) => setPackName(evt.currentTarget.value)}
                              required
                            />
                          </Box>
                        )}
                        <Box direction="Column" gap="100">
                          <Text size="L400">Use as</Text>
                          <Box gap="200" wrap="Wrap">
                            {USAGE_OPTIONS.map((opt) => {
                              const active =
                                opt.usage.length === usage.length &&
                                opt.usage.every((u) => usage.includes(u));
                              return (
                                <Chip
                                  key={opt.label}
                                  radii="Pill"
                                  variant={active ? 'Primary' : 'SurfaceVariant'}
                                  outlined={active}
                                  aria-pressed={active}
                                  disabled={locked}
                                  onClick={() => setUsage(opt.usage)}
                                >
                                  <Text size="B300">{opt.label}</Text>
                                </Chip>
                              );
                            })}
                          </Box>
                        </Box>
                      </Box>
                      <Box direction="Column" gap="200">
                        <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
                          <Text size="L400">{summary}</Text>
                          <Chip
                            radii="Pill"
                            variant="SurfaceVariant"
                            disabled={locked}
                            onClick={() =>
                              setExcluded(
                                excluded.size === 0
                                  ? new Set(candidates.map((c) => c.id))
                                  : new Set()
                              )
                            }
                          >
                            <Text size="B300">
                              {excluded.size === 0 ? 'Select none' : 'Select all'}
                            </Text>
                          </Chip>
                        </Box>
                        <Box
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fill, minmax(${toRem(136)}, 1fr))`,
                            gap: config.space.S200,
                          }}
                        >
                          {candidates.map((c) => (
                            <CandidateTile
                              key={c.id}
                              candidate={c}
                              previewUrl={previews.get(c.id) ?? ''}
                              shortcode={shortcodes.get(c.id) ?? c.defaultShortcode}
                              include={!excluded.has(c.id)}
                              status={statuses.get(c.id)}
                              disabled={locked}
                              onShortcodeChange={(value) =>
                                setShortcodes((s) => new Map(s).set(c.id, value))
                              }
                              onIncludeChange={(include) =>
                                setExcluded((s) => {
                                  const next = new Set(s);
                                  if (include) next.delete(c.id);
                                  else next.add(c.id);
                                  return next;
                                })
                              }
                            />
                          ))}
                        </Box>
                      </Box>
                    </>
                  )}
                </Box>
              </Scroll>
            </Box>
            {ready && candidates.length > 0 && (
              <Box
                direction="Column"
                gap="200"
                style={{
                  padding: config.space.S400,
                  borderTop: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
                }}
              >
                {importError && (
                  <Text size="T300" style={{ color: color.Critical.Main }}>
                    {importError}
                  </Text>
                )}
                {done && (
                  <Text size="T300" style={{ color: color.Success.Main }}>
                    {`Imported ${done.written} into ${destinationName}`}
                    {done.failed > 0 ? `, ${done.failed} failed` : ''}
                  </Text>
                )}
                {done ? (
                  <Button variant="Secondary" fill="Soft" onClick={requestClose}>
                    <Text size="B400">Close</Text>
                  </Button>
                ) : (
                  <Button
                    variant="Primary"
                    disabled={!canImport}
                    onClick={handleImport}
                    before={
                      importing ? <Spinner size="200" variant="Primary" fill="Solid" /> : undefined
                    }
                  >
                    <Text size="B400">
                      {importing
                        ? 'Importing'
                        : `Import ${selected.length} into ${destinationName || 'new pack'}`}
                    </Text>
                  </Button>
                )}
              </Box>
            )}
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
