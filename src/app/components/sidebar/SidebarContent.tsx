import React, { ReactNode } from 'react';
import { Box } from 'folds';
import classNames from 'classnames';
import { AstrHole, AstrPanel, AstrRailPart } from '../../styles/NightTheme.css';

type SidebarContentProps = {
  scrollable: ReactNode;
  sticky: ReactNode;
};
export function SidebarContent({ scrollable, sticky }: SidebarContentProps) {
  return (
    <>
      {/* astr.to: the rail is two floating pieces with a hole of sky between them */}
      <Box direction="Column" className={classNames(AstrPanel, AstrRailPart)}>
        {scrollable}
      </Box>
      <div className={AstrHole} aria-hidden />
      <Box direction="Column" shrink="No" className={AstrPanel}>
        {sticky}
      </Box>
    </>
  );
}
