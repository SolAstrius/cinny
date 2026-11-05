import React from 'react';
import { Box, Text } from 'folds';
import * as css from './styles.css';

export function AuthFooter() {
  return (
    <Box className={css.AuthFooter} justifyContent="Center" gap="400" wrap="Wrap">
      <Text
        as="a"
        size="T300"
        href="https://github.com/cinnyapp/cinny/releases/tag/v4.12.8"
        target="_blank"
        rel="noreferrer"
      >
        Cinny v4.12.8
      </Text>
      <Text as="a" size="T300" href="https://matrix.org" target="_blank" rel="noreferrer">
        Powered by Matrix
      </Text>
    </Box>
  );
}
