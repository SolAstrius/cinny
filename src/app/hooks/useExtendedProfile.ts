import { useEffect, useState } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export const STATUS_PROFILE_KEY = 'ink.astrius.status';
export const MUSIC_PROFILE_KEY = 'ink.astrius.music';

export type ExtendedProfile = Record<string, unknown>;

type Entry = {
  ts: number;
  profile?: ExtendedProfile;
  pending?: Promise<void>;
};

const TTL_MS = 10 * 60 * 1000;
const FAILED_TTL_MS = 30 * 60 * 1000;
const MAX_CONCURRENT = 4;

/**
 * Session-wide cache of MSC4133 extended profiles, one entry per user.
 * Remote users fetched over federation may have no fields or fail entirely;
 * both are cached as "empty" so nothing is re-requested per render.
 */
const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<(p: ExtendedProfile | undefined) => void>>();
const queue: (() => void)[] = [];
let running = 0;

const notify = (userId: string) => {
  const profile = cache.get(userId)?.profile;
  listeners.get(userId)?.forEach((cb) => cb(profile));
};

const runNext = () => {
  if (running >= MAX_CONCURRENT) return;
  const job = queue.shift();
  if (!job) return;
  running += 1;
  job();
};

const isFresh = (entry: Entry | undefined): boolean => {
  if (!entry) return false;
  if (entry.pending) return true;
  const ttl = entry.profile ? TTL_MS : FAILED_TTL_MS;
  return Date.now() - entry.ts < ttl;
};

const fetchProfile = (mx: MatrixClient, userId: string): void => {
  if (isFresh(cache.get(userId))) return;

  const previous = cache.get(userId);
  const pending = new Promise<void>((resolve) => {
    queue.push(() => {
      mx.getExtendedProfile(userId)
        .then((profile) => {
          cache.set(userId, {
            ts: Date.now(),
            profile: typeof profile === 'object' && profile ? profile : {},
          });
        })
        .catch(() => {
          cache.set(userId, { ts: Date.now(), profile: previous?.profile });
        })
        .finally(() => {
          running -= 1;
          notify(userId);
          resolve();
          runNext();
        });
    });
  });
  cache.set(userId, { ts: previous?.ts ?? 0, profile: previous?.profile, pending });
  runNext();
};

export const getCachedExtendedProfile = (userId: string): ExtendedProfile | undefined =>
  cache.get(userId)?.profile;

/** Update the cache after we change our own profile, so every view refreshes at once. */
export const setCachedExtendedProfileField = (userId: string, key: string, value: unknown) => {
  const profile = { ...(cache.get(userId)?.profile ?? {}) };
  if (value === undefined || value === null) delete profile[key];
  else profile[key] = value;
  cache.set(userId, { ts: Date.now(), profile });
  notify(userId);
};

export const useExtendedProfile = (
  userId: string | undefined,
  enabled = true
): ExtendedProfile | undefined => {
  const mx = useMatrixClient();
  const [profile, setProfile] = useState<ExtendedProfile | undefined>(() =>
    userId ? getCachedExtendedProfile(userId) : undefined
  );

  useEffect(() => {
    if (!userId || !enabled) {
      setProfile(undefined);
      return undefined;
    }
    setProfile(getCachedExtendedProfile(userId));
    let set = listeners.get(userId);
    if (!set) {
      set = new Set();
      listeners.set(userId, set);
    }
    set.add(setProfile);
    fetchProfile(mx, userId);
    return () => {
      set?.delete(setProfile);
    };
  }, [mx, userId, enabled]);

  return profile;
};

export const getProfileString = (
  profile: ExtendedProfile | undefined,
  key: string,
  maxLength = 200
): string | undefined => {
  const value = profile?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

export const setOwnProfileField = async (
  mx: MatrixClient,
  key: string,
  value: unknown
): Promise<void> => {
  const userId = mx.getSafeUserId();
  if (value === undefined || value === null || value === '') {
    await mx.deleteExtendedProfileProperty(key);
    setCachedExtendedProfileField(userId, key, undefined);
    return;
  }
  await mx.setExtendedProfileProperty(key, value);
  setCachedExtendedProfileField(userId, key, value);
};
