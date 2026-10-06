import { translate } from "../i18n";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Children, memo, useMemo, type ReactNode } from "react";
import type { Components } from "react-markdown";
import { handleExternalLinkClick, safeExternalHref as safeHref } from "../utils/externalLinks";
import { highlightTextNodes } from "../utils/textHighlight";
import { CollapsibleBlockQuote, type CollapseQuoteHandler, type ExpandQuoteHandler } from "./CollapsibleBlockQuote";
import { createMarkdownParseCache } from "../utils/markdownParseCache";
import { telegramStore } from "../store/telegramStore";

const markdownCache = createMarkdownParseCache();
const remarkPlugins = [remarkGfm, markdownCache.plugin];
telegramStore.subscribe((state, previous) => {
  if (state.activeAccountId !== previous.activeAccountId) markdownCache.clear();
});

import { isRtlText } from "../utils/textDirection";

interface MarkdownTextProps {
  text: string;
  className: string;
  highlightQuery?: string;
  dir?: "rtl" | "ltr" | "auto";
  onCollapseQuote?: CollapseQuoteHandler;
  onExpandQuote?: ExpandQuoteHandler;
}

function MarkdownText({ text, className, highlightQuery, dir, onCollapseQuote, onExpandQuote }: MarkdownTextProps) {
  useTranslation();
  const highlight = (children: ReactNode) => highlightTextNodes(children, highlightQuery);
  const resolvedDir = dir && dir !== "auto" ? dir : (isRtlText(text) ? "rtl" : "ltr");
  const components = useMemo<Components>(() => ({
    a: ({ children, href }) => {
      const safe = safeHref(href);
      return safe
        ? <a href={safe} target="_blank" rel="noreferrer" onClick={handleExternalLinkClick}>{highlight(children)}</a>
        : <>{highlight(children)}</>;
    },
    img: ({ alt }) => <span className="rich-image-alt">{alt || translate("图片")}</span>,
    p: ({ children }) => <p dir="auto">{highlight(children)}</p>,
    h1: ({ children }) => <h1 dir="auto">{highlight(children)}</h1>,
    h2: ({ children }) => <h2 dir="auto">{highlight(children)}</h2>,
    h3: ({ children }) => <h3 dir="auto">{highlight(children)}</h3>,
    h4: ({ children }) => <h4 dir="auto">{highlight(children)}</h4>,
    h5: ({ children }) => <h5 dir="auto">{highlight(children)}</h5>,
    h6: ({ children }) => <h6 dir="auto">{highlight(children)}</h6>,
    li: ({ children }) => <li dir="auto">{highlight(children)}</li>,
    // Ignore parser separators between blocks; pre-wrap would turn them into empty preview lines.
    blockquote: ({ children, node }) => (
      <CollapsibleBlockQuote as="blockquote" resetKey={text}
        layoutSource={node?.position?.start.offset !== undefined && node.position.end.offset !== undefined
          ? text.slice(node.position.start.offset, node.position.end.offset) : undefined}
        onCollapse={onCollapseQuote} onExpand={onExpandQuote}>
        {highlight(Children.toArray(children).filter((child) => typeof child !== "string" || child.trim()))}
      </CollapsibleBlockQuote>
    ),
    td: ({ children }) => <td>{highlight(children)}</td>,
    th: ({ children }) => <th>{highlight(children)}</th>,
    pre: ({ children }) => <pre>{highlight(children)}</pre>,
  }), [text, highlightQuery, onCollapseQuote, onExpandQuote]);
  return (
    <div className={`message-rich-text ${className}`} data-rich-text="markdown" dir={resolvedDir}>
      <Markdown
        remarkPlugins={remarkPlugins}
        skipHtml
        urlTransform={(url) => safeHref(url) ?? ""}
        components={components}
      >
        {text}
      </Markdown>
    </div>
  );
}

export default memo(MarkdownText);
