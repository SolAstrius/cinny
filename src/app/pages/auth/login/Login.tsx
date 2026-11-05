import React, { useMemo } from 'react';
import { Text, color } from 'folds';
import { Link, useSearchParams } from 'react-router-dom';
import { SSOAction } from 'matrix-js-sdk';
import { useAuthFlows } from '../../../hooks/useAuthFlows';
import { useAuthServer } from '../../../hooks/useAuthServer';
import { useParsedLoginFlows } from '../../../hooks/useParsedLoginFlows';
import { PasswordLoginForm } from './PasswordLoginForm';
import { SSOLogin } from '../SSOLogin';
import { TokenLogin } from './TokenLogin';
import * as css from '../styles.css';
import { getLoginPath, getRegisterPath, withSearchParam } from '../../pathUtils';
import { usePathWithOrigin } from '../../../hooks/usePathWithOrigin';
import { LoginPathSearchParams } from '../../paths';
import { useClientConfig } from '../../../hooks/useClientConfig';

const getLoginTokenSearchParam = () => {
  // when using hasRouter query params in existing route
  // gets ignored by react-router, so we need to read it ourself
  // we only need to read loginToken as it's the only param that
  // is provided by external entity. example: SSO login
  const parmas = new URLSearchParams(window.location.search);
  const loginToken = parmas.get('loginToken');
  return loginToken ?? undefined;
};

const useLoginSearchParams = (searchParams: URLSearchParams): LoginPathSearchParams =>
  useMemo(
    () => ({
      username: searchParams.get('username') ?? undefined,
      email: searchParams.get('email') ?? undefined,
      loginToken: searchParams.get('loginToken') ?? undefined,
    }),
    [searchParams]
  );

export function Login() {
  const server = useAuthServer();
  const { hashRouter } = useClientConfig();
  const { loginFlows } = useAuthFlows();
  const [searchParams] = useSearchParams();
  const loginSearchParams = useLoginSearchParams(searchParams);
  const ssoRedirectUrl = usePathWithOrigin(getLoginPath(server));
  const loginTokenForHashRouter = getLoginTokenSearchParam();
  const absoluteLoginPath = usePathWithOrigin(getLoginPath(server));

  if (hashRouter?.enabled && loginTokenForHashRouter) {
    window.location.replace(
      withSearchParam(absoluteLoginPath, {
        loginToken: loginTokenForHashRouter,
      })
    );
  }

  const parsedFlows = useParsedLoginFlows(loginFlows.flows);

  const ssoProviders = parsedFlows.sso?.identity_providers;

  return (
    <div className={css.ConsoleStack}>
      {parsedFlows.token && loginSearchParams.loginToken && (
        <TokenLogin token={loginSearchParams.loginToken} />
      )}
      {parsedFlows.sso && (
        <>
          <div className={css.Prompt}>
            <span className={css.PromptKey}>&gt; method</span>
            <span className={css.PromptText}>authentik</span>
          </div>
          <SSOLogin
            providers={ssoProviders}
            redirectUrl={ssoRedirectUrl}
            action={SSOAction.LOGIN}
            saveScreenSpace={false}
          />
        </>
      )}
      {parsedFlows.password && (
        <details className={css.Fold} open={!parsedFlows.sso || undefined}>
          <summary className={css.FoldSummary}>&gt; password login</summary>
          <div className={css.FoldBody}>
            <PasswordLoginForm
              defaultUsername={loginSearchParams.username}
              defaultEmail={loginSearchParams.email}
            />
          </div>
        </details>
      )}
      {!parsedFlows.password && !parsedFlows.sso && (
        <Text style={{ color: color.Critical.Main }}>
          {`This client does not support login on "${server}": no password or SSO login method found.`}
        </Text>
      )}
      <p className={css.ConsoleNote}>
        no account? <Link to={getRegisterPath(server)}>&gt; register</Link>
      </p>
    </div>
  );
}
