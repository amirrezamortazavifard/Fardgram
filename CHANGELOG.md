# Changelog

Notable Fardgram changes are recorded here. Versions follow Semantic Versioning,
with prerelease identifiers used for release candidates.

## [Unreleased]

### Added
- **Chat Quality-of-Life, Message Effects & Interaction Parity (FG-024)**: Complete message effect engine, particle explosion rendering, continuous audio playlist playback, safe external link inspection, and keyboard interaction parity with official TDLib methods:
  - **Animated Message Effects Engine & Particle Player (`MessageEffectPlayer.tsx` & `src/telegram/messageEffects.ts`)**:
    - Full catalog of standard Telegram animated send effects: 🔥 Fire, 🎉 Party Popper, ❤️ Love Hearts, 👍 Thumbs Up, 👎 Thumbs Down, 💩 Poop, ⚡ Lightning, 🕊️ Peace Dove, 💯 100, and 🏆 Trophy with official identifiers and color schemes.
    - GPU-accelerated particle animation engine spawning radiating emoji burst animations anchored to message bubbles.
    - Interactive replay trigger on message bubbles allowing users to replay received effects on demand.
    - Performance and accessibility safeguards: strictly respects user preferences `effectiveReduceMotion` and `autoplayAnimations`, falling back to static badges without performance stalls.
  - **Composer Message Effect Picker (`MessageEffectPicker.tsx` & `ConversationComposer.tsx`)**:
    - Dedicated effect picker dialog accessible from composer toolbar and secondary send menu.
    - Visual preview card showing effect emoji, title, and description with active selection indicator and clear option.
    - Active effect indicator badge above composer input with one-click removal button.
    - Full protocol integration forwarding `effect_id` through `messageSendOptions` in TDLib runtime.
  - **Continuous Audio Playlist & Voice Message Continuity (`audioMessageQueue.ts` & `Conversation.tsx`)**:
    - Expanded playable track detection across voice notes, audio media, and audio document files (`.mp3`, `.m4a`, `.ogg`, `.opus`, `.flac`, `.wav`, `.aac`).
    - Automatic playlist chaining providing seamless auto-advance to subsequent audio/voice messages in conversations and channel discussion topics.
  - **Safe Link Tooltips & Mismatched Destination Inspection (`MessageRichText.tsx`)**:
    - Informative hover tooltips displaying full sanitized URLs, verified HTTPS indicators, and destination inspection for all formatted external links (`textUrl`, `url`, `email`, `phone`).
  - **Message Context Menu & Interaction Refinements (`ConversationOverlays.tsx` & `Conversation.tsx`)**:
    - Added "Copy Message Link" action supporting both public username links (`https://t.me/username/id`) and private channel/chat links (`https://t.me/c/id/id`).
    - Discoverable composer keyboard shortcuts: `Escape` key intelligently cancels effect picker, active effect, or reply preview; `ArrowUp` on empty input edits the last outgoing message.
- **Advanced Notification, Focus & Desktop Integration Parity (FG-023)**: Comprehensive notification policy engine, privacy modes, focus integration, taskbar flashing, and mute presets with full dual-theme parity and TDLib synchronization:
  - **Comprehensive Notification Settings View (`src/components/NotificationSettings.tsx`)**:
    - Dedicated dual-theme panel integrated into `SettingsDialog.tsx` under the Notifications category.
    - Master controls: Desktop Notifications toggle, Alert Sound, and Taskbar Icon flashing.
    - Message Preview & Privacy segmented cards: `"full"` (Name and Message), `"nameOnly"` (Sender Name Only), and `"hidden"` (No Preview) with illustrative icons and descriptions.
    - Notification Category toggles: Private Chats, Groups, and Channels.
    - Exceptions & Focus toggles: Notify on @Mentions & Replies (breaks through muted chats), Notify on Reactions, Suppress in Active Conversation (silences alerts for currently viewed chat), and Respect OS Focus Assist / Do Not Disturb.
    - Responsive layout with dark/light theme parity and 100% professional English UI text.
  - **Mute Presets & Custom Duration Dialog (`src/components/MuteDurationDialog.tsx`)**:
    - Quick mute presets: 1 Hour ($3,600$s), 8 Hours ($28,800$s), 2 Days ($172,800$s), and Mute Forever ($2,147,483,647$s).
    - Custom duration slider allowing fine-grained selection from 1 to 365 days with instant time projection preview.
    - Unmute action button for currently muted conversations.
    - Wired into conversation header action menu (`Conversation.tsx`) and chat context menu (`ChatActionMenu.tsx`).
  - **Notification Policy Engine & Protected Content Redaction (`src/notifications/messageNotificationPolicy.ts`)**:
    - Evaluates category filters (`notifyPrivateChats`, `notifyGroups`, `notifyChannels`) and active conversation suppression (`suppressActiveConversation`).
    - High-priority mention/reply override (`notifyMentions: true`, `containsUnreadMention: true`) bypassing chat mute and category restrictions.
    - Protected content safeguard: view-once media, self-destructing messages, and protected content chats (`hasProtectedContent: true`) automatically redact message preview text across all privacy modes to `[Protected content]`, preventing leakage on lockscreens or OS banner popups.
  - **Native Window Attention & Taskbar Flashing (`src-tauri/src/desktop_notification.rs`)**:
    - Extended `DesktopNotificationRequest` with optional `flash_window` parameter.
    - Integrated Tauri native user attention API (`main_window.request_user_attention(Some(UserAttentionType::Informational))`) to flash taskbar icon when notifications arrive while the window is unfocused.
  - **Preferences & TDLib Synchronization**:
    - Added notification preferences to `AppPreferences` with persistent local storage schema migration and reactive subscribers.
    - Extended `setChatMuted` in `transport.ts`, `tauriTransport.ts`, `mockTransport.ts`, and `telegramStore.ts` to support relative mute durations in seconds, mapping to official TDLib `setChatNotificationSettings`.
- **Location Sharing & Live Location Parity (FG-022)**: Complete location messaging and real-time live location tracking parity with official TDLib methods, dual-theme support, and privacy safeguards:
  - **Interactive Location Card Component (`src/components/LocationMessage.tsx`)**:
    - Visual map card with coordinate formatting (`37.7749° N, 122.4194° W`), venue title, and street address.
    - Live location tracker with real-time countdown timer, radar pulse beacon, and compass heading orientation (`transform: rotate(deg)`).
    - Direct "Stop Sharing" button for outgoing active live locations delegating to `stopLiveLocation`.
    - Safe "Open in Google Maps" external link integration using `openExternalLink` and "Copy coordinates" button with clipboard feedback.
    - Offline-resilient SVG street grid vector preview ensuring zero tracking leaks or missing tile issues.
    - Dual-theme parity supporting dark and light modes with high contrast and smooth transitions.
  - **Send Location Picker Dialog (`src/components/SendLocationDialog.tsx`)**:
    - Dual-mode tabs: "Static Location" and "Share Live Location".
    - "Locate Me" auto-detection using `navigator.geolocation.getCurrentPosition` with graceful permission denial and timeout handling.
    - Coordinate inputs with real-time numeric bounds validation (-90° to +90° latitude, -180° to +180° longitude).
    - Telegram standard live duration options: 15 minutes, 1 hour, and 8 hours.
    - Optional venue name and street address fields for static landmark pins.
    - Explicit privacy safeguard notice confirming no continuous background tracking occurs without explicit user action.
  - **Attachment Menu & Composer Integration**:
    - Added "Location" item with dedicated rose-gradient map icon to `AttachmentPickerMenu.tsx`.
    - Integrated `SendLocationDialog` directly into `ConversationComposer.tsx` with reply-to and draft tracking.
    - Updated message preview and chat list previews to show `📍 Location`, `📍 Live Location`, and venue names.
  - **Security & TDLib Engine Integration**:
    - Whitelisted `editMessageLiveLocation` and `stopLiveLocation` in `src-tauri/src/telegram/security.rs`.
    - Added coordinate bounds validation (-90..90, -180..180) and target message permission checks.
    - Added TDLib generator functions `inputMessageLocation` and `inputMessageVenue` in `tdlibRequests.ts`.
    - Mapped TDLib `messageLocation`, `messageLiveLocation`, and `messageVenue` to structured `MessageLocationContent` in `tdlibMapper.ts`.
    - Implemented `sendLocation` and `stopLiveLocation` across `TauriTransport`, `tauriMessageMediaService`, `MockTelegramTransport`, and `telegramStore`.
- **Drag-and-Drop Folders & File-Set Archive Sending Parity (FG-021)**: Comprehensive folder drop and structured archive creation parity with strict security controls, dual-theme support, and lossless compression:
  - **Archive Drop & Send Dialog (`ArchiveDropModal.tsx`)**:
    - Automatic detection when folders or multiple files are dropped into the conversation or composer.
    - Displays uncompressed file count, total size, archive file name input, compression format selection (`ZIP Deflate` or `ZIP Store`), and file hierarchy tree preview.
    - Option to safely include or exclude hidden/system files (`.git`, `.DS_Store`, `Thumbs.db`, `.env`, `desktop.ini`, `__MACOSX`) with safe defaults.
    - Live compression progress bar showing current file, percentage, and stage with safe `AbortSignal` cancellation.
    - Choice between "Compress & Send Archive" and "Send Separately" as individual files.
    - Full dual-theme parity (dark and light modes) and 100% professional English UI strings.
  - **Fast In-Memory ZIP Engine (`src/utils/archiveBuilder.ts`)**:
    - Standards-compliant PKZIP file generator with DEFLATE compression powered by `pako.deflateRaw` and standard IEEE 802.3 CRC32 verification.
    - Recursive directory traversal via Chromium `FileSystemEntry` handling 100-item pagination batches.
    - Strict defense against path traversal attacks (rejecting `..`, absolute paths, and root drives) and zip-bomb / size limit safeguards (enforcing Telegram's 2 GB document upload limit).
  - **Native Tauri Backend Commands (`src-tauri/src/file_archive.rs`)**:
    - Added `fardgram_create_zip_from_folder` and `fardgram_cleanup_temp_archive` Tauri commands.
    - Safe local directory scanning with symlink escape prevention, path canonicalization, and temp archive cleanup.
  - **Attachment Picker Integration**:
    - Added "Folder or Archive" option with dedicated icon and styling to `AttachmentPickerMenu.tsx`.
    - Integrated drag & drop overlay into composer with accessible status.
- **Localization, Persian/RTL Completeness & Accessibility (FG-020)**: Comprehensive localization architecture parity with Persian (Farsi) language support, full RTL layout integration, resilient search normalization, and Jalali (Solar Hijri) calendar formatting:
  - **Persian Localization Catalog (`src/i18n/locales/fa.ts`)**:
    - Complete Persian translation catalog covering navigation, chat headers, dialogs, media actions, settings, notifications, errors, and stickers.
    - Registered `"fa"` in `SUPPORTED_LANGUAGES` across `src/i18n/language.ts` and `src/i18n/index.ts`.
    - Integrated Persian language option (`فارسی (Persian)`) into Language Settings dropdown in `SettingsDialog.tsx`.
  - **Dynamic RTL Layout & Typography**:
    - Automatically updates `document.documentElement.dir = "rtl"` and `document.documentElement.lang = "fa"` when Persian language is active.
    - Applied Vazirmatn typography font stack (`"Vazirmatn", "Segoe UI", Tahoma, Arial, sans-serif`) for RTL locales in `src/styles/global.css`.
    - Preserved directional integrity for media controls, video scrubbers, audio progress bars, volume controls, and code blocks (`dir="ltr"`).
  - **Resilient Persian/Arabic Search Normalization (`persianSearch.ts`)**:
    - Real-time character variant unification: Arabic Yeh (`ي`, `ى`) to Persian Yeh (`ی`), Arabic Kaf (`ك`) to Persian Kaf (`ک`), Teh Marbuta (`ة`) to Heh (`ه`), and Alef variants (`آ`, `أ`, `إ`) to plain Alef.
    - Stripped Arabic diacritics / harakat (`َ ِ ُ ً ٍ ٌ ّ ْ`) and zero-width non-joiners (`\u200c` ZWNJ).
    - Bi-directional word matching supporting both spaced and compound words (e.g. `می‌خواهم` vs `میخواهم`, `برنامه‌نویسی` vs `برنامه نویسی`).
    - Integrated search normalization into chat filtering (`filterAndSortChats` in `src/store/telegramStore.selectors.ts`).
  - **Jalali (Solar Hijri) Calendar Formatting**:
    - Native `formatJalaliDate` utility powered by standards-compliant `Intl.DateTimeFormat("fa-IR-u-ca-persian")`.
    - Bi-directional Persian digits converter (`toPersianDigits`, `toLatinDigits`).
    - Integrated Persian date formatting into message and chat timestamp formatters while preserving timezone-aware ISO stored timestamps.
  - **Accessibility & Focusability**:
    - Semantic accessibility names, screen-reader labels, and keyboard navigation parity.
    - Comprehensive unit test suite (`src/components/LocalizationAndRtl.test.tsx` and `src/utils/persianSearch.test.ts`) with zero regressions across 198 test files and 1,721 tests.
- **Stickers, Custom Emoji, Emoji Status & Profile Media Parity (FG-019)**: Official TDLib integration parity for custom emojis, sticker packs management, user emoji statuses, and profile sharing media:
  - **Emoji Status Management (`EmojiStatusPicker`)**:
    - Interactive emoji status selector dialog supporting status presets (💼 Working, 🚀 Building, ☕ Coffee Break, 🌴 On Vacation, 🎯 Deep Focus, 🎧 Listening, 🎮 Gaming, 🤒 Sick, 🌙 Resting, ⭐ Star, 🔥 High Energy, ✨ Creative).
    - Status duration options (1 hour, 2 hours, Until Tomorrow, 2 days, Don't clear).
    - One-click "Clear Status" button to revoke the current status emoji.
    - Official TDLib method `setUserEmojiStatus` bound through Tauri backend with validation.
  - **Profile QR Code Presentation (`ProfileQrDialog`)**:
    - High-contrast, deterministic SVG QR code generation for user profiles and channels.
    - Displays formatted username link (`https://t.me/{username}`) or phone link (`https://t.me/+{phone}`).
    - Quick "Copy Link" action with visual confirmation toast and "Open in Browser" action.
    - Integrated QR trigger button into user identity card in `ProfileDrawer`.
  - **Emoji & Sticker Picker Modernization (`EmojiPicker`)**:
    - Modernized all category headers to 100% professional English ("Smileys & People", "Gestures & Body", "Animals & Nature", "Food & Drink", "Activities & Objects", "Symbols & Flags").
    - Clean English tab labels ("Emoji", "Stickers", "GIFs") and search placeholders.
    - Quick shortcut button to official `@Stickers` management bot for custom sticker and emoji pack creation.
  - **Sticker Set Preview & Sharing (`StickerSetPreview`)**:
    - Converted preview dialogues, counts, and buttons to 100% professional English ("Sticker Pack", "{{count}} stickers", "Add Sticker Pack", "Remove Sticker Pack").
    - One-click "Share Sticker Set" button copying the official `https://t.me/addstickers/{name}` link to clipboard with copy confirmation.
  - **Rust Backend TDLib Security Whitelisting**:
    - Whitelisted `"setUserEmojiStatus"` and `"getCustomEmojiStickers"` in `src-tauri/src/telegram/security.rs`.
    - Added comprehensive validation for `setUserEmojiStatus` (validating `emojiStatusCustomEmoji` / `emojiStatusUpgradedGift`, non-zero `custom_emoji_id`, `expiration_date >= 0`, null allowed to clear).
    - Added validation for `getCustomEmojiStickers` (array of 1..=100 positive `custom_emoji_ids`).
    - Added unit test `validates_emoji_status_and_custom_emoji_requests` verifying valid requests and rejecting malformed payloads.
  - **100% Professional English & Dual-Theme Parity**:
    - Fully styled for dark and light modes across all dialogs, pickers, and tooltips.
    - Zero regressions across 196 test suites (1696 tests) and clean production bundle.
- **Telegram Stars, Gifts, Paid Media, Payments & Wallet Integrations (FG-018)**: Official TDLib integration parity for Telegram Stars ecosystem, paid media unlocking, invoice messages, digital gifts, and monetization:
  - **Telegram Stars Settings & Management (`StarsSettingsPanel`)**:
    - Real-time Stars balance display (`⭐ {balance} Stars`) with live USD estimate (~$0.02/Star) and refresh trigger.
    - Top-up pack purchase grid (50, 100, 250, 500, 1000, 2500 Stars) with price tags and checkout state.
    - Transaction history log listing incoming/outgoing transactions with partner identifiers (App Store, Google Play, Fragment, Bot, User, Channel), timestamps, and refund indicators.
    - Channel and bot monetization revenue card showing Total Earned, Available Payout, and Pending Release amounts with direct Fragment withdrawal action.
    - Telegram Gifts catalog and interactive Send Gift form supporting recipient selection, custom message, and private gift option.
    - TON Blockchain & Non-Custodial Compliance card explicitly documenting zero private-key or seed-phrase custody inside the desktop client.
  - **Paid Media Bubble Presentation & Unlocking (`PaidMediaMessage`)**:
    - Blurred media preview container for locked photos and videos with lock badge and required Star cost (`⭐ {starCount} Stars`).
    - One-click "Unlock for ⭐ {starCount}" action button triggering official TDLib `buyPaidMedia`.
    - Unlocked media grid display with thumbnail and video rendering.
    - Formatted caption rendering with rich text entities, mentions, and hashtags.
  - **Invoice Messages (`InvoiceMessage`)**:
    - Structured invoice card with receipt icon, title, description, formatted currency/amount (Stars `⭐ {totalAmount}` or fiat), and test mode badge.
    - Interactive "Pay" action button and confirmed "Payment Completed" status indicator.
  - **Digital Collectible Gifts (`GiftMessage`)**:
    - Celebration gift message bubble with animated gift icon, collectible title, star value badge, private gift badge, and sender personal message.
  - **Rust Backend TDLib Security Whitelisting**:
    - Whitelisted `"buyPaidMedia"`, `"getAvailableGifts"`, `"getStarTransactions"`, `"getStarsTopupOptions"`, `"getStarRevenueStatus"`, and `"sendGift"` in `src-tauri/src/telegram/security.rs`.
    - Implemented deep bounds and type validation for all 6 requests (`chat_id`, `message_id`, `gift_id`, `owner_id`, `offset`, `limit` 1..=100).
    - Added unit test `validates_stars_and_gifts_requests` verifying valid requests and rejecting malformed identifiers.
  - **100% Professional English & Dual-Theme Parity**:
    - Completely English UI strings, placeholders, badges, and documentation.
    - Strict dark/light theme parity across all cards, buttons, badges, and modals.
- **Advanced Group, Channel & Community Administration (FG-017)**: Comprehensive Telegram Desktop administration parity across member lists, administrator promotion with granular rights, exception permissions, topic lifecycle, invite links, join requests, and audit logs:
  - **Group & Channel Member Management (`ChatManagementDialog`)**:
    - Real-time search filter for existing members by display name, username, or custom title.
    - Quick member remove/kick action button (`UserMinus`) for authorized administrators.
    - Role selector (`Member`, `Administrator`, `Restricted`, `Banned`) enforcing actor hierarchy and permissions.
    - Custom member tags editor with validation (0–16 characters without emojis or line breaks).
    - Ownership transfer workflow with two-step verification password validation and safety error prompts.
  - **Granular Permissions & Slow Mode Administration**:
    - Default chat permission toggles across all 16 Telegram Desktop permission keys.
    - Individual member exception permission editor for restricted members.
    - Granular administrator rights configuration (`canManageChat`, `canChangeInfo`, `canPostMessages`, `canEditMessages`, `canDeleteMessages`, `canInviteUsers`, `canRestrictMembers`, `canPinMessages`, `canManageTopics`, `canPromoteMembers`, `canManageVideoChats`, `canPostStories`, `canEditStories`, `canDeleteStories`, `canManageDirectMessages`, `canManageTags`, `isAnonymous`).
    - Slow mode configuration dropdown (Off, 5s, 10s, 30s, 1m, 5m, 15m, 1h).
  - **Forum Topics Administration & Lifecycle (`ForumTopicsView`, `ForumTopicStrip`)**:
    - Topic deletion workflow (`deleteForumTopic`) with confirmation prompt and store synchronization.
    - Topic creation, renaming, pinning/unpinning, and closing/reopening with permission checks.
    - Unread message and unread reaction badge presentation.
  - **Invite Links & Join Request Management**:
    - Invite link creator and editor with optional expiration date, usage limits, Stars subscriptions, and admin approval requirement.
    - Member source statistics per invite link (Joined, Pending, Expired).
    - One-click "Approve All" and "Decline All" bulk actions and per-user approval/rejection.
  - **Rust Backend TDLib Security Whitelisting**:
    - Added `"deleteForumTopic"` to `WEBVIEW_TDLIB_REQUESTS` in `src-tauri/src/telegram/security.rs`.
    - Implemented deep payload bounds checking for `"deleteForumTopic"` requiring non-zero `chat_id` and positive `forum_topic_id`.
    - Added unit test `validates_delete_forum_topic_requests`.
  - **100% Professional English & Dual-Theme Parity**:
    - Replaced all Chinese/mixed-language strings across `ChatManagementDialog`, `ChatMembershipBar`, `ForumTopicsView`, `ForumTopicStrip`, and `chatManagement.ts` with polished professional English.
    - Strict dark/light theme styling parity across dialog headers, tabs, grids, and action buttons.
- **Advanced Search Tabs, Date Filtering & Query Highlighting (FG-016)**: Comprehensive Telegram Desktop 7.3.4+ search parity across global tabs, in-chat search scopes, date range pickers, and keyword highlighting:
  - **10 Global Search Tabs (`GlobalSearchResults`)**:
    - Added Telegram Desktop category tabs: `All`, `Chats`, `Channels`, `Apps`, `Posts`, `Media`, `Files`, `Music`, `Voice`, and `Links`.
    - Tab filters mapped to official TDLib `searchMessagesFilter` structures (`searchMessagesFilterPhotoAndVideo`, `searchMessagesFilterDocument`, `searchMessagesFilterAudio`, `searchMessagesFilterVoiceAndVideoNote`, `searchMessagesFilterUrl`).
    - Channel post discovery through `posts` category filter and public username queries.
  - **In-Chat Search Date Picker & Quick Presets (`ChatSearchDatePicker`)**:
    - Integrated calendar date picker popover in in-chat search header with quick presets: `Today`, `Yesterday`, `Past 7 days`, and `Past 30 days`.
    - Custom date range form with native date inputs (`From` and `To`) bound to Unix timestamp filters (`minDate` / `maxDate`).
    - Clear date filter affordance with visual active badge.
  - **Search Query Keyword Highlighting (`highlightedText`)**:
    - Highlighting matched query tokens inside search snippet text, preview excerpts, and user display names with clean accessible mark styling (`.chat-search-highlight`).
  - **TDLib IPC & Rust Security Whitelisting**:
    - Added `searchMessages` to `WEBVIEW_TDLIB_REQUESTS` in `src-tauri/src/telegram/security.rs`.
    - Implemented deep payload bounds checking (query up to 1024 characters, limit 1..=100, min_date/max_date >= 0, and filter type whitelist).
  - **100% Professional English & Dual-Theme Parity**:
    - Replaced all non-English labels and placeholders with polished English terminology across search panels, tabs, and filters.
    - Strict dark/light theme parity across all tabs, badges, popover pickers, and result rows.
- **Advanced Polls & Quiz Parity (FG-015)**: Full TDLib-backed poll and quiz authoring, live voting, revoting, quiz answer validation, explanation feedback, and creator lifecycle management:
  - **Comprehensive Poll & Quiz Creator (`CreatePollDialog`)**:
    - Question input with dynamic character limit counter (1–255 characters).
    - Dynamic 2–10 poll options list with addition, per-row deletion, and character counters (1–100 characters per option).
    - Anonymous voting toggle ("Anonymous Voting").
    - Multiple answers toggle ("Multiple Answers").
    - Interactive Quiz mode toggle ("Quiz Mode") with radio selector for single correct answer and optional explanation field (1–200 characters) displayed with hint icon.
    - Full keyboard navigation and validation disabling creation when criteria are not met.
  - **Composer & Attachment Integration**:
    - Added "Poll" option with `BarChart2` icon in `AttachmentPickerMenu`.
    - Integrated `CreatePollDialog` modal into `ConversationComposer` with reply threading support.
  - **TDLib IPC & Rust Security Whitelisting**:
    - Added `stopPoll` to `WEBVIEW_TDLIB_REQUESTS` in `src-tauri/src/telegram/security.rs`.
    - Implemented deep payload bounds checking for `inputMessagePoll` within `sendMessage` (question length, option counts and lengths, quiz correct answer bounds, and explanation limits).
    - Validated `stopPoll` parameters requiring non-empty `chat_id` and positive `message_id`.
  - **Poll Lifecycle & UX in Message Bubbles (`PollMessage`)**:
    - Creator & Administrator "Close Poll" action button with confirmation state and TDLib `stopPoll` dispatch.
    - Dynamic voter count formatting with proper English pluralization ("1 vote" vs. "{n} votes").
    - Retract vote / Revote button ("Retract Vote") for polls allowing vote retraction.
    - Instant quiz feedback showing checkmarks (`Check`) and crosses (`X`) on answered choices.
    - Final results indicators and closed status badges for completed polls.
    - 100% professional English UI copy and strict light/dark theme parity across all dialogs and bubbles.
- **Rich Messages Editor & Advanced Rich-Message Rendering (FG-014)**: Comprehensive WYSIWYG and Markdown formatting authoring suite, responsive code blocks with copy affordance, link dialog, and live message preview:
  - **Full-Spectrum WYSIWYG & Shortcut Formatting Toolbar (`ComposerFormattingBar`)**: Expanded formatting toolbar supporting Bold (`Ctrl+B`), Italic (`Ctrl+I`), Underline (`Ctrl+U`), Strikethrough (`Ctrl+Shift+X`), Monospace Inline Code (`Ctrl+Shift+M`), Preformatted Code Block (`Ctrl+Shift+C`), Spoiler Mask (`Ctrl+Shift+P`), Collapsible Quote Block (`Ctrl+Shift+Q`), and Hyperlinks (`Ctrl+K`).
  - **Interactive Link Dialog (`ComposerLinkDialog`)**: Modal dialog for adding or editing rich text hyperlinks (`textUrl`) with display text and URL fields, keyboard accessibility (`Enter` to submit, `Escape` to cancel), automatic protocol formatting, and clean mark insertion.
  - **Live Rich Message Preview (`ComposerMessagePreview`)**: Interactive pre-submission preview panel mounted above the composer input displaying character count, word count, formatted entity summary badges, simulated outgoing message bubble, and full bidirectional RTL/LTR rendering (`dir="auto"`).
  - **Responsive Rich Code Blocks (`RichCodeBlock`)**: Dedicated code block renderer with language badge header, one-click clipboard copy button with animated checkmark feedback, horizontal scroll preservation, and strict LTR text flow across all themes.
  - **Markdown Entity Parser & Round-Trip Serializer (`markdownEntities.ts`)**: Bi-directional converter parsing Markdown tokens (`[text](url)`, `**bold**`, `*italic*`, `<u>underline</u>`, `~~strike~~`, `||spoiler||`, `` `code` ``, ```` ```lang\ncode\n``` ````, `> quote`) into native Telegram `MessageTextEntity` objects with exact UTF-16 code unit offset tracking and round-trip export to clean markdown.
  - **Dual-Theme Design Parity**: 100% professional English UI copy with strict light and dark mode parity across toolbar, preview bubble, link modal, and code headers.
- **Native Message & Conversation Translation (FG-013)**: Official Telegram TDLib translation integration with formatted entity preservation, bidirectional RTL/LTR support, and interactive toggle UI:
  - **Telegram-Native TDLib Translation**: Integrated `translateText` and `translateMessageText` methods with strict parameter bounds verification in `src-tauri/src/telegram/security.rs` (`chat_id`, `message_id`, non-empty target language codes up to 16 characters, formatted text up to 8192 characters).
  - **Formatted Entity Preservation**: Preserved markdown entities, bold, italic, code blocks, spoilers, and hyperlinks across translated text through `mapTdFormattedText`.
  - **Reversible Toggle & Attribution UX in Message Bubble**:
    - Contextual translation banner (`message-translation-banner`) displaying language attribution (`Translated to {Language}`).
    - Reversible toggle button ("Show original" / "Show translation") allowing instant switching between translated and original text.
    - Full bidirectional text direction support (`dir="auto"`) ensuring seamless rendering of RTL languages (Persian, Arabic, Hebrew, Urdu) and LTR languages (English, German, French, etc.).
    - Active translation indicator spinner (`Translating message...`) when a message is actively undergoing translation.
  - **Message Context Menu Integration**: Added "Translate" action to `MessageActionMenu` enabling direct translation of any individual message.
  - **Conversation Translation Bar (`ConversationTranslationBar`)**:
    - Responsive top conversation header banner with target language dropdown supporting 18 international languages.
    - "Translate Chat" trigger button to translate visible conversation messages.
    - Auto-translate chat toggle with persistence in user preferences and store state.
    - Close button with dismissal persistence.
    - Quick-toggle translation button in conversation header actions and chat context menu ("Translate Chat").
  - **Dual-Theme Design Parity**: 100% professional English UI copy with strict light and dark mode styling parity, high-contrast borders, and zero hardcoded background styles.
  - **Privacy & Security**: Zero unconsented third-party cloud audio or text streaming; translation flows strictly through official TDLib channels.
- **Voice & Video Note Transcription & Transcript UX (FG-012)**: Telegram-native speech-to-text recognition with interactive transcript UI for voice messages and video notes:
  - **Telegram-Native TDLib Speech Recognition**: Integrated `recognizeSpeech` and `rateSpeechRecognition` TDLib methods with security request whitelist validation in `src-tauri/src/telegram/security.rs`.
  - **Asynchronous Lifecycle & States**: Reactive mapping of TDLib's `speechRecognitionResultPending` (with live partial text streaming), `speechRecognitionResultText` (completed full transcript), and `speechRecognitionResultError` (with contextual retry actions) across voice and video note message media.
  - **Dedicated Transcript UX Component (`AudioTranscriptView`)**:
    - Intuitive inline trigger button with sparkles icon displayed only for transcription-eligible messages (`canRecognizeSpeech`).
    - Real-time animated pending indicator displaying live progress or partial text stream.
    - Formatted expandable transcript panel with full bidirectional RTL/LTR (`dir="auto"`) text rendering, line height optimization, and word wrapping.
    - One-click clipboard copy action with instant checkmark visual feedback.
    - Feedback rating buttons (Thumbs Up / Thumbs Down) enabling users to rate transcription accuracy back to the Telegram network.
    - Collapsible "Show more / Show less" controls for lengthy speech transcripts.
  - **Dual-Theme Design Parity**: 100% professional English UI copy with strict light and dark mode parity, ensuring crisp contrast without hardcoded dark backgrounds.
  - **Privacy-First Zero Cloud Leakage**: Audio data is processed strictly through official TDLib channels without unconsented third-party cloud streaming.
- **Full Chat/History Export (FG-011)**: Native Telegram Desktop chat history export suite separate from diagnostic packages:
  - **Comprehensive Export Formats**: Dual output modes supporting human-readable HTML (`messages.html` with responsive styles and bubble layouts) and developer-friendly JSON (`result.json` strictly matching Telegram Desktop export schema).
  - **Granular Filter Controls**: Date range filtering (From/To date boundaries), service messages toggle (join events, pin notifications, photo updates), and category-level media selection (Photos, Videos, Voice messages, Audio, Documents, and Stickers) with configurable maximum file-size caps.
  - **Native Tauri File & Dialog Backend**: Tauri command interface (`fardgram_pick_export_folder`, `fardgram_open_export_folder`, `fardgram_write_chat_export_file`, `fardgram_copy_chat_export_media`) with strict directory traversal prevention (`..` components and root injections fail closed) and OS file-manager folder opener.
  - **Interactive Export Dialog & Lifecycle**: Three-phase modal (`ChatExportDialog`) providing interactive configuration, live progress counters (messages, media files, bytes transferred), pause/resume/cancel controls, and final completion statistics.
  - **Dual-Theme Design Parity**: 100% professional English UI copy with strict light and dark theme parity and zero hardcoded background styles.
- **Saved Messages 2.0 & Organization (FG-010)**: Modern Telegram-native Saved Messages experience with dual view modes, chat topics, reaction tags, and scoped search:
  - **Dual View Modes**: Switch effortlessly between a linear reverse-chronological message feed ("All Messages") and an organized source-grouped topic browser ("By Chats").
  - **Saved Messages Topics**: Display topic cards with source context and avatars for personal notes (`myNotes`), forwarded chat sources (`savedFromChat`), and hidden authors (`authorHidden`), complete with topic pinning and unpinning (`toggleSavedMessagesTopicIsPinned`, `setPinnedSavedMessagesTopics`).
  - **Emoji Reaction Tags**: Horizontal reaction filter bar featuring reaction counts, emoji tags (`savedMessagesTag`, `getSavedMessagesTags`), and customizable inline tag text labels (`setSavedMessagesTagLabel`) up to 12 characters.
  - **Scoped Saved Search**: Query- and tag-filtered saved messages search (`searchSavedMessages`) filtering by keyword and active tag filter across topics.
  - **Native Rust Security**: Validated request whitelist in `src-tauri/src/telegram/security.rs` covering all 7 TDLib saved messages requests (`loadSavedMessagesTopics`, `getSavedMessagesTopicHistory`, `getSavedMessagesTags`, `searchSavedMessages`, `setPinnedSavedMessagesTopics`, `toggleSavedMessagesTopicIsPinned`, `setSavedMessagesTagLabel`) with topic ID bounds, query bounds, and tag label length checks.
  - **Dual-Theme Organizer UI**: Dedicated `SavedMessagesOrganizer` bar mounted below the conversation header in Saved Messages chats, styled with strict dark and light theme parity.
- **Passkey Login & Passkey Management (FG-009)**: Official WebAuthn passkey authentication and device credential enrollment:
  - **Passkey Authorization Flow**: Seamless sign-in with passkey challenge resolution (`getAuthenticationPasskeyParameters`, `checkAuthenticationPasskey`) on the authorization screen, integrating platform authenticators (Windows Hello, Touch ID, security keys) with instant fallback to QR and phone login.
  - **Passkey Management Panel**: Dedicated `PasskeysSettingsPanel` in Privacy & Security settings allowing users to inspect enrolled passkeys, review last-used and addition timestamps, and delete obsolete keys (`getLoginPasskeys`, `removeLoginPasskey`).
  - **Passkey Enrollment**: Device registration ceremony (`getPasskeyParameters`, `navigator.credentials.create`, `addLoginPasskey`) storing cryptographic public-key credentials with zero raw secrets exposed.
  - **Native Rust Security**: Validated request whitelist in `src-tauri/src/telegram/security.rs` covering all 6 TDLib passkey functions with credential ID, client data, and attestation payload bounds.
  - **Theme & Transport Parity**: Dual-theme UI styling with light/dark parity and comprehensive mock transport support for automated headless testing.
- **Telegram Business Features (FG-008)**: Comprehensive Telegram Business profile, automated messaging, and business chat links management:
  - **Business Identity & Profile**: Business location/address with optional coordinates, opening hours with weekly schedules and timezone selector, and business start page (intro title and message) customization.
  - **Automated Messaging**: Greeting message settings with configurable inactivity period (7 to 28 days), away message settings with schedule presets (`always`, `outsideOfOpeningHours`) and offline-only dispatch toggle.
  - **Quick Replies**: Shortcut manager to list, create, edit, delete, and send quick reply shortcuts (`/`), fully integrated into the composer slash autocomplete popup.
  - **Business Chat Links**: Create, view, edit, revoke, and copy business chat links with prefilled messages and real-time visitor click count tracking.
  - **Native Rust Security**: Validated request whitelist in `src-tauri/src/telegram/security.rs` covering 16 TDLib business methods with identifier bounds, shortcut character verification, and link length checks.
  - **Dual-Theme Settings UI**: Dedicated `BusinessSettingsPanel` in Settings with light/dark theme styling, badge counters, and real TDLib & mock transport parity.
- **Photo, Video and GIF Pre-Send Editor (FG-007)**: Full-featured non-destructive pre-send media editor for photos, videos, and animated GIFs:
  - Photo editor with crop presets (`Free`, `Original`, `1:1`, `4:3`, `16:9`, `9:16`, `3:2`), 90° rotation, horizontal/vertical flipping, freehand drawing brush with 10-color palette, stroke width adjustments, undo/redo stack, customizable draggable text overlays with solid background highlights, and spoiler mask toggling.
  - Video and GIF editor with timeline start and end trimming sliders, dynamic duration and resulting file-size estimation, video playback scrubber with looping preview, audio mute toggle (silent video / animation), and cover/thumbnail frame capture from video playback position.
  - Non-destructive export pipeline generating updated `File` instances without modifying original on-disk source files, seamlessly integrated into composer pending attachment cards with inline edit buttons (`Pencil`) and dark/light theme parity.
- **View Once & Self-Destructing Media Parity (FG-006)**: Complete View Once and TTL media lifecycle in 1:1 direct chats with TDLib request validation (`openMessageContent`, `messageSelfDestructTypeImmediately`, `messageSelfDestructTypeTimer`), composer View Once / TTL toggles, timeline sealed View Once badge (`1`) and expired tombstones, and user-requested timed media saving (`saveTimedMedia`, explicit "Save Timed Media" button in MediaViewer, and inline download button).
- **Scheduled Messages, Posts & Send When Online (FG-005)**: Full TDLib scheduling integration (`getChatScheduledMessages`, `sendScheduledMessages`, `editMessageSchedulingState`, `messageSendOptions` with `messageSchedulingStateSendAtDate` and `messageSchedulingStateSendWhenOnline`), native Rust security request whitelist validation, schedule trigger on message send button context menu, scheduled counter badge, and dedicated `ScheduleMessageDialog` and `ScheduledMessagesDialog` with dual-theme design.
- **Telegram Mini Apps (FG-004)**: Secure desktop in-app WebView runtime (`fardgram_open_mini_app`, `fardgram_close_mini_app`) isolated from Tauri IPC capabilities, with Telegram WebApp proxy initialization script, bot launch authorization via TDLib `openWebApp`, mock fallback modal, and inline keyboard button integration.

## [0.6.0] - 2026-10-12

Official Fardgram multi-platform stable release with TDLib runtime, auto-updater manifests, and English language standardization.

### Changed
- Standardized UI text and notifications across the application to high-grade English.
- Removed demo login bypass in favor of production authentication flows.
- Enhanced in-app updater configuration with automated multi-platform release manifests.

## [0.5.0-rc.5] - 2026-09-18

Windows x64 candidate with an NSIS installer and a portable ZIP. Both packages
include the pinned TDLib runtime and build-time Telegram API credentials.

### Added

- Add chat folder filters, stable bulk selection, and more TDLib chat context-menu
  actions, plus Telegram invite-link handling and localized reporting.
- Add rich composer formatting, visible-message editing, and responsive mention
  suggestions that include conversation authors and support hidden-member groups.
- Add configurable local quote folding and richer, consistent conversation service
  notices with participant, topic, call, payment, and message-link details.

### Changed

- Unify photo and video viewing, with lightweight video previews, application-owned
  playback sessions, mixed media navigation, recoverable errors and continuous
  playback when switching to a small window. Coordinate audio/video ownership and
  exact cache leases; schedule TDLib ranges with bounded workers, source cancellation
  and full-download arbitration. Add first-frame, seek and frame-quality metrics.
- Fade deleted messages and smoothly lower the messages above them while keeping
  the lower messages anchored, including virtualized histories and reduced motion.
- Add an opt-in local copy of incoming messages that are permanently deleted by
  another party, render retained copies as semi-transparent read-only messages,
  and automatically cache original photos while the feature is enabled. Self-
  destructing, expiring, protected, and locally deleted messages remain excluded.
- Calibrate frame-drop estimates against the current window's active display refresh
  rate and attach bounded evidence, focus, frame-budget, script, and region context to
  performance records.
- Rework Settings into a more compact and consistent layout, keep the account page
  focused on the current account, constrain long blocked-sender lists, and remove
  the former developer tools and remote-debugging controls.
- Store cache and download locations as environment-variable paths, defaulting to
  `%LOCALAPPDATA%\dev.fardgram.desktop\tdlib` and
  `%USERPROFILE%\Downloads\downloads` on Windows.
- Store portable account configuration, TDLib login state, media cache, and
  WebView2 data beside the executable under `data/`, while installed builds keep
  their existing per-user application data locations.
- License the Fardgram source under MIT and include the project license in Windows
  release bundles alongside the existing third-party notices.

### Fixed

- Restore saved conversation reading positions, follow newly arrived messages only
  when the full tail fits, and preserve bottom alignment through delayed layouts.
- Paginate ordinary history past retained deleted-message archives, keep quote
  collapse anchored to the pointer, and restore composer focus after chat actions.
- Improve original-image loading, viewer sizing and zoom, cached-file recovery,
  media download state, IME composition, and bot start-link compatibility.
- Separate playback buffering from download progress, preserve valid video ranges
  when seeking, and size loading posters to the video. Make the small video window
  draggable across its surface, with transparent surroundings and automatically
  hidden translucent controls.
- Confirm empty history boundaries and retry stalled pages without moving the older
  cursor forward. Keep permanent deletions, sent message ID replacements, and newer
  edits authoritative when delayed history or context responses arrive.
- Preserve visible incoming messages after remote deletion even if TDLib's raw cache
  has been evicted, and keep retained copies outside the ordinary startup cache quota.
- Serialize native Range downloads per media file so concurrent header and metadata-tail
  probes cannot replace each other's TDLib download window and leave sparse, unplayable media.
- Close layered fullscreen video from the blank surface in both preview and playback modes.
- Advance native audio stream buffer windows with the active playback position and
  preserve validated audio MIME types, preventing large high-bitrate files such as
  FLAC tracks from stalling after the initial 8 MiB range.
- Allow strictly validated TDLib file-download cancellation requests through the
  WebView bridge so cancel actions stop the underlying transfer.
- Separate measured UI stalls from asynchronous backend waits and incomplete tracing,
  so an eight-second conversation trace timeout no longer implies an eight-second
  frozen interface.
- Justify received photo and video albums across the complete message bubble,
  selecting compact rows from item count and source proportions so mixed albums
  no longer leave an empty grid cell.

## [0.5.0-rc.4] - 2026-08-22

This candidate contains the latest conversation, forwarding, attachment,
activity tracking, and native context-menu fixes. The release includes the
Windows installer and portable package only; the standalone prebuilt TDLib
runtime archive is intentionally not published.

## [0.5.0-rc.3] - 2026-08-21

### Added

- Offer a hash-pinned Windows x64 TDLib runtime package alongside source builds,
  with verified Release download and selectable CI preparation paths.
- Start Fardgram automatically after Windows sign-in through an explicit desktop
  setting, keeping automatic launches quietly available from the system tray.
- Restore the main window's last normal position, size, and maximized state on the
  next launch, while moving stale off-screen placements into an available work area.
- Navigate links opened from conversations with back and forward controls or mouse
  side buttons, without recording ordinary conversation-list switches as jumps.
- Reopen forum groups at their last topic and switch topics from a compact horizontal
  strip containing only the topic avatar, name, and unread counter, with mouse-wheel
  horizontal scrolling when the strip overflows.
- Send selected videos, audio, animations, photos, and documents as native Telegram
  media with probed dimensions, duration, generated covers, spoiler/caption placement,
  original-file mode, compatible mixed albums, and native-path-safe validation.
- Participate in Telegram polls and quizzes, including multiple-choice submissions,
  result updates, correct-answer explanations, restrictions, and vote revocation.
- Pin and unpin messages with Telegram notification scope, browse and jump through
  pinned messages, and configure preset or custom chat auto-delete durations.
- Browse server-paginated shared media by category with search and date filters,
  TTL-backed indexing, message jumps, batch downloads, forwarding, and deletion.
- Continue adjacent audio and voice messages automatically within the active
  conversation while retaining a single active playback session.
- Queue attachment uploads while offline with encrypted snapshot metadata,
  persistent browser storage, SHA-256 change detection, expiry and quota limits,
  reconnect recovery, cancellation, and explicit retry states.
- Create basic groups, supergroups, and channels with initial members,
  descriptions, public usernames, history visibility, permission templates,
  and native-path-safe chat photo selection.
- Add a lightweight WebView performance timeline for startup, interaction, rendering,
  history, and media stalls, backed by a separately rotated performance log.
- Search the current conversation from the shared sidebar field through TDLib with
  stable pagination, total counts, a searchable sender filter, exact
  context loading, and a member-avatar context-menu shortcut.
- Add a muted inline video surface, Alt-click floating playback, and progress-preserving
  fullscreen transitions with compact controls for narrow conversations.

### Changed

- Route Ctrl+F to the shared sidebar search field with the active conversation as an
  explicit scope, keep direct sidebar input global, and return to global results when
  the conversation scope is removed.
- Move pinned-list message navigation into a compact action at each bubble's
  top-right corner and remove the redundant linked-channel jump button.
- Replace the pinned-message preview dialog with an in-conversation pinned-message
  view, a persistent header strip that advances through earlier pins as their source
  messages enter the viewport, per-message history jumps, and exact return-position
  restoration without injecting non-contiguous pinned history into the normal timeline.
- Keep the forum group name in topic conversation headers and remove the redundant
  back-to-topic-list control.
- Cache bounded forum-topic metadata with per-group selection state so forum entry
  paints immediately while topic metadata and history refresh in the background.
- Coalesce forum-topic refreshes, reuse fresh topic/read state, and load only the
  destination topic when opening a search result or notification.
- Preserve TDLib voice-note duration before media loading and disable unavailable
  voice controls instead of presenting an inert play action.
- Merge chat and message search into the single conversation-sidebar field, return
  global chat results without mutating the canonical chat list through a second
  request, and hide the contacts navigation entry until it is assigned a new location.
- Treat all search input as plain text and remove the local regular-expression mode.
- Prefetch image and video covers above the viewport, replace percentage media loaders
  with rotating indicators, and stop paused streams after a bounded buffer window.
- Present fullscreen video controls in a light 550-by-80 floating panel that hides
  after pointer inactivity, and route Space to the selected video without activating
  the currently focused non-text control.

### Fixed

- Keep the latest messages immediately above a newly opened reply or edit context
  while preserving the visible anchor when the user has scrolled away from the bottom.
- Stop conversation search from restarting itself whenever its loading state changes,
  and keep the searchable member picker open while results update.
- Keep pinned-message jumps smooth by avoiding redundant same-chat selection,
  suppressing the transient target flash, and ignoring clicks when the pinned
  source message is already visible.
- Give captioned media a stable readable card width without letting short captions
  shrink wide media, keep incoming and outgoing geometry identical, and scale the
  complete media frame proportionally in narrow conversations.
- Prevent rapid forum history initialization from leaving the virtual message list
  stuck in its positioning state and delaying conversation performance traces.

## [0.5.0-rc.2] - 2026-08-03

### Fixed

- Preserve messages when TDLib evicts them only from its local cache, avoid
  inferring deletions from incomplete history windows, and stabilize ordering
  for messages sent within the same second.

## [0.5.0-rc.1] - 2026-08-03

### Added

- Connection recovery, native notifications, complete media actions, cache
  management, and automatic download controls.
- Paginated global search with filters, exact context loading, profiles,
  contacts, members, chat organization, and server-backed folder management.
- Deterministic Mock browser coverage and isolated native smoke evidence.
- Traceable portable and NSIS artifacts, signed stable/candidate update channels,
  forward-only rollback policy, and isolated install/upgrade/uninstall lifecycle
  verification.
- User-exported redacted diagnostics, opt-in local crash reports, and settings
  that keep crash capture disabled by default.
- Automated 125%/150%/200% DPI, forced-colors, long-text, narrow-screen,
  keyboard, and accessibility-tree release checks.

### Security

- Per-account DPAPI-protected database keys, constrained local-file commands,
  trusted media asset paths, and recursively redacted structured logs.
- Release builds reject hidden local inputs, publish dependency/license and
  SHA-256 inventories, verify the pinned TDLib runtime, and sign native binaries.
- Diagnostic export removes string values, identifiers, messages, credentials,
  phone numbers, and local paths before creating the ZIP archive.
