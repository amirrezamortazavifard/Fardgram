import { useState, useCallback, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";

export interface RichCodeBlockProps {
  language?: string;
  children: ReactNode;
  rawText?: string;
  className?: string;
}

export function RichCodeBlock({
  language,
  children,
  rawText,
  className = "",
}: RichCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      let textToCopy = rawText;
      if (!textToCopy) {
        if (typeof children === "string") {
          textToCopy = children;
        } else if (Array.isArray(children)) {
          textToCopy = children
            .map((item) => (typeof item === "string" ? item : ""))
            .join("");
        }
      }
      if (textToCopy) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard write failures in sandboxed test environments
    }
  }, [children, rawText]);

  const displayLanguage = language ? language.toUpperCase() : "CODE";

  return (
    <div
      className={`rich-code-block-container ${className}`.trim()}
      data-language={language}
      dir="ltr"
    >
      <div className="rich-code-header">
        <span className="rich-code-language">{displayLanguage}</span>
        <button
          type="button"
          className="rich-code-copy-btn"
          onClick={handleCopy}
          title="Copy code"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="copied-label">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="rich-code-pre">
        <code data-language={language}>{children}</code>
      </pre>
    </div>
  );
}
