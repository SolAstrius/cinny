import React, {
  ChangeEventHandler,
  FormEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Box, Button, color, config, Icon, IconButton, Icons, Input, Spinner, Text } from 'folds';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import {
  getProfileString,
  setOwnProfileField,
  useExtendedProfile,
} from '../../../hooks/useExtendedProfile';

type ProfileTextFieldProps = {
  profileKey: string;
  title: string;
  placeholder?: string;
  maxLength?: number;
};

/** One free-text MSC4133 profile field; saving an empty value deletes the key. */
export function ProfileTextField({
  profileKey,
  title,
  placeholder,
  maxLength = 120,
}: ProfileTextFieldProps) {
  const mx = useMatrixClient();
  const userId = mx.getSafeUserId();
  const profile = useExtendedProfile(userId);
  const current = getProfileString(profile, profileKey, maxLength) ?? '';
  const [value, setValue] = useState(current);

  useEffect(() => {
    setValue(current);
  }, [current]);

  const [saveState, save] = useAsyncCallback(
    useCallback((v: string) => setOwnProfileField(mx, profileKey, v.trim()), [mx, profileKey])
  );
  const saving = saveState.status === AsyncStatus.Loading;

  const handleChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setValue(evt.currentTarget.value);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    if (saving) return;
    save(value);
  };

  const hasChanges = value.trim() !== current;

  return (
    <SettingTile
      title={
        <Text as="span" size="L400">
          {title}
        </Text>
      }
    >
      <Box direction="Column" grow="Yes" gap="100">
        <Box as="form" onSubmit={handleSubmit} gap="200" aria-disabled={saving}>
          <Box grow="Yes" direction="Column">
            <Input
              name={`${profileKey}-input`}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              maxLength={maxLength}
              variant="Secondary"
              radii="300"
              style={{ paddingRight: config.space.S200 }}
              readOnly={saving}
              after={
                hasChanges &&
                !saving && (
                  <IconButton
                    type="reset"
                    onClick={() => setValue(current)}
                    size="300"
                    radii="300"
                    variant="Secondary"
                  >
                    <Icon src={Icons.Cross} size="100" />
                  </IconButton>
                )
              }
            />
          </Box>
          <Button
            size="400"
            variant={hasChanges ? 'Success' : 'Secondary'}
            fill={hasChanges ? 'Solid' : 'Soft'}
            outlined
            radii="300"
            disabled={!hasChanges || saving}
            type="submit"
          >
            {saving && <Spinner variant="Success" fill="Solid" size="300" />}
            <Text size="B400">Save</Text>
          </Button>
        </Box>
        {saveState.status === AsyncStatus.Error && (
          <Text size="T200" style={{ color: color.Critical.Main }}>
            Could not save: {saveState.error instanceof Error ? saveState.error.message : 'error'}
          </Text>
        )}
      </Box>
    </SettingTile>
  );
}
