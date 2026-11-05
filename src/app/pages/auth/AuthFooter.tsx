import React from 'react';
import * as css from './styles.css';
import { useBrand } from '../../hooks/useClientConfig';

export function AuthFooter() {
  const brand = useBrand();
  return (
    <footer className={css.AuthFooter}>
      <span>{[brand.name, brand.subtitle].filter(Boolean).join(' · ')}</span>
      {brand.homepage && (
        <a href={brand.homepage.url} target="_blank" rel="noreferrer">
          {brand.homepage.label}
        </a>
      )}
    </footer>
  );
}
