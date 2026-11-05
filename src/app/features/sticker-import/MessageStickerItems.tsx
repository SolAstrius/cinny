import React, { useMemo, useState } from 'react';
import { Icon, Icons, MenuItem, Spinner, Text, color } from 'folds';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useGlobalImagePacks, useUserImagePack } from '../../hooks/useImagePacks';
import {
  addImagesToUserPack,
  getRoomPacksWithUrl,
  ImageUsage,
  makePackGlobal,
  packImageInfo,
  RoomPackRef,
  slugifyShortcode,
} from '../../plugins/custom-emoji';
import { MessageEvent } from '../../../types/matrix/room';
import { StickerImportDialog, StickerImportSource } from './StickerImportDialog';
import { MAX_ZIP_BYTES } from './pipeline';

type MediaContent = {
  msgtype?: string;
  body?: string;
  filename?: string;
  url?: string;
  info?: { w?: number; h?: number; mimetype?: string; size?: number };
};

const menuTextStyle = { flexGrow: 1 };

/** What the sticker menu can do with this event, or undefined when it does not apply. */
const readMedia = (mEvent: MatrixEvent) => {
  if (mEvent.isRedacted()) return undefined;
  const type = mEvent.getType();
  const content = mEvent.getContent<MediaContent>();
  // Encrypted media (content.file) cannot be reused in a pack, only plain mxc urls.
  if (typeof content.url !== 'string' || !content.url.startsWith('mxc://')) return undefined;
  if (type === MessageEvent.Sticker) return { kind: 'sticker' as const, content };
  if (type !== MessageEvent.RoomMessage) return undefined;
  if (content.msgtype === 'm.image') return { kind: 'image' as const, content };
  if (content.msgtype === 'm.file') {
    const name = content.filename ?? content.body ?? '';
    const zip = /\.zip$/i.test(name) || content.info?.mimetype === 'application/zip';
    const size = content.info?.size;
    if (zip && (typeof size !== 'number' || size <= MAX_ZIP_BYTES)) {
      return { kind: 'zip' as const, content };
    }
  }
  return undefined;
};

export const hasStickerMenuItems = (mEvent: MatrixEvent): boolean => !!readMedia(mEvent);

const preferredPack = (refs: RoomPackRef[], roomId: string): RoomPackRef | undefined =>
  refs.find((r) => r.address.roomId === roomId) ?? refs[0];

type ItemsProps = {
  room: Room;
  mEvent: MatrixEvent;
  onClose?: () => void;
};

function UseEverywhereItem({ packRef, room }: { packRef: RoomPackRef; room: Room }) {
  const mx = useMatrixClient();
  const globalPacks = useGlobalImagePacks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { address } = packRef;
  const isGlobal = globalPacks.some(
    (p) => p.address?.roomId === address.roomId && p.address.stateKey === address.stateKey
  );
  const packName =
    packRef.name ?? mx.getRoom(address.roomId)?.name ?? (room.name || address.stateKey);

  const handleClick = async () => {
    setBusy(true);
    setError(false);
    try {
      await makePackGlobal(mx, address);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MenuItem
      size="300"
      radii="300"
      after={busy ? <Spinner size="100" /> : <Icon size="100" src={Icons.Sticker} />}
      disabled={isGlobal || busy}
      aria-disabled={isGlobal || busy}
      onClick={isGlobal ? undefined : handleClick}
    >
      <Text
        as="span"
        size="T300"
        truncate
        style={{ ...menuTextStyle, color: error ? color.Critical.Main : undefined }}
      >
        {isGlobal ? `${packName} is in your stickers` : `Use ${packName} everywhere`}
      </Text>
    </MenuItem>
  );
}

function SaveToMyStickersItem({ content }: { content: MediaContent }) {
  const mx = useMatrixClient();
  const userPack = useUserImagePack();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const url = content.url as string;
  const saved = useMemo(
    () => !!userPack && Array.from(userPack.images.collection.values()).some((i) => i.url === url),
    [userPack, url]
  );

  const handleClick = async () => {
    setBusy(true);
    setError(false);
    const rawName = (content.body ?? content.filename ?? '').replace(/\.[a-z0-9]{2,5}$/i, '');
    const body = rawName.trim() || 'sticker';
    try {
      await addImagesToUserPack(mx, [
        {
          shortcode: /^\d+$/.test(slugifyShortcode(body)) ? 'sticker' : slugifyShortcode(body),
          image: {
            url,
            body,
            info: packImageInfo(content.info),
            usage: [ImageUsage.Sticker],
          },
        },
      ]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  let label = 'Save to my stickers';
  if (saved) label = 'In my stickers';
  else if (error) label = 'Could not save, try again';

  return (
    <MenuItem
      size="300"
      radii="300"
      after={busy ? <Spinner size="100" /> : <Icon size="100" src={Icons.Plus} />}
      disabled={saved || busy}
      aria-disabled={saved || busy}
      onClick={saved ? undefined : handleClick}
    >
      <Text
        as="span"
        size="T300"
        truncate
        style={{ ...menuTextStyle, color: error ? color.Critical.Main : undefined }}
      >
        {label}
      </Text>
    </MenuItem>
  );
}

function ImportZipItem({
  room,
  content,
  onClose,
}: {
  room: Room;
  content: MediaContent;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const source: StickerImportSource = useMemo(
    () => ({
      kind: 'mxc',
      mxc: content.url as string,
      name: content.filename ?? content.body ?? 'Stickers.zip',
    }),
    [content]
  );

  return (
    <>
      {open && (
        <StickerImportDialog
          source={source}
          defaultRoomId={room.roomId}
          requestClose={() => {
            setOpen(false);
            onClose?.();
          }}
        />
      )}
      <MenuItem
        size="300"
        radii="300"
        after={<Icon size="100" src={Icons.Sticker} />}
        onClick={() => setOpen(true)}
        aria-pressed={open}
      >
        <Text as="span" size="T300" truncate style={menuTextStyle}>
          Import as sticker pack…
        </Text>
      </MenuItem>
    </>
  );
}

/** Sticker related message menu items: pack lookup, save to personal pack, zip import. */
export function MessageStickerItems({ room, mEvent, onClose }: ItemsProps) {
  const mx = useMatrixClient();
  const media = readMedia(mEvent);
  const url = media?.content.url;
  const packRef = useMemo(
    () =>
      url && media?.kind !== 'zip'
        ? preferredPack(getRoomPacksWithUrl(mx, url), room.roomId)
        : undefined,
    [mx, url, media?.kind, room.roomId]
  );

  if (!media) return null;
  if (media.kind === 'zip') {
    return <ImportZipItem room={room} content={media.content} onClose={onClose} />;
  }
  return (
    <>
      {packRef && <UseEverywhereItem packRef={packRef} room={room} />}
      <SaveToMyStickersItem content={media.content} />
    </>
  );
}
