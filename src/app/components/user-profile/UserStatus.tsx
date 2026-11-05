import React from 'react';
import { Box, Text } from 'folds';
import classNames from 'classnames';
import {
  MUSIC_PROFILE_KEY,
  STATUS_PROFILE_KEY,
  getProfileString,
  useExtendedProfile,
} from '../../hooks/useExtendedProfile';
import { BreakWord, LineClamp3 } from '../../styles/Text.css';

/** Status and now-playing lines from the MSC4133 profile; renders nothing when both are absent. */
export function UserStatus({ userId }: { userId: string }) {
  const profile = useExtendedProfile(userId);
  const status = getProfileString(profile, STATUS_PROFILE_KEY);
  const music = getProfileString(profile, MUSIC_PROFILE_KEY);

  if (!status && !music) return null;

  return (
    <Box direction="Column" gap="100">
      {status && (
        <Text size="T300" className={classNames(BreakWord, LineClamp3)}>
          {status}
        </Text>
      )}
      {music && (
        <Box gap="200" alignItems="Baseline">
          <Text as="span" size="T300" priority="300" aria-label="Now playing">
            ♪
          </Text>
          <Text size="T300" priority="300" className={classNames(BreakWord, LineClamp3)}>
            {music}
          </Text>
        </Box>
      )}
    </Box>
  );
}
