import { IIdentityProvider, SSOAction, createClient } from 'matrix-js-sdk';
import React, { useMemo } from 'react';
import { useAutoDiscoveryInfo } from '../../hooks/useAutoDiscoveryInfo';
import * as css from './styles.css';

type SSOLoginProps = {
  providers?: IIdentityProvider[];
  redirectUrl: string;
  action?: SSOAction;
  // eslint-disable-next-line react/no-unused-prop-types -- kept for upstream callers; astr.to always shows full buttons
  saveScreenSpace?: boolean;
};
export function SSOLogin({ providers, redirectUrl, action }: SSOLoginProps) {
  const discovery = useAutoDiscoveryInfo();
  const baseUrl = discovery['m.homeserver'].base_url;
  const mx = useMemo(() => createClient({ baseUrl }), [baseUrl]);

  const getSSOIdUrl = (ssoId?: string): string =>
    mx.getSsoLoginUrl(redirectUrl, 'sso', ssoId, action);

  const label = (name?: string) =>
    // astr.to: the server calls its Authentik provider "keycloak"
    !name || /keycloak|authentik/i.test(name) ? 'Enter via Authentik' : `Enter via ${name}`;

  return (
    <div className={css.EnterStack}>
      {(providers ?? [undefined]).map((provider) => (
        <a key={provider?.id ?? 'sso'} className={css.EnterButton} href={getSSOIdUrl(provider?.id)}>
          {label(provider?.name)}
        </a>
      ))}
    </div>
  );
}
