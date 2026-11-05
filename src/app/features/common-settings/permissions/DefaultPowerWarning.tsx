import React, { useCallback } from 'react';
import { Box, Button, color, Icon, Icons, Spinner, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { IPowerLevels, readPowerLevel } from '../../../hooks/usePowerLevels';
import { useRoom } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { StateEvent } from '../../../../types/matrix/room';
import { getStateEvent } from '../../../utils/room';

const ADMIN_POWER = 100;

/**
 * astr.to: `users_default` is the power of every member not listed in `users`. Once it reaches
 * the level that may change `m.room.power_levels` (or plain admin, 100), every joiner is an admin.
 */
export const isAdminByDefault = (powerLevels: IPowerLevels, usersDefault?: number): boolean => {
  const value = usersDefault ?? readPowerLevel.user(powerLevels, undefined);
  if (value <= 0) return false;
  const editPowerLevels = readPowerLevel.state(powerLevels, StateEvent.RoomPowerLevels);
  return value >= Math.min(editPowerLevels, ADMIN_POWER);
};

type DefaultPowerWarningProps = {
  powerLevels: IPowerLevels;
  canEdit: boolean;
};
export function DefaultPowerWarning({ powerLevels, canEdit }: DefaultPowerWarningProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const creators = useRoomCreators(room);
  const myUserId = mx.getSafeUserId();

  const usersDefault = readPowerLevel.user(powerLevels, undefined);
  const listed = powerLevels.users ?? {};
  // Resetting must not lock out the person pressing the button: if they only hold power
  // through the default, they keep their current level as an explicit entry.
  const keepsSelf = !creators.has(myUserId) && typeof listed[myUserId] !== 'number';

  const [resetState, reset] = useAsyncCallback(
    useCallback(async () => {
      // edit the raw content so defaults that were never set stay unset
      const content = { ...(getStateEvent(room, StateEvent.RoomPowerLevels)?.getContent() ?? {}) };
      const users: Record<string, number> = { ...(content.users ?? {}) };
      if (keepsSelf) users[myUserId] = usersDefault;
      content.users = users;
      content.users_default = 0;
      await mx.sendStateEvent(room.roomId, StateEvent.RoomPowerLevels as any, content);
    }, [mx, room, keepsSelf, myUserId, usersDefault])
  );
  const resetting = resetState.status === AsyncStatus.Loading;

  if (!isAdminByDefault(powerLevels)) return null;

  return (
    <SequenceCard
      className={SequenceCardStyle}
      variant="Critical"
      direction="Column"
      gap="300"
      role="alert"
    >
      <Box alignItems="Start" gap="300">
        <Icon src={Icons.Warning} filled size="200" />
        <Box grow="Yes" direction="Column" gap="100">
          <Text size="T300">
            <b>Everyone is an admin here</b>
          </Text>
          <Text size="T200">
            Default power is {usersDefault}, so anyone who joins can change permissions, kick and
            ban.
            {canEdit &&
              ` Members given their own level keep it${
                keepsSelf ? `; you stay at ${usersDefault}` : ''
              }.`}
          </Text>
          {resetState.status === AsyncStatus.Error && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              <b>Reset failed: {resetState.error.message}</b>
            </Text>
          )}
        </Box>
      </Box>
      {canEdit && (
        <Box justifyContent="End">
          <Button
            size="300"
            variant="Critical"
            fill="Solid"
            radii="300"
            disabled={resetting}
            before={resetting && <Spinner variant="Critical" fill="Solid" size="100" />}
            onClick={() => reset()}
          >
            <Text size="B300">Reset default to 0</Text>
          </Button>
        </Box>
      )}
    </SequenceCard>
  );
}
