import { translate } from "../i18n";
import { Clock3, Images, LoaderCircle, Search, Sticker, X, Plus, Sparkles } from "lucide-react";
import { openExternalLink } from "../utils/externalLinks";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEventHandler,
} from "react";
import { useTelegramStore } from "../store/telegramStore";
import { autoplayAllowed } from "../utils/motionPreference";
import { usePreferencesStore } from "../store/preferencesStore";
import type {
  EmojiPickerAsset,
  EmojiPickerCatalog,
  MessageReplyQuote,
  StickerSet,
} from "../telegram/types";
import { EmojiAssetVisual } from "./EmojiAssetVisual";

type PickerTab = "emoji" | "sticker" | "animation";

interface EmojiPickerProps {
  chatId: string;
  replyToMessageId?: string;
  replyQuote?: MessageReplyQuote;
  disableNotification?: boolean;
  onEmoji: (emoji: string) => void;
  onAssetSent: () => void;
  onClose: (restoreFocus?: boolean) => void;
  onRequestComposerFocus: () => void;
  onCaptureComposerFocus: () => () => void;
  onPointerEnter?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
}

const RECENT_EMOJI_KEY = "fardgram.recent-emojis";
const RECENT_STICKERS = "recent";

const emojiGroups = [
  {
    id: "faces",
    get title() { return translate("Smileys & People"); },
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🫡 🤫 🫠 🤥 😶 🫥 😐 🫤 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🤢 🤮 🤧 😷 🤒 🤕".split(" "),
  },
  {
    id: "gestures",
    get title() { return translate("Gestures & Body"); },
    emojis: "👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 👃 🧠 🫀 🫁 🦷 👀 👁️ 👅 👄".split(" "),
  },
  {
    id: "animals",
    get title() { return translate("Animals & Nature"); },
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪲 🦋 🐌 🐞 🐜 🪰 🪱 🐢 🐍 🦎 🐙 🦑 🦐 🦞 🦀 🐠 🐟 🐡 🐬 🐳 🌵 🎄 🌲 🌳 🌴 🪴 🌱 🌿 ☘️ 🍀 🍁 🍂 🍃 🌸 🌼 🌻 🌞 🌝 🌚 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀️ ☁️ ❄️".split(" "),
  },
  {
    id: "food",
    get title() { return translate("Food & Drink"); },
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥠 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 ☕ 🍵 🧋 🥤 🍺 🍻 🥂 🍷".split(" "),
  },
  {
    id: "activity",
    get title() { return translate("Activities & Objects"); },
    emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🎿 🏂 🪂 🏋️ 🤸 ⛹️ 🤺 🏇 🧘 🎮 🕹️ 🎲 ♟️ 🎯 🎳 🎸 🎹 🎺 🎻 🥁 🎬 🎨 🚗 🚕 🚌 🚑 🚒 🚲 ✈️ 🚀 🛸 ⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 📷 🎥 📞 💡 📚 ✏️ 📝 📌 📎 🔒 🔑 🔨 🧰 🧲 🧪 💊 🎁 🎈 🎉 ✅ ❌ ❗ ❓ 💯".split(" "),
  },
  {
    id: "symbols",
    get title() { return translate("Symbols & Flags"); },
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ▶️ ⏸️ ⏹️ ⏺️ ⏭️ ⏮️ 🔀 🔁 🔂 ➕ ➖ ➗ ✖️ ♾️ ‼️ ⁉️ ❔ ❕ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ©️ ®️ ™️ 🏁 🚩 🎌 🏳️ 🏴".split(" "),
  },
] as const;

const readRecentEmojis = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, 36)
      : [];
  } catch {
    return [];
  }
};

function LazyEmojiAsset({
  asset,
  onSelect,
  autoplay,
}: {
  asset: EmojiPickerAsset;
  onSelect: (asset: EmojiPickerAsset) => void;
  autoplay: boolean;
}) {
  const label = asset.kind === "animation" ? translate("Send GIF") : translate("Send sticker {{value0}}", { value0: asset.emoji ?? "" }).trim();

  return (
    <button
      className="emoji-asset-button"
      type="button"
      aria-label={label}
      title={label}
      onClick={() => onSelect(asset)}
    >
      <EmojiAssetVisual asset={asset} autoplay={autoplay} label={label} />
    </button>
  );
}

export function EmojiPicker({
  chatId,
  replyToMessageId,
  replyQuote,
  disableNotification = false,
  onEmoji,
  onAssetSent,
  onClose,
  onRequestComposerFocus,
  onCaptureComposerFocus,
  onPointerEnter,
  onPointerLeave,
}: EmojiPickerProps) {
  const loadEmojiPicker = useTelegramStore((state) => state.loadEmojiPicker);
  const emojiRevision = useTelegramStore((state) => state.emojiRevision);
  const getCachedEmojiPicker = useTelegramStore((state) => state.getCachedEmojiPicker);
  const loadStickerSet = useTelegramStore((state) => state.loadStickerSet);
  const getCachedStickerSet = useTelegramStore((state) => state.getCachedStickerSet);
  const searchStickers = useTelegramStore((state) => state.searchStickers);
  const sendSticker = useTelegramStore((state) => state.sendSticker);
  const sendAnimation = useTelegramStore((state) => state.sendAnimation);
  const autoplayAnimations = usePreferencesStore((state) => autoplayAllowed(
    state.autoplayAnimations,
    state,
  ));
  const panelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<PickerTab>("sticker");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<EmojiPickerCatalog | undefined>(getCachedEmojiPicker);
  const [catalogLoading, setCatalogLoading] = useState(() => !getCachedEmojiPicker());
  const [recentEmojis, setRecentEmojis] = useState(readRecentEmojis);
  const [selectedStickerSetId, setSelectedStickerSetId] = useState(RECENT_STICKERS);
  const [loadedStickerSet, setLoadedStickerSet] = useState<StickerSet>();
  const [stickerSetLoading, setStickerSetLoading] = useState<string>();
  const [failedStickerSetIds, setFailedStickerSetIds] = useState<Set<string>>(() => new Set());
  const [searchResult, setSearchResult] = useState<{ query: string; assets?: EmojiPickerAsset[] }>();
  const [retryRevision, setRetryRevision] = useState(0);
  const [sendingAssetId, setSendingAssetId] = useState<string>();
  const selectedStickerSet = getCachedStickerSet(selectedStickerSetId)
    ?? (loadedStickerSet?.id === selectedStickerSetId ? loadedStickerSet : undefined);

  useEffect(() => {
    let active = true;
    setCatalog(getCachedEmojiPicker());
    setCatalogLoading(!getCachedEmojiPicker());
    void loadEmojiPicker().then((nextCatalog) => {
      if (!active) return;
      setCatalog(nextCatalog);
      setCatalogLoading(false);
    });
    return () => { active = false; };
  }, [emojiRevision, getCachedEmojiPicker, loadEmojiPicker, retryRevision]);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".emoji-picker, .emoji-trigger")) return;
      onClose();
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(true);
    };
    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [onClose]);

  useEffect(() => {
    if (tab !== "sticker" || selectedStickerSetId === RECENT_STICKERS) return;
    let active = true;
    if (!getCachedStickerSet(selectedStickerSetId)) setStickerSetLoading(selectedStickerSetId);
    void loadStickerSet(selectedStickerSetId).then((stickerSet) => {
      if (!active) return;
      if (stickerSet) {
        setLoadedStickerSet(stickerSet);
        setFailedStickerSetIds((current) => {
          const next = new Set(current); next.delete(selectedStickerSetId); return next;
        });
      } else {
        setFailedStickerSetIds((current) => new Set(current).add(selectedStickerSetId));
      }
      setStickerSetLoading((current) => current === selectedStickerSetId ? undefined : current);
    });
    return () => { active = false; };
  }, [emojiRevision, getCachedStickerSet, loadStickerSet, retryRevision, selectedStickerSetId, tab]);

  useEffect(() => {
    if (tab !== "sticker" || !query.trim()) {
      setSearchResult(undefined);
      return;
    }
    let active = true;
    const timer = globalThis.setTimeout(() => {
      void searchStickers(query, chatId).then((assets) => {
        if (active) setSearchResult({ query: query.trim(), assets });
      });
    }, 250);
    return () => {
      active = false;
      globalThis.clearTimeout(timer);
    };
  }, [chatId, query, retryRevision, searchStickers, tab]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEmojiGroups = useMemo(() => {
    const groups = recentEmojis.length > 0
      ? [{ id: "recent", title: translate("Recent"), emojis: recentEmojis }, ...emojiGroups]
      : [...emojiGroups];
    if (!normalizedQuery) return groups;
    return groups.map((group) => ({
      ...group,
      emojis: group.emojis.filter((emoji) => emoji.includes(normalizedQuery)),
    })).filter((group) => group.emojis.length > 0);
  }, [normalizedQuery, recentEmojis]);

  const stickerAssets = normalizedQuery
    ? searchResult?.query === query.trim() ? searchResult.assets ?? [] : []
    : selectedStickerSetId === RECENT_STICKERS
      ? catalog?.recentStickers ?? []
      : selectedStickerSet?.stickers ?? [];

  const rememberEmoji = useCallback((emoji: string) => {
    const next = [emoji, ...recentEmojis.filter((candidate) => candidate !== emoji)].slice(0, 36);
    setRecentEmojis(next);
    try { localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(next)); } catch { /* noop */ }
    onEmoji(emoji);
    onRequestComposerFocus();
  }, [onEmoji, onRequestComposerFocus, recentEmojis]);

  const sendAsset = useCallback(async (asset: EmojiPickerAsset) => {
    if (sendingAssetId) return;
    const restoreFocus = onCaptureComposerFocus();
    setSendingAssetId(asset.id);
    const sent = asset.kind === "animation"
      ? await sendAnimation(asset, replyToMessageId, replyQuote, chatId, disableNotification)
      : await sendSticker(asset, replyToMessageId, replyQuote, chatId, disableNotification);
    setSendingAssetId(undefined);
    if (sent) {
      onClose();
      onAssetSent();
      restoreFocus();
    }
  }, [chatId, disableNotification, onAssetSent, onClose, onCaptureComposerFocus, replyQuote, replyToMessageId, sendAnimation, sendSticker, sendingAssetId]);

  const closeAndRestoreComposerFocus = () => {
    onClose();
    onRequestComposerFocus();
  };

  const placeholder = tab === "emoji"
    ? translate("Search Emoji")
    : tab === "sticker" ? translate("Search Stickers") : translate("Search GIFs");

  return (
    <section
      id="emoji-picker"
      ref={panelRef}
      className="emoji-picker"
      role="dialog"
      aria-label={translate("Emoji, Stickers & GIFs")}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <header className="emoji-picker-tabs" role="tablist" aria-label={translate("Content Type")}>
        <button className={tab === "emoji" ? "is-active" : ""} type="button" role="tab" aria-selected={tab === "emoji"} onClick={() => { setTab("emoji"); setQuery(""); }}>
          Emoji
        </button>
        <button className={tab === "sticker" ? "is-active" : ""} type="button" role="tab" aria-selected={tab === "sticker"} onClick={() => { setTab("sticker"); setQuery(""); }}>{translate("Stickers")}</button>
        <button className={tab === "animation" ? "is-active" : ""} type="button" role="tab" aria-selected={tab === "animation"} onClick={() => { setTab("animation"); setQuery(""); }}>{translate("GIFs")}</button>
        <button className="emoji-picker-close" type="button" aria-label={translate("Close emoji picker")} title={translate("Close")} onClick={closeAndRestoreComposerFocus}>
          <X size={17} />
        </button>
      </header>

      <label className="emoji-picker-search">
        <Search size={16} strokeWidth={1.8} />
        <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </label>

      <div className="emoji-picker-content">
        {tab === "emoji" ? (
          visibleEmojiGroups.length > 0 ? visibleEmojiGroups.map((group) => (
            <section className="emoji-section" key={group.id}>
              <h3>{group.title}</h3>
              <div className="emoji-grid">
                {group.emojis.map((emoji) => (
                  <button type="button" key={`${group.id}:${emoji}`} aria-label={translate("Insert {{value0}}", { value0: emoji })} onClick={() => rememberEmoji(emoji)}>{emoji}</button>
                ))}
              </div>
            </section>
          )) : <div className="emoji-picker-empty">{translate("No matching emojis found")}</div>
        ) : catalogLoading && !normalizedQuery ? (
          <div className="emoji-picker-empty"><LoaderCircle className="spin" size={20} />{translate("Loading your content...")}</div>
        ) : tab === "sticker" ? (
          <section className="emoji-section">
            <h3>{normalizedQuery ? translate("Search Results") : selectedStickerSetId === RECENT_STICKERS ? translate("Recent") : selectedStickerSet?.title ?? translate("Sticker Pack")}</h3>
            {normalizedQuery && searchResult?.query !== query.trim() ? (
              <div className="emoji-picker-empty" role="status"><LoaderCircle className="spin" size={20} />{translate("Searching stickers...")}</div>
            ) : normalizedQuery && !searchResult?.assets ? (
              <div className="emoji-picker-empty emoji-picker-error" role="alert">
                <span>{translate("Failed to search stickers")}</span>
                <button type="button" onClick={() => { setSearchResult(undefined); setRetryRevision((value) => value + 1); }}>{translate("Retry")}</button>
              </div>
            ) : !normalizedQuery && !catalog ? (
              <div className="emoji-picker-empty emoji-picker-error" role="alert">
                <span>{translate("Failed to load stickers and emojis")}</span>
                <button type="button" onClick={() => setRetryRevision((value) => value + 1)}>{translate("Retry")}</button>
              </div>
            ) : !normalizedQuery && stickerSetLoading === selectedStickerSetId ? (
              <div className="emoji-picker-empty"><LoaderCircle className="spin" size={20} />{translate("Loading sticker pack...")}</div>
            ) : !normalizedQuery && failedStickerSetIds.has(selectedStickerSetId) ? (
              <div className="emoji-picker-empty emoji-picker-error">
                <span>{translate("Failed to load sticker pack")}</span>
                <button
                  type="button"
                  onClick={() => setRetryRevision((value) => value + 1)}
                >{translate("Retry")}</button>
              </div>
            ) : stickerAssets.length > 0 ? (
              <div className="emoji-asset-grid">
                {stickerAssets.map((asset) => <LazyEmojiAsset key={asset.id} asset={asset} autoplay={autoplayAnimations} onSelect={(value) => void sendAsset(value)} />)}
              </div>
            ) : <div className="emoji-picker-empty">{translate("No stickers available")}</div>}
          </section>
        ) : (
          <section className="emoji-section">
            <h3>{translate("Saved GIFs")}</h3>
            {(catalog?.savedAnimations ?? []).filter((asset) => !normalizedQuery || asset.fileName.toLocaleLowerCase().includes(normalizedQuery)).length > 0 ? (
              <div className="emoji-animation-grid">
                {(catalog?.savedAnimations ?? []).filter((asset) => !normalizedQuery || asset.fileName.toLocaleLowerCase().includes(normalizedQuery)).map((asset) => (
                  <LazyEmojiAsset key={asset.id} asset={asset} autoplay={autoplayAnimations} onSelect={(value) => void sendAsset(value)} />
                ))}
              </div>
            ) : <div className="emoji-picker-empty">{translate("No saved GIFs")}</div>}
          </section>
        )}
      </div>

      <footer className="emoji-picker-packs" aria-label={translate("Quick Categories")}>
        {tab === "emoji" ? (
          <>
            <button type="button" title={translate("Recent")} onClick={() => panelRef.current?.querySelector(".emoji-picker-content")?.scrollTo({ top: 0 })}><Clock3 size={18} /></button>
            {emojiGroups.map((group, index) => (
              <button type="button" key={group.id} title={group.title} onClick={() => panelRef.current?.querySelectorAll<HTMLElement>(".emoji-section")[recentEmojis.length > 0 ? index + 1 : index]?.scrollIntoView({ block: "start" })}>
                <span>{group.emojis[0]}</span>
              </button>
            ))}
          </>
        ) : tab === "sticker" ? (
          <>
            <button className={selectedStickerSetId === RECENT_STICKERS ? "is-active" : ""} type="button" title={translate("Recent")} onClick={() => { setQuery(""); setSelectedStickerSetId(RECENT_STICKERS); }}><Clock3 size={18} /></button>
            {(catalog?.stickerSets ?? []).map((stickerSet) => (
              <button className={selectedStickerSetId === stickerSet.id ? "is-active" : ""} type="button" key={stickerSet.id} title={stickerSet.title} onClick={() => { setQuery(""); setSelectedStickerSetId(stickerSet.id); }}>
                {stickerSet.covers[0]
                  ? <EmojiAssetVisual asset={stickerSet.covers[0]} autoplay={false} previewOnly label={stickerSet.title} className="sticker-pack-cover" />
                  : <Sticker size={18} />}
              </button>
            ))}
            <button
              type="button"
              className="sticker-create-pack"
              title={translate("Create Stickers (@Stickers)")}
              aria-label={translate("Create Stickers (@Stickers)")}
              onClick={() => void openExternalLink("https://t.me/Stickers")}
            >
              <Plus size={18} />
            </button>
          </>
        ) : (
          <button className="is-active" type="button" title={translate("Saved GIFs")}><Images size={18} /></button>
        )}
      </footer>

      {sendingAssetId && <div className="emoji-picker-sending" role="status"><LoaderCircle className="spin" size={18} />{translate("Sending...")}</div>}
    </section>
  );
}
