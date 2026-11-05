import React from 'react';
import { Page } from '../../components/page';
import { BrandWordmark } from '../../components/pixel-wordmark';
import { useBrand } from '../../hooks/useClientConfig';
import * as css from './WelcomePage.css';

export function WelcomePage() {
  const brand = useBrand();
  return (
    <Page>
      <div className={css.Welcome}>
        <BrandWordmark className={css.Wordmark} />
        <div className={css.Rule} aria-hidden />
        {brand.tagline && <p className={css.Line}>{brand.tagline}</p>}
        <p className={css.Prompt}>&gt; pick a room on the left, or start one with +</p>
        <a
          className={css.Source}
          href="https://github.com/cinnyapp/cinny/releases/tag/v4.12.8"
          target="_blank"
          rel="noreferrer noopener"
        >
          based on cinny v4.12.8
        </a>
      </div>
    </Page>
  );
}
