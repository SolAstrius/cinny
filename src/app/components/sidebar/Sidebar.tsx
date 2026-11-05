import classNames from 'classnames';
import { as } from 'folds';
import React from 'react';
import * as css from './Sidebar.css';
import { AstrRail } from '../../styles/NightTheme.css';

export const Sidebar = as<'div'>(({ as: AsSidebar = 'div', className, ...props }, ref) => (
  <AsSidebar className={classNames(css.Sidebar, AstrRail, className)} {...props} ref={ref} />
));
