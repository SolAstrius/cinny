import { MatrixClient } from 'matrix-js-sdk';
import { AccountDataEvent } from '../../../types/matrix/accountData';
import { StateEvent } from '../../../types/matrix/room';
import { getStateEvent } from '../../utils/room';
import { PackAddress } from './PackAddress';
import { EmoteRoomsContent, ImageUsage, PackContent, PackImage, PackImages } from './types';
import { IImageInfo } from '../../../types/matrix/common';

export const isPackGlobal = (mx: MatrixClient, address: PackAddress): boolean => {
  const content = mx
    .getAccountData(AccountDataEvent.PoniesEmoteRooms)
    ?.getContent<EmoteRoomsContent>();
  const roomPacks = content?.rooms?.[address.roomId];
  return typeof roomPacks === 'object' && !!roomPacks[address.stateKey];
};

/** Add a room pack to im.ponies.emote_rooms so it shows up in every room. */
export const makePackGlobal = async (mx: MatrixClient, address: PackAddress): Promise<void> => {
  const content =
    mx.getAccountData(AccountDataEvent.PoniesEmoteRooms)?.getContent<EmoteRoomsContent>() ?? {};
  const rooms = { ...(content.rooms ?? {}) };
  rooms[address.roomId] = { ...(rooms[address.roomId] ?? {}), [address.stateKey]: {} };
  await mx.setAccountData(AccountDataEvent.PoniesEmoteRooms, { ...content, rooms } as any);
};

/** A shortcode safe for `:shortcode:` syntax: no spaces or colons, lower case. */
export const slugifyShortcode = (text: string, fallback = 'sticker'): string => {
  const slug = text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 48);
  return slug || fallback;
};

export const uniqueShortcode = (base: string, taken: (shortcode: string) => boolean): string => {
  if (!taken(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return candidate;
  }
};

/** Only the fields MSC2545 cares about; drops thumbnails and other message baggage. */
export const packImageInfo = (info?: Partial<IImageInfo>): IImageInfo | undefined => {
  if (!info || typeof info !== 'object') return undefined;
  const out: IImageInfo = {};
  if (typeof info.w === 'number') out.w = info.w;
  if (typeof info.h === 'number') out.h = info.h;
  if (typeof info.mimetype === 'string') out.mimetype = info.mimetype;
  if (typeof info.size === 'number') out.size = info.size;
  return Object.keys(out).length > 0 ? out : undefined;
};

export type NewPackImage = {
  shortcode: string;
  image: PackImage;
};

/** Merge images into a pack, renaming shortcodes that collide. Returns the final shortcodes. */
const mergeImages = (
  existing: PackImages,
  additions: NewPackImage[]
): { images: PackImages; shortcodes: string[] } => {
  const images: PackImages = { ...existing };
  const shortcodes = additions.map(({ shortcode, image }) => {
    const sc = uniqueShortcode(shortcode, (s) => s in images);
    images[sc] = image;
    return sc;
  });
  return { images, shortcodes };
};

export const getUserPackContent = (mx: MatrixClient): PackContent =>
  mx.getAccountData(AccountDataEvent.PoniesUserEmotes)?.getContent<PackContent>() ?? {};

export const addImagesToUserPack = async (
  mx: MatrixClient,
  additions: NewPackImage[]
): Promise<string[]> => {
  const content = getUserPackContent(mx);
  const { images, shortcodes } = mergeImages(content.images ?? {}, additions);
  await mx.setAccountData(AccountDataEvent.PoniesUserEmotes, { ...content, images } as any);
  return shortcodes;
};

export const getRoomPackContent = (
  mx: MatrixClient,
  address: PackAddress
): PackContent | undefined => {
  const room = mx.getRoom(address.roomId);
  if (!room) return undefined;
  return getStateEvent(
    room,
    StateEvent.PoniesRoomEmotes,
    address.stateKey
  )?.getContent<PackContent>();
};

export const addImagesToRoomPack = async (
  mx: MatrixClient,
  address: PackAddress,
  additions: NewPackImage[]
): Promise<string[]> => {
  const content = getRoomPackContent(mx, address) ?? {};
  const { images, shortcodes } = mergeImages(content.images ?? {}, additions);
  await mx.sendStateEvent(
    address.roomId,
    StateEvent.PoniesRoomEmotes as any,
    { ...content, images } as any,
    address.stateKey
  );
  return shortcodes;
};

/** Pick a state key for a new room pack that no existing pack in the room uses. */
export const newRoomPackStateKey = (mx: MatrixClient, roomId: string, name: string): string => {
  const room = mx.getRoom(roomId);
  const base = slugifyShortcode(name, 'pack');
  return uniqueShortcode(
    base,
    (key) => !!room && !!getStateEvent(room, StateEvent.PoniesRoomEmotes, key)
  );
};

export const createRoomPack = async (
  mx: MatrixClient,
  roomId: string,
  stateKey: string,
  name: string,
  usage: ImageUsage[],
  additions: NewPackImage[]
): Promise<string[]> => {
  const { images, shortcodes } = mergeImages({}, additions);
  const content: PackContent = {
    pack: {
      display_name: name,
      avatar_url: additions[0]?.image.url,
      usage,
    },
    images,
  };
  await mx.sendStateEvent(roomId, StateEvent.PoniesRoomEmotes as any, content as any, stateKey);
  return shortcodes;
};
