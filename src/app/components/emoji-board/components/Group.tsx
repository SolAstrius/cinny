import { as, Box, Text } from 'folds';
import React, { ReactNode } from 'react';
import classNames from 'classnames';
import * as css from './styles.css';

export const getDOMGroupId = (id: string): string => `EmojiBoardGroup-${id}`;

export const EmojiGroup = as<
  'div',
  {
    id: string;
    label: string;
    action?: ReactNode;
    children: ReactNode;
  }
>(({ className, id, label, action, children, ...props }, ref) => (
  <Box
    id={getDOMGroupId(id)}
    data-group-id={id}
    className={classNames(css.EmojiGroup, className)}
    direction="Column"
    gap="200"
    {...props}
    ref={ref}
  >
    <Box className={css.EmojiGroupLabel} alignItems="Center" gap="200">
      <Text id={`EmojiGroup-${id}-label`} as="label" size="O400">
        {label}
      </Text>
      {action}
    </Box>
    <div aria-labelledby={`EmojiGroup-${id}-label`} className={css.EmojiGroupContent}>
      <Box wrap="Wrap" justifyContent="Center">
        {children}
      </Box>
    </div>
  </Box>
));
