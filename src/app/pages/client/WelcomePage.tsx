import React from 'react';
import { Page } from '../../components/page';
import WordmarkSVG from '../../../../public/res/astr/wordmark.svg';
import * as css from './WelcomePage.css';

export function WelcomePage() {
  return (
    <Page>
      <div className={css.Welcome}>
        <img className={css.Wordmark} src={WordmarkSVG} alt="astr.to" />
        <div className={css.Rule} aria-hidden />
        <p className={css.Line}>matrix for the fireball crew</p>
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
