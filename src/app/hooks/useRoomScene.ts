import { useCallback, useMemo } from 'react';
import { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useStateEvent } from './useStateEvent';
import { usePowerLevels } from './usePowerLevels';
import { useRoomCreators } from './useRoomCreators';
import { useRoomPermissions } from './useRoomPermissions';
import { StateEvent } from '../../types/matrix/room';
import {
  isSceneName,
  SCENE_EVENT_TYPE,
  SceneContent,
  sceneContent,
  SceneName,
} from '../plugins/call/CallScene';

/** The room's current scene as complete, valid content, or undefined when none is set. */
export const readRoomScene = (event: MatrixEvent | undefined): SceneContent | undefined => {
  const content = event?.getContent();
  if (!content || !isSceneName(content.scene)) return undefined;
  return sceneContent(content.scene, content);
};

/** Sends the scene event; `undefined` removes the scene (empty content). */
export const sendRoomScene = (
  mx: MatrixClient,
  roomId: string,
  content: SceneContent | undefined
): Promise<unknown> => mx.sendStateEvent(roomId, SCENE_EVENT_TYPE as any, content ?? {}, '');

/**
 * Content for switching to `name`: the current params when that scene is already set, the defaults
 * otherwise. `null` means no scene.
 */
export const sceneSwitchContent = (
  name: SceneName | null,
  current: SceneContent | undefined
): SceneContent | undefined => (name ? sceneContent(name, current) : undefined);

export const useRoomScene = (room: Room) => {
  const mx = useMatrixClient();
  const event = useStateEvent(room, SCENE_EVENT_TYPE as unknown as StateEvent);
  const scene = useMemo(() => readRoomScene(event), [event]);

  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);
  const permissions = useRoomPermissions(creators, powerLevels);
  const canEdit = permissions.stateEvent(SCENE_EVENT_TYPE, mx.getSafeUserId());

  const send = useCallback(
    (content: SceneContent | undefined) => sendRoomScene(mx, room.roomId, content),
    [mx, room.roomId]
  );

  return { scene, eventId: event?.getId(), canEdit, send };
};
