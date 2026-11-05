import { createContext, useContext } from 'react';

export type HashRouterConfig = {
  enabled?: boolean;
  basename?: string;
};

export type BrandConfig = {
  name?: string;
  tagline?: string;
  subtitle?: string;
  homepage?: { label?: string; url?: string } | null;
  wordmark?: string;
};

export type ClientConfig = {
  defaultHomeserver?: number;
  homeserverList?: string[];
  allowCustomHomeservers?: boolean;

  featuredCommunities?: {
    openAsDefault?: boolean;
    spaces?: string[];
    rooms?: string[];
    servers?: string[];
  };

  hashRouter?: HashRouterConfig;

  brand?: BrandConfig;
};

const ClientConfigContext = createContext<ClientConfig | null>(null);

export const ClientConfigProvider = ClientConfigContext.Provider;

export function useClientConfig(): ClientConfig {
  const config = useContext(ClientConfigContext);
  if (!config) throw new Error('Client config are not provided!');
  return config;
}

export type Brand = {
  name: string;
  tagline: string;
  subtitle: string;
  homepage?: { label: string; url: string };
  wordmark?: string;
};

// astr.to: what the fork shows when config.json has no `brand`
export const DEFAULT_BRAND: Brand = {
  name: 'astr.to',
  tagline: 'matrix for the fireball crew',
  subtitle: 'matrix homeserver',
  homepage: { label: 'astrius.ink', url: 'https://astrius.ink/' },
};

export const getBrand = (clientConfig: ClientConfig): Brand => {
  const brand = clientConfig.brand ?? {};
  let homepage: Brand['homepage'];
  if (brand.homepage === undefined) homepage = DEFAULT_BRAND.homepage;
  else if (brand.homepage?.url) {
    homepage = { url: brand.homepage.url, label: brand.homepage.label || brand.homepage.url };
  }
  return {
    name: brand.name || DEFAULT_BRAND.name,
    tagline: brand.tagline ?? DEFAULT_BRAND.tagline,
    subtitle: brand.subtitle ?? DEFAULT_BRAND.subtitle,
    homepage,
    wordmark: brand.wordmark || undefined,
  };
};

export const useBrand = (): Brand => getBrand(useClientConfig());

export const clientDefaultServer = (clientConfig: ClientConfig): string =>
  clientConfig.homeserverList?.[clientConfig.defaultHomeserver ?? 0] ?? 'matrix.org';

export const clientAllowedServer = (clientConfig: ClientConfig, server: string): boolean => {
  const { homeserverList, allowCustomHomeservers } = clientConfig;

  if (allowCustomHomeservers) return true;

  return homeserverList?.includes(server) === true;
};
