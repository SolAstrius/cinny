/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';
import './app/styles/NightTheme.css';

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';

// import i18n (needs to be bundled ;))
import './app/i18n';
import { pushSessionToSW } from './sw-session';
import { getFallbackSession } from './app/state/sessions';

document.body.classList.add(configClass, varsClass);

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  const sendSessionToSW = () => {
    const session = getFallbackSession();
    pushSessionToSW(session?.baseUrl, session?.accessToken);
  };

  navigator.serviceWorker.register(swUrl).then(sendSessionToSW);
  navigator.serviceWorker.ready.then(sendSessionToSW);
  // astr.to: authenticated media only works through the worker. A page loaded without one in control
  // (hard reload, or loaded before the worker activated) never gets one, and every image then fails
  // with 401. Reload once in that case; the session flag stops a loop if the browser won't attach it.
  navigator.serviceWorker.ready.then(() => {
    window.setTimeout(() => {
      if (navigator.serviceWorker.controller) {
        sessionStorage.removeItem('astr-sw-reload');
        return;
      }
      if (sessionStorage.getItem('astr-sw-reload')) return;
      sessionStorage.setItem('astr-sw-reload', '1');
      window.location.reload();
    }, 1500);
  });
  // a new worker taking over (redeploy, clients.claim) starts with no session: hand it ours
  navigator.serviceWorker.addEventListener('controllerchange', sendSessionToSW);

  navigator.serviceWorker.addEventListener('message', (ev) => {
    const { type } = ev.data ?? {};

    if (type === 'requestSession') {
      sendSessionToSW();
    }
  });
}

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
};

mountApp();
