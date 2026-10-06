import React, { useState, useCallback, useEffect } from "react";
import { Languages, Loader2, X, Copy, Check } from "lucide-react";

export function TranslationOverlay() {
  const [text, setText] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleTranslate = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string }>).detail;
      setText(detail.text);
      setTranslatedText(null);
      setError(null);
      setLoading(true);

      const targetLang = "en";
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(detail.text)}`;

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data) && Array.isArray(data[0])) {
            const full = data[0].map((part: unknown[]) => (Array.isArray(part) ? part[0] : "")).join("");
            setTranslatedText(full || "No translation found.");
          } else {
            setTranslatedText("Translation unavailable.");
          }
        })
        .catch(() => setError("Error communicating with translation service"))
        .finally(() => setLoading(false));
    };

    document.addEventListener("fardgram:translate", handleTranslate);
    return () => document.removeEventListener("fardgram:translate", handleTranslate);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!translatedText) return;
    await navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [translatedText]);

  if (!text) return null;

  return (
    <div className="translation-overlay-backdrop" onClick={() => setText(null)}>
      <div className="translation-overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="translation-overlay-header">
          <div className="translation-overlay-title">
            <Languages size={16} strokeWidth={2} />
            <span>Message Translation</span>
          </div>
          <div className="translation-overlay-actions">
            {translatedText && (
              <button type="button" className="icon-button" onClick={handleCopy} title="Copy Translation">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            )}
            <button type="button" className="icon-button" onClick={() => setText(null)} title="Close">
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="translation-overlay-body">
          {loading && (
            <div className="translation-overlay-loading">
              <Loader2 size={18} className="spin" />
              <span>Translating message...</span>
            </div>
          )}
          {error && <p className="translation-overlay-error">{error}</p>}
          {translatedText && !loading && (
            <p className="translation-overlay-text" dir="auto">{translatedText}</p>
          )}
        </div>
        <div className="translation-overlay-source">
          <span>Original Text:</span>
          <p dir="auto">{text}</p>
        </div>
      </div>
    </div>
  );
}
