import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Text } from 'folds';
import * as css from './Maths.css';
import * as customHtmlCss from '../../styles/CustomHtml.css';
import { loadMaths, MathsRender, renderMathsSync } from '.';

type MathsProps = {
  tex: string;
  display: boolean;
};

export function Maths({ tex, display }: MathsProps) {
  const [result, setResult] = useState<MathsRender | undefined>(() =>
    renderMathsSync(tex, display)
  );

  useEffect(() => {
    const ready = renderMathsSync(tex, display);
    if (ready) {
      setResult(ready);
      return undefined;
    }
    let alive = true;
    loadMaths()
      .then(() => {
        if (alive) setResult(renderMathsSync(tex, display));
      })
      .catch(() => {
        if (alive) setResult({ error: 'Maths renderer failed to load' });
      });
    return () => {
      alive = false;
    };
  }, [tex, display]);

  const Tag = display ? 'div' : 'span';

  if (result && 'html' in result) {
    return (
      <Tag
        className={classNames('mx-maths', display ? css.MathsDisplay : css.MathsInline)}
        data-mx-maths={tex}
        // Temml builds the markup from the TeX itself with trust disabled, so it never carries
        // raw HTML from the event.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    );
  }

  const error = result && 'error' in result ? result.error : undefined;
  const code = (
    <Text
      as="code"
      size="T300"
      className={classNames(customHtmlCss.Code, error && css.MathsFallback)}
      title={error}
    >
      {tex}
    </Text>
  );
  return display ? (
    <div className={css.MathsDisplay} data-mx-maths={tex}>
      {code}
    </div>
  ) : (
    <span data-mx-maths={tex}>{code}</span>
  );
}
