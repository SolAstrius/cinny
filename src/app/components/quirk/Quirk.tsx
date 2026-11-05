import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import {
  Quirk,
  QUIRK_PROFILE_KEY,
  parseQuirk,
  splitQuirkSegments,
  transformQuirkString,
} from '../../utils/quirk';
import { useExtendedProfile } from '../../hooks/useExtendedProfile';
import { settingsAtom } from '../../state/settings';

const QuirkContext = createContext<Quirk | undefined>(undefined);

export const useQuirk = (): Quirk | undefined => useContext(QuirkContext);

export function QuirkProvider({ quirk, children }: { quirk?: Quirk; children: ReactNode }) {
  return <QuirkContext.Provider value={quirk}>{children}</QuirkContext.Provider>;
}

const QUIRK_MSGTYPES = ['m.text', 'm.emote'];

/** Provides the sender's typing quirk (if any, and if enabled) to the message body below it. */
export function SenderQuirk({
  userId,
  msgType,
  children,
}: {
  userId: string;
  msgType: string;
  children: ReactNode;
}) {
  const { showQuirks } = useAtomValue(settingsAtom);
  const enabled = showQuirks !== false && QUIRK_MSGTYPES.includes(msgType);
  const profile = useExtendedProfile(userId, enabled);
  const raw = enabled ? profile?.[QUIRK_PROFILE_KEY] : undefined;
  const quirk = useMemo(() => (raw === undefined ? undefined : parseQuirk(raw)), [raw]);

  return <QuirkProvider quirk={quirk}>{children}</QuirkProvider>;
}

type Decorate = (text: string) => (string | JSX.Element)[];
const plain: Decorate = (text) => [text];

/**
 * Quirk a plain string into React nodes: links and Matrix IDs are passed through
 * untouched (so Linkify still finds them); everything else is transformed and coloured.
 */
export const renderQuirkText = (
  text: string,
  quirk: Quirk,
  decorate: Decorate = plain
): (string | JSX.Element)[] => {
  const state = { letter: 0 };
  const out: (string | JSX.Element)[] = [];
  splitQuirkSegments(text).forEach((segment, index) => {
    if (segment.keep) {
      out.push(...decorate(segment.text));
      return;
    }
    const key = `q${index}`;
    out.push(
      <span key={key} data-quirk="" style={quirk.color ? { color: quirk.color } : undefined}>
        {decorate(transformQuirkString(segment.text, quirk, state))}
      </span>
    );
  });
  return out;
};

export function QuirkAffix({ text, quirk }: { text: string; quirk: Quirk }) {
  if (!text) return null;
  return (
    <span data-quirk="" style={quirk.color ? { color: quirk.color } : undefined}>
      {text}
    </span>
  );
}

/**
 * Text-node renderer used by the HTML message parser: falls back to the given
 * default rendering unless a quirk is in context.
 */
export function QuirkTextNode({
  text,
  fallback,
  wrap,
  decorate,
}: {
  text: string;
  fallback: ReactNode;
  wrap: (nodes: (string | JSX.Element)[]) => ReactNode;
  decorate?: Decorate;
}) {
  const quirk = useQuirk();
  if (!quirk) return fallback as JSX.Element;
  return <>{wrap(renderQuirkText(text, quirk, decorate))}</>;
}
