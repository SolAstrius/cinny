import { ClientEvent, MatrixClient, MatrixEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { StateEvent } from '../../../types/matrix/room';
import { getStateEvents } from '../../utils/room';
import { PackAddress } from './PackAddress';
import { PackContent } from './types';

export type RoomPackRef = {
  address: PackAddress;
  name?: string;
};

type IndexState = {
  byUrl?: Map<string, RoomPackRef[]>;
};

const indexes = new WeakMap<MatrixClient, IndexState>();

const buildIndex = (mx: MatrixClient): Map<string, RoomPackRef[]> => {
  const byUrl = new Map<string, RoomPackRef[]>();
  mx.getRooms().forEach((room) => {
    if (room.getMyMembership() !== 'join') return;
    getStateEvents(room, StateEvent.PoniesRoomEmotes).forEach((packEvent) => {
      const stateKey = packEvent.getStateKey();
      if (typeof stateKey !== 'string') return;
      const content = packEvent.getContent<PackContent>();
      const { images } = content;
      if (!images || typeof images !== 'object') return;
      const name =
        typeof content.pack?.display_name === 'string' ? content.pack.display_name : undefined;
      const ref: RoomPackRef = { address: new PackAddress(room.roomId, stateKey), name };
      Object.values(images).forEach((image) => {
        if (!image || typeof image.url !== 'string') return;
        const refs = byUrl.get(image.url);
        if (!refs) byUrl.set(image.url, [ref]);
        else if (!refs.includes(ref)) refs.push(ref);
      });
    });
  });
  return byUrl;
};

const getIndexState = (mx: MatrixClient): IndexState => {
  let state = indexes.get(mx);
  if (state) return state;
  const fresh: IndexState = {};
  const invalidate = () => {
    fresh.byUrl = undefined;
  };
  mx.on(RoomStateEvent.Events, (event: MatrixEvent) => {
    if (event.getType() === StateEvent.PoniesRoomEmotes) invalidate();
  });
  mx.on(RoomEvent.MyMembership, invalidate);
  mx.on(ClientEvent.Room, invalidate);
  mx.on(ClientEvent.DeleteRoom, invalidate);
  indexes.set(mx, fresh);
  state = fresh;
  return state;
};

/**
 * Room packs (in joined rooms) that contain an image with this mxc url.
 * The url → pack map is built once and rebuilt only after a pack or membership changes.
 */
export const getRoomPacksWithUrl = (mx: MatrixClient, url: string): RoomPackRef[] => {
  const state = getIndexState(mx);
  if (!state.byUrl) state.byUrl = buildIndex(mx);
  return state.byUrl.get(url) ?? [];
};
