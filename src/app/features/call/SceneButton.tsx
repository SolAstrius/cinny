import React, { MouseEventHandler, useState } from 'react';
import {
  Box,
  color,
  config,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { MatrixError } from 'matrix-js-sdk';
import { useRoom } from '../../hooks/useRoom';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { sceneSwitchContent, useRoomScene } from '../../hooks/useRoomScene';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { RoomSettingsPage } from '../../state/roomSettings';
import { SCENE_INFO, SceneName, SCENES } from '../../plugins/call/CallScene';
import { stopPropagation } from '../../utils/keyboard';

/** Quick switch for the room's call scene; shown only to members who may change it. */
export function SceneButton() {
  const room = useRoom();
  const space = useSpaceOptionally();
  const { scene, canEdit, send } = useRoomScene(room);
  const openSettings = useOpenRoomSettings();
  const [cords, setCords] = useState<RectCords>();

  const [switchState, switchScene] = useAsyncCallback(send);
  const switching = switchState.status === AsyncStatus.Loading;

  if (!canEdit) return null;

  const handleOpen: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setCords(evt.currentTarget.getBoundingClientRect());
  };

  const pick = (name: SceneName | null) => {
    setCords(undefined);
    if ((scene?.scene ?? null) === name) return;
    switchScene(sceneSwitchContent(name, scene)).catch(() => undefined);
  };

  const options: { name: SceneName | null; label: string }[] = [
    { name: null, label: 'None' },
    ...SCENES.map((name) => ({ name, label: SCENE_INFO[name].label })),
  ];

  return (
    <PopOut
      anchor={cords}
      position="Top"
      align="Center"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setCords(undefined),
            clickOutsideDeactivates: true,
            isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
            isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu>
            <Box direction="Column" style={{ padding: config.space.S100 }}>
              <Box style={{ padding: `${config.space.S100} ${config.space.S200}` }}>
                <Text size="L400">Scene</Text>
              </Box>
              {options.map(({ name, label }) => {
                const active = (scene?.scene ?? null) === name;
                return (
                  <MenuItem
                    key={label}
                    size="300"
                    variant="Surface"
                    radii="300"
                    aria-pressed={active}
                    onClick={() => pick(name)}
                    after={active ? <Icon size="100" src={Icons.Check} /> : undefined}
                  >
                    <Text size="B300" truncate>
                      {label}
                    </Text>
                  </MenuItem>
                );
              })}
              <Line variant="Surface" size="300" style={{ margin: `${config.space.S100} 0` }} />
              <MenuItem
                size="300"
                variant="Surface"
                radii="300"
                onClick={() => {
                  setCords(undefined);
                  openSettings(room.roomId, space?.roomId, RoomSettingsPage.ScenePage);
                }}
              >
                <Text size="B300" truncate>
                  Scene Settings
                </Text>
              </MenuItem>
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      <TooltipProvider
        position="Top"
        delay={500}
        tooltip={
          <Tooltip>
            {switchState.status === AsyncStatus.Error ? (
              <Text size="T200" style={{ color: color.Critical.Main }}>
                {(switchState.error as MatrixError).message}
              </Text>
            ) : (
              <Text size="T200">
                {scene ? `Scene: ${SCENE_INFO[scene.scene].label}` : 'Choose Scene'}
              </Text>
            )}
          </Tooltip>
        }
      >
        {(anchorRef) => (
          <IconButton
            ref={anchorRef}
            variant={scene ? 'Success' : 'Surface'}
            fill="Soft"
            radii="400"
            size="400"
            onClick={handleOpen}
            outlined
            aria-pressed={!!cords}
            aria-label="Scene"
            disabled={switching}
          >
            {switching ? (
              <Spinner size="200" variant="Secondary" />
            ) : (
              <Icon size="400" src={Icons.Photo} filled={!!scene} />
            )}
          </IconButton>
        )}
      </TooltipProvider>
    </PopOut>
  );
}
