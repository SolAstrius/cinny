import React, { useState } from 'react';
import { Box, Button, Text } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useFilePicker } from '../../../hooks/useFilePicker';
import { StickerImportDialog, StickerImportSource } from '../../sticker-import';

export function ImportPack() {
  const [source, setSource] = useState<StickerImportSource>();
  const pickFiles = useFilePicker((files: File[]) => {
    if (files.length > 0) setSource({ kind: 'files', files });
  }, true);

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Import</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Import Pack"
          description="Make a pack from a zip archive or a few images, for yourself or for a room."
          after={
            <Button
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
              onClick={() =>
                pickFiles('.zip,application/zip,image/png,image/gif,image/webp,image/jpeg')
              }
            >
              <Text size="B300">Import…</Text>
            </Button>
          }
        />
      </SequenceCard>
      {source && <StickerImportDialog source={source} requestClose={() => setSource(undefined)} />}
    </Box>
  );
}
