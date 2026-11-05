import React, { useCallback, useEffect } from 'react';
import { Box, Scroll, Spinner, Text, color } from 'folds';
import {
  Outlet,
  generatePath,
  matchPath,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import classNames from 'classnames';

import { AuthFooter } from './AuthFooter';
import * as css from './styles.css';
import * as PatternsCss from '../../styles/Patterns.css';
import {
  clientAllowedServer,
  clientDefaultServer,
  getBrand,
  useClientConfig,
} from '../../hooks/useClientConfig';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { LOGIN_PATH, REGISTER_PATH, RESET_PASSWORD_PATH } from '../paths';
import CinnySVG from '../../../../public/res/svg/cinny.svg';
import { BrandWordmark } from '../../components/pixel-wordmark';
import { ServerPicker } from './ServerPicker';
import { AutoDiscoveryAction, autoDiscovery } from '../../cs-api';
import { SpecVersionsLoader } from '../../components/SpecVersionsLoader';
import { SpecVersionsProvider } from '../../hooks/useSpecVersions';
import { AutoDiscoveryInfoProvider } from '../../hooks/useAutoDiscoveryInfo';
import { AuthFlowsLoader } from '../../components/AuthFlowsLoader';
import { AuthFlowsProvider } from '../../hooks/useAuthFlows';
import { AuthServerProvider } from '../../hooks/useAuthServer';
import { tryDecodeURIComponent } from '../../utils/dom';

const currentAuthPath = (pathname: string): string => {
  if (matchPath(LOGIN_PATH, pathname)) {
    return LOGIN_PATH;
  }
  if (matchPath(RESET_PASSWORD_PATH, pathname)) {
    return RESET_PASSWORD_PATH;
  }
  if (matchPath(REGISTER_PATH, pathname)) {
    return REGISTER_PATH;
  }
  return LOGIN_PATH;
};

function AuthLayoutLoading({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Spinner size="100" variant="Secondary" />
      <Text align="Center" size="T300">
        {message}
      </Text>
    </Box>
  );
}

function AuthLayoutError({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Text align="Center" style={{ color: color.Critical.Main }} size="T300">
        {message}
      </Text>
    </Box>
  );
}

export function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { server: urlEncodedServer } = useParams();

  const clientConfig = useClientConfig();
  const brand = getBrand(clientConfig);

  const defaultServer = clientDefaultServer(clientConfig);
  let server: string = urlEncodedServer ? tryDecodeURIComponent(urlEncodedServer) : defaultServer;

  if (!clientAllowedServer(clientConfig, server)) {
    server = defaultServer;
  }

  const [discoveryState, discoverServer] = useAsyncCallback(
    useCallback(async (serverName: string) => {
      const response = await autoDiscovery(fetch, serverName);
      return {
        serverName,
        response,
      };
    }, [])
  );

  useEffect(() => {
    if (server) discoverServer(server);
  }, [discoverServer, server]);

  // if server is mismatches with path server, update path
  useEffect(() => {
    if (!urlEncodedServer || tryDecodeURIComponent(urlEncodedServer) !== server) {
      navigate(
        generatePath(currentAuthPath(location.pathname), {
          server: encodeURIComponent(server),
        }),
        { replace: true }
      );
    }
  }, [urlEncodedServer, navigate, location, server]);

  const selectServer = useCallback(
    (newServer: string) => {
      if (newServer === server) {
        if (discoveryState.status === AsyncStatus.Loading) return;
        discoverServer(server);
        return;
      }
      navigate(
        generatePath(currentAuthPath(location.pathname), { server: encodeURIComponent(newServer) })
      );
    },
    [navigate, location, discoveryState, server, discoverServer]
  );

  const [autoDiscoveryError, autoDiscoveryInfo] =
    discoveryState.status === AsyncStatus.Success ? discoveryState.data.response : [];

  const statusByAsync: Record<string, 'online' | 'unreachable' | 'searching'> = {
    [AsyncStatus.Success]: 'online',
    [AsyncStatus.Error]: 'unreachable',
  };
  const status = statusByAsync[discoveryState.status] ?? 'searching';
  const statusLabel = {
    online: '● ONLINE',
    unreachable: '× UNREACHABLE',
    searching: '… SEARCHING',
  }[status];

  return (
    <Scroll variant="Background" visibility="Hover" size="300" hideTrack>
      <div className={classNames(css.AuthLayout, PatternsCss.BackgroundDotPattern)}>
        <div className={css.Hud}>
          <span>
            MATRIX <span className={css.HudDim}>/</span> {server.toUpperCase()}
          </span>
          <span className={css.HudStatus} data-status={status}>
            {statusLabel}
          </span>
        </div>

        <div className={css.Stage}>
          <div className={css.Hero}>
            <BrandWordmark className={css.HeroWordmark} />
            <div className={css.HeroRule} aria-hidden />
            {brand.tagline && <p className={css.HeroTagline}>{brand.tagline}</p>}
          </div>

          <section className={css.Console} aria-label="Sign in">
            <div className={css.ConsoleBar}>
              <img className={css.ConsoleLogo} src={brand.logo ?? CinnySVG} alt="" />
              <span>{brand.name}://login</span>
            </div>
            <div className={css.ConsoleBody}>
              <div className={css.Prompt}>
                <span className={css.PromptKey}>&gt; homeserver</span>
                <div className={css.PromptValue}>
                  <ServerPicker
                    server={server}
                    serverList={clientConfig.homeserverList ?? []}
                    allowCustomServer={clientConfig.allowCustomHomeservers}
                    onServerChange={selectServer}
                  />
                </div>
              </div>
              {discoveryState.status === AsyncStatus.Loading && (
                <AuthLayoutLoading message="looking for homeserver…" />
              )}
              {discoveryState.status === AsyncStatus.Error && (
                <AuthLayoutError message="failed to find homeserver." />
              )}
              {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_PROMPT && (
                <AuthLayoutError
                  message={`failed to connect: configuration found with ${autoDiscoveryError.host} appears unusable.`}
                />
              )}
              {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_ERROR && (
                <AuthLayoutError message="failed to connect: homeserver base_url appears invalid." />
              )}
              {discoveryState.status === AsyncStatus.Success && autoDiscoveryInfo && (
                <AuthServerProvider value={discoveryState.data.serverName}>
                  <AutoDiscoveryInfoProvider value={autoDiscoveryInfo}>
                    <SpecVersionsLoader
                      baseUrl={autoDiscoveryInfo['m.homeserver'].base_url}
                      fallback={() => (
                        <AuthLayoutLoading
                          message={`connecting to ${autoDiscoveryInfo['m.homeserver'].base_url}`}
                        />
                      )}
                      error={() => (
                        <AuthLayoutError message="failed to connect: homeserver unavailable or does not exist." />
                      )}
                    >
                      {(specVersions) => (
                        <SpecVersionsProvider value={specVersions}>
                          <AuthFlowsLoader
                            fallback={() => (
                              <AuthLayoutLoading message="loading sign-in methods…" />
                            )}
                            error={() => (
                              <AuthLayoutError message="failed to get sign-in methods." />
                            )}
                          >
                            {(authFlows) => (
                              <AuthFlowsProvider value={authFlows}>
                                <Outlet />
                              </AuthFlowsProvider>
                            )}
                          </AuthFlowsLoader>
                        </SpecVersionsProvider>
                      )}
                    </SpecVersionsLoader>
                  </AutoDiscoveryInfoProvider>
                </AuthServerProvider>
              )}
            </div>
          </section>
        </div>

        <AuthFooter />
      </div>
    </Scroll>
  );
}
