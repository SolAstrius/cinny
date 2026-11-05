import React from 'react';
import * as css from './styles.css';

export function AuthFooter() {
  return (
    <footer className={css.AuthFooter}>
      <span>astr.to · matrix homeserver</span>
      <a href="https://astrius.ink/" target="_blank" rel="noreferrer">
        astrius.ink
      </a>
    </footer>
  );
}
