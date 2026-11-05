import React from 'react';
import parse, { HTMLReactParserOptions } from 'html-react-parser';
import Linkify from 'linkify-react';
import { Opts } from 'linkifyjs';
import { MessageEmptyContent } from './content';
import { sanitizeCustomHtml } from '../../utils/sanitize';
import { highlightText, scaleSystemEmoji } from '../../plugins/react-custom-html-parser';
import { QuirkAffix, renderQuirkText, useQuirk } from '../quirk/Quirk';

type RenderBodyProps = {
  body: string;
  customBody?: string;

  highlightRegex?: RegExp;
  htmlReactParserOptions: HTMLReactParserOptions;
  linkifyOpts: Opts;
};
export function RenderBody({
  body,
  customBody,
  highlightRegex,
  htmlReactParserOptions,
  linkifyOpts,
}: RenderBodyProps) {
  const quirk = useQuirk();

  if (body === '') <MessageEmptyContent />;

  if (quirk && !highlightRegex) {
    return (
      <>
        <QuirkAffix text={quirk.prefix} quirk={quirk} />
        {customBody ? (
          parse(sanitizeCustomHtml(customBody), htmlReactParserOptions)
        ) : (
          <Linkify options={linkifyOpts}>{renderQuirkText(body, quirk, scaleSystemEmoji)}</Linkify>
        )}
        <QuirkAffix text={quirk.suffix} quirk={quirk} />
      </>
    );
  }

  if (customBody) {
    if (customBody === '') <MessageEmptyContent />;
    return parse(sanitizeCustomHtml(customBody), htmlReactParserOptions);
  }
  return (
    <Linkify options={linkifyOpts}>
      {highlightRegex
        ? highlightText(highlightRegex, scaleSystemEmoji(body))
        : scaleSystemEmoji(body)}
    </Linkify>
  );
}
