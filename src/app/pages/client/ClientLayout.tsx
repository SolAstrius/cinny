import React, { ReactNode } from 'react';
import { Box } from 'folds';
import { AstrShell } from '../../styles/NightTheme.css';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  return (
    <Box grow="Yes" className={AstrShell}>
      <Box shrink="No">{nav}</Box>
      <Box grow="Yes">{children}</Box>
    </Box>
  );
}
