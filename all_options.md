# Fardgram — Complete Feature Parity & Product Expansion Specification

> **Purpose:** This document is the implementation backlog and execution contract for Antigravity (or another coding agent) to bring Fardgram closer to the official Telegram Desktop experience while preserving Fardgram's own differentiators.
>
> **Repository:** https://github.com/amirrezamortazavifard/Fardgram  
> **Document:** `all_options.md`  
> **Baseline checked:** 2026-11-05  
> **Official Telegram Desktop baseline:** stable 7.3.5 (released 2026-11-04); 7.3.4 search changes are marked beta/verify-before-adopting.  
> **Known project stack from repository documentation:** Tauri 2, Rust, React 19, TypeScript, Zustand, TDLib (repository README describes a pinned 1.8.x runtime), Vite, Playwright, Vitest.  
> **Primary goal:** implement one complete feature per development stage—not a collection of superficial UI controls.

---

## 0. Mandatory instructions for the coding agent

### 0.1 Work on one feature at a time

This document is a backlog, not an instruction to implement everything in one pass.

At the beginning of every run:

1. Read this entire document and the current `README.md`, `CHANGELOG.md`, architecture documents, testing documents, and release notes in the repository.
2. Inspect the actual working tree. Do not assume the public README or this document perfectly reflects the current branch.
3. Inspect `git status`, current branch, recent commits, package scripts, TDLib pin/version, and existing tests.
4. Identify the first feature that is not complete in the priority order below, unless the user explicitly names a different feature.
5. Implement **only that one feature**. Do not start a second feature just because the first one is finished quickly.
6. Complete the entire vertical slice: API integration, Rust bridge if needed, typed frontend contract, state/update handling, UI/UX, permissions, error/retry states, persistence if needed, tests, documentation and regression checks.
7. Run the relevant checks and tests. Fix failures caused by the change. Do not hide, skip, weaken or delete tests to make the build pass.
8. Update this file's status ledger and the project's `CHANGELOG.md`/technical docs where appropriate.
9. Stop after the one feature is complete. Report what changed, files touched, tests run, limitations and the next feature. Wait for the next explicit instruction before starting another feature.

**Never mark a feature complete just because a button, mock screen, placeholder, static card, or hard-coded demo appears in the UI.** It is complete only when the real end-to-end workflow works with the native TDLib transport and has meaningful automated coverage.

### 0.2 Repository is the source of truth

This document is based on a source-level review of the public repository documentation and changelog. The repository can change after this document is generated. Before coding, verify every claim in the current code.

Use the following labels during the audit:

- `IMPLEMENTED`: real end-to-end implementation is present and verified.
- `PARTIAL`: some real pieces exist, but important user flows or states are missing.
- `UI_ONLY`: a visual control exists but does not complete the real Telegram operation.
- `MOCK_ONLY`: works only in the browser/mock transport.
- `NOT_FOUND`: no implementation found after searching relevant source, bridge, models and tests.
- `BLOCKED_BY_TDLIB`: cannot be completed with the currently pinned TDLib/runtime/API and requires a documented dependency decision.
- `NOT_APPLICABLE`: official Telegram feature is not offered to this account, platform or client context.

Do not assume that a feature is missing based only on the README. Search all relevant source code, generated TDLib types, native bridge commands, event reducers, mock adapter, tests, changelog and documentation. Conversely, do not assume a feature works just because a type, label or changelog sentence exists.

### 0.3 Mandatory implementation principles

- Preserve Fardgram's existing differentiators: integrated proxy/anti-censorship stack, Sing-box/V2Ray sidecar, network telemetry, AI Co-pilot, local-first/privacy-oriented behavior, multi-account support, theme system and Persian/RTL identity.
- Do not replace TDLib with a mock, unofficial HTTP endpoint, scraped Telegram Web endpoint or Bot API workaround for user-account operations.
- Prefer supported TDLib APIs for user-account functionality. The Bot API is not a substitute for MTProto/TDLib user-client methods.
- Before implementing any Telegram feature, inspect the **actual pinned TDLib schema/runtime** (`td_api.tl`, generated API documentation/types, runtime binary version and build scripts). Do not copy method names from memory or from a newer TDLib release.
- If the pinned TDLib lacks the required methods, investigate a controlled TDLib upgrade. Document API availability, binary/runtime compatibility, build impact, database compatibility, Windows packaging, hashes, licenses and regression risk before changing the pin.
- Do not silently build a fake or partial substitute. If an API cannot be supported, mark the feature as blocked and explain the exact reason and options.
- Maintain the existing ordered TDLib receive loop. Do not create a second competing `td_receive` loop. Preserve update ordering and request/response correlation using the established `@extra` mechanism.
- All IPC commands must be typed, validated and permission-scoped. Never expose arbitrary native file access, process execution, unrestricted URLs or raw TDLib internals to the webview.
- Keep secrets, phone numbers, message bodies, chat identifiers, passkeys, payment credentials and proxy secrets out of logs and diagnostics.
- Do not transmit private chat data to an AI provider without explicit user action and clear disclosure. Respect BYOK/local-model configuration and offer a local-only path where feasible.
- Avoid destructive database migrations. Use versioned, reversible, tested migrations and preserve the current account/cache recovery guarantees.
- Keep mock mode useful for UI development, but never count mock success as native Telegram integration success.
- Do not introduce new large dependencies without documenting why the current stack cannot solve the problem.

### 0.4 One-feature completion report format

At the end of each stage, produce this exact report:

1. **Feature ID and name**
2. **Before-state:** what was implemented, partial, missing, or blocked
3. **Implemented behavior:** complete user flows and known restrictions
4. **Architecture:** TDLib APIs/types used, Rust commands/events, frontend stores/components
5. **Files changed:** concise list
6. **Security/privacy:** permissions, secret handling, data retention and consent
7. **Tests:** exact commands and results; distinguish mock tests from native TDLib tests
8. **Manual verification:** steps for the user to verify with a real Telegram account
9. **Known limitations:** no vague claims; list exact limitations
10. **Documentation/changelog:** what was updated
11. **Next feature:** identify the next unchecked item but do not implement it

---

## 1. Project baseline and areas to inspect

The repository documentation describes the following architecture. Verify exact paths and implementation before making changes because files may have moved or been refactored.

| Area | Known role / likely location |
|---|---|
| React UI | `src/` — React 19 + TypeScript screens and components |
| State | `src/store/` or current Zustand stores/reducers |
| Telegram domain/transport | `src/telegram/` — contracts, TDLib adapter, mock adapter, event mapping |
| Native bridge | `src-tauri/src/` — Tauri commands, TDLib loader, worker/receive loop, native file and OS services |
| Auxiliary windows | `windows/` and `src/windows/` |
| Tests | `tests/`, Vitest and Playwright E2E |
| Runtime/build scripts | `scripts/`, `package.json`, `src-tauri/`, version manifests |
| Documentation | `README.md`, `CHANGELOG.md`, `docs/` |

The current repository documentation mentions, among other things:

- Native TDLib transport and ordered asynchronous updates.
- Phone-number and QR authorization.
- Multi-account data and per-account protected database keys.
- Paginated chat lists and history, search, chat folders and presence.
- Reply, edit, delete, forward, retry, download and reactions.
- Media viewing/playback, albums, waveform audio, voice and round-video recording.
- Shared media, pinned messages, auto-delete durations, polls/quizzes, forum topics, basic group/supergroup/channel creation and offline attachment queue.
- Proxy settings, native diagnostics, cache management, auto-updater and Windows portable/installer distribution.
- AI Co-pilot, theme studio, network telemetry and anti-censorship sidecar.

These are **not automatically complete or production-ready**. Validate the real flows and avoid duplicating working systems.

### 1.1 Required audit before every feature

Create or update a small implementation map in the agent's working notes:

- Existing domain types and serialization boundary.
- Existing transport contract and native/mock implementations.
- Existing TDLib request/response helper and event subscription pattern.
- Existing Zustand store and reducer for affected entities.
- Existing UI entry point and reusable components.
- Existing permission/capability model.
- Existing persistence/database migration strategy.
- Existing unit, integration, E2E and native smoke tests.
- Current TDLib API/runtime version and whether the required API is present.

Search by both feature terminology and actual TDLib constructor/method names. Search generated files and schema, not only handwritten TypeScript.

---

## 2. Priority and status ledger

The order below is the recommended delivery sequence. It can be changed only when a real dependency or user instruction requires it. The priority does not mean that every item is definitely absent: perform the status audit first.

### P0 — Core parity / major daily workflows

- [ ] **FG-001 — Voice and video calls (1:1 calling) and call lifecycle** `[BLOCKED_BY_TDLIB: Missing native tgcalls/WebRTC media pipeline]`
- [ ] **FG-002 — Group calls, voice chats and screen sharing** `[BLOCKED_BY_TDLIB: Depends on FG-001 tgcalls integration]`
- [ ] **FG-003 — Stories: viewing, publishing and management** `[BLOCKED_BY_TDLIB: Pinned TDLib 022d6020 lacks stories API (requires TDLib 1.8.16+)]`
- [x] **FG-004 — Telegram Mini Apps: secure in-app WebView runtime**
- [x] **FG-005 — Scheduled messages, scheduled posts and Send When Online**
- [x] **FG-006 — View Once / self-destructing media parity**
- [x] **FG-007 — Photo, video and GIF editor before sending**

### P1 — Advanced daily use and account parity

- [x] **FG-008 — Telegram Business features**
- [x] **FG-009 — Passkey login and passkey management**
- [x] **FG-010 — Saved Messages 2.0 and saved-message organization**
- [x] **FG-011 — Full chat/history export**
- [x] **FG-012 — Voice/video transcription and transcript UX**
- [x] **FG-013 — Native message and conversation translation**
- [x] **FG-014 — Rich Messages editor and advanced rich-message rendering**
- [x] **FG-015 — Advanced polls and quiz parity**
- [x] **FG-016 — Advanced search tabs and discovery**
- [x] **FG-017 — Advanced group, channel and community administration**

### P2 — Ecosystem, content creation and completeness

- [ ] **FG-018 — Telegram Stars, gifts, paid media, payments and Money/Wallet integrations**
- [ ] **FG-019 — Stickers, custom emoji, emoji status and profile media parity**
- [ ] **FG-020 — Localization, Persian/RTL completeness and accessibility**
- [ ] **FG-021 — Drag-and-drop folders and file-set archive sending**
- [ ] **FG-022 — Location sharing and live location**
- [ ] **FG-023 — Advanced notification, focus and desktop integration parity**
- [ ] **FG-024 — Chat quality-of-life, message effects and interaction parity**

### P3 — Optional / verify applicability

- [ ] **FG-025 — Telegram Communities and cross-chat community navigation**
- [ ] **FG-026 — Extended profile, status, QR and contact-sharing parity**
- [ ] **FG-027 — Screen-reader, keyboard-only and high-contrast parity audit**

### Separate release gate (not a feature)

- [ ] **FG-RELEASE — Full regression, migration, security and native release validation**

---

## 3. Feature specifications

# FG-001 — Voice and video calls (1:1)

**Priority:** P0  
**Expected result:** A user can make, receive, accept, decline, end and recover from Telegram voice/video calls inside Fardgram, using supported Telegram/TDLib APIs and native media device access.

### 3.1 Discovery and compatibility gate

Before UI work:

1. Inspect the pinned `td_api.tl` and generated TDLib documentation for all call-related constructors, functions and updates.
2. Determine whether the pinned runtime includes one-to-one calls and which call types, encryption/key exchange, signaling and device controls it supports.
3. Identify whether the TDLib build includes all native media/call dependencies required by its API. Do not assume that exposing a method in JSON means the shipped runtime can complete a call.
4. Confirm platform support separately (Windows first if that is the current native release target; then macOS/Linux if supported by the repository).
5. Document any system permissions, codec, firewall, NAT, audio-device and camera constraints.
6. If the runtime cannot support calls, propose a controlled TDLib build/pin upgrade or a well-scoped blocked status. Do not implement a fake call screen.

### 3.2 Required user flows

- Start a voice call from a user profile, chat header and context menu.
- Start a video call where supported.
- Receive an incoming call when the app is foregrounded.
- Receive an incoming call when the main window is minimized, while respecting notification settings and OS capabilities.
- Accept, decline, ignore and end a call.
- Toggle microphone mute/unmute.
- Toggle camera on/off when video is supported.
- Switch input microphone, output speaker/headphones and camera device where supported.
- Show connection state: preparing, ringing, connecting, exchanging keys, connected, reconnecting, ended, failed.
- Display call duration only after the call is connected.
- Show useful failure information: unavailable, declined, busy, timeout, network issue, permission denied, unsupported device, protocol/runtime error.
- Recover from temporary network interruption without duplicating calls or leaving a stuck call panel.
- Correctly handle a second incoming call while already in a call according to Telegram's supported behavior.
- Open a conversation/profile from the call panel without accidentally ending the call.
- Persist a call service message/history when Telegram delivers it; do not fabricate local call history.

### 3.3 UI/UX requirements

- Dedicated incoming-call notification/card with caller identity and safe action buttons.
- Dedicated call window or well-integrated call panel, consistent with existing Fardgram design system.
- Clear mic/camera state indicators and accessible labels.
- A visible device selector when more than one device exists.
- Video area with correct aspect ratio, loading state and camera-off placeholder.
- Minimize/restore behavior that does not lose call state.
- Keyboard support for accept/decline/end and mute, with no accidental activation while typing.
- Permission request must be contextual: request microphone only when voice call is initiated/accepted; camera only when video is enabled or accepted.
- Do not request camera/microphone permissions merely on app startup.
- Show an explicit permission-denied recovery path linking to OS settings where possible.
- Respect reduced-motion and high-contrast settings.

### 3.4 Native architecture requirements

- Keep media/call processing in supported TDLib/native components; do not stream raw audio/video through React state or Tauri JSON events.
- Use the existing Rust bridge for lifecycle commands and low-frequency state updates only.
- Keep media frames and audio buffers out of normal JSON event transport unless the official TDLib integration requires a documented mechanism.
- Ensure call state is scoped to the correct Telegram account/client instance.
- Guarantee that switching accounts cannot route microphone, camera or call commands to the wrong account.
- Add explicit cleanup for audio devices, camera streams, native handles and call sessions on end, crash, account logout and application shutdown.
- Never log call encryption keys, signaling payloads, raw audio/video or private peer information.

### 3.5 Acceptance criteria

- A real native account can call another supported Telegram account.
- Incoming and outgoing call paths both work.
- Voice and video modes work where supported by TDLib/runtime/platform.
- Device permission denial is recoverable and does not crash the app.
- Network loss/recovery does not leave stuck media devices or ghost calls.
- Calls do not break normal messaging, audio playback, voice recording or media playback ownership.
- Multiple accounts do not cross-contaminate calls.
- Unit tests cover state transitions; native smoke tests cover at least one real outgoing and one incoming call when test accounts/devices are available.

---

# FG-002 — Group calls, voice chats and screen sharing

**Priority:** P0  
**Dependency:** FG-001 and actual TDLib group-call API support.

### 3.6 Required capabilities

- Join and leave a group call/voice chat from a group, supergroup or supported channel context.
- Start a group call when the current user has permission.
- Display participants, speaking state and muted state.
- Handle participant join/leave and permission updates in real time.
- Mute/unmute self; request to speak or raise hand if supported.
- Display moderator/admin controls only when the current user has the required rights.
- Select audio input/output devices.
- Support video camera publishing where the Telegram API/runtime permits it.
- Share the full screen, a selected monitor or a selected application/window where supported.
- Stop screen sharing immediately on user action, app shutdown, permission revocation or source disappearance.
- Handle group-call title, schedule, invite links and recordings only if the current official API/runtime supports them.

### 3.7 Screen-sharing security and UX

- Use native OS screen-capture permission workflows.
- Show a source picker with monitor/window labels; do not capture a screen before explicit selection.
- Show a persistent, obvious "You are sharing" indicator.
- Provide a one-click stop control in the app and, where possible, a native overlay/tray control.
- Avoid capturing Fardgram's own sensitive dialogs by default; document what is and is not excluded.
- Handle display disconnection, window closure, resolution changes and DPI changes.
- Never save or transmit a recording unless the user explicitly invokes a supported recording feature.
- Test multiple monitors, high DPI, minimized windows and permission denial.

### 3.8 Acceptance criteria

- A user can join and leave a real group call.
- Participant state updates without stale duplicates.
- Screen share works through a real supported native flow, not a placeholder.
- Permission changes and source disappearance terminate capture safely.
- Call controls respect Telegram permissions and server errors.

---

# FG-003 — Telegram Stories

**Priority:** P0

### 3.9 Audit gate

Inspect TDLib support for stories, story lists, story viewers, story interactions, uploads, privacy, expiration, editing and story statistics. Determine which capabilities are available to the current account and pinned library. Do not build against undocumented or future-only methods.

### 3.10 Story viewing

- Show story rings/indicators in the appropriate chat list, profile and story viewer entry points.
- Show active stories from contacts and other permitted sources according to Telegram API response.
- Provide a viewer with previous/next navigation, progress segments, pause/resume, tap/keyboard navigation and close behavior.
- Show sender identity, avatar, timestamp and expiration/remaining information where Telegram provides it.
- Support photo, video, text and supported story media-area types.
- Support captions and text entities, including RTL/Persian text.
- Support reactions and replies when available.
- Show viewer list/count only to authorized story owners and only when the API permits it.
- Handle hidden, expired, deleted, restricted and unavailable stories.
- Prevent stale stories from remaining in the UI after an update or expiration.

### 3.11 Story publishing

- Entry points: profile, story tray and a clear create-story action.
- Select photo/video from native file picker or drag-and-drop.
- Preview before publish.
- Crop/position/scale media while preserving original until final send.
- Add text, mention, caption, supported stickers/media areas and links only when the official API permits.
- Select privacy audience: permitted Telegram choices (e.g. everyone, contacts, close friends, selected contacts) based on returned capabilities; do not hard-code unsupported choices.
- Include/exclude users, handle account-specific privacy limitations and show a recipient summary.
- Configure expiration/duration only from server-supported choices.
- Upload progress, retry and cancellation.
- Do not claim publication until Telegram confirms it.

### 3.12 Story management

- Edit a story only if Telegram supports the edit operation for that story type.
- Delete own story with confirmation.
- View own active/expired story archive if exposed by Telegram.
- Manage privacy and viewers only where supported.
- Show story-specific upload and permission errors.

### 3.13 Acceptance criteria

- View, publish and delete flows work with real Telegram data where available.
- Privacy selection maps exactly to supported TDLib options.
- Expired/deleted stories disappear correctly.
- Story media is not treated as ordinary chat media when that would violate expiry/privacy semantics.
- Tests include RTL captions, unsupported media, upload cancellation, expired story and no-network states.

---

# FG-004 — Telegram Mini Apps (secure in-app runtime)

**Priority:** P0

### 3.14 Current known gap to verify

The current project documentation/changelog indicates bot Web App buttons are recognized, but some `webApp` launches may open an external browser. Inspect the actual button handler and replace external-browser-only handling with a secure in-app Mini App experience where the official Telegram protocol/API supports it.

### 3.15 Entry points and launch contexts

Support all contexts that the actual TDLib version exposes:

- Bot profile Main Mini App / Open App.
- Reply keyboard Web App button.
- Inline keyboard Web App button.
- Menu button.
- Attachment menu, if supported by the API/account.
- Direct links and supported start parameters.
- Return to the source chat after closing the Mini App.

The launch context must be explicit and typed. Store only the minimum session metadata needed to return to the origin chat/message.

### 3.16 In-app browser requirements

- Use a dedicated Tauri webview/window or a clearly isolated supported webview surface; never reuse the privileged main application webview for arbitrary third-party content.
- Isolate storage, cookies and local storage from Fardgram's app origin and from other Mini Apps as appropriate.
- Display app/bot name and origin clearly in the chrome.
- Provide back, forward, reload, close, loading and failure states.
- Honor safe external-link handling. Clearly distinguish opening an external browser from navigation inside the Mini App.
- Implement only the official Telegram Web Apps bridge methods supported by the current platform/version.
- Support theme, viewport, safe-area, header/background, back button, main button, closing confirmation, haptic feedback and cloud storage only to the extent that the official JS bridge and client API permit.
- Handle `initData`, `initDataUnsafe`, `query_id`, `start_param` and user/chat context according to official semantics.
- Never tell a Mini App that the identity data is verified merely because it appears in `initDataUnsafe`.
- Do not forge Telegram initialization data. Do not expose API hash, TDLib database key, session secret, local paths or unrelated chat data to a page.

### 3.17 Permissions and security

- Default deny camera, microphone, location, clipboard, downloads and notifications until requested in a supported and contextual flow.
- Show origin-specific permission prompts.
- Allow microphone/camera access only after explicit user approval and only for the active trusted Mini App origin.
- Provide revocation controls and visible permission indicators.
- Validate schemes and URLs. Reject `javascript:`, `file:`, unexpected custom schemes and malformed URLs.
- Do not allow Mini Apps to call arbitrary Tauri commands.
- Do not expose arbitrary filesystem APIs or unrestricted IPC to Mini App JavaScript.
- Implement navigation allowlists/deny rules and safe external URL opening.
- Keep payment flows on official Telegram-supported interfaces; do not inject payment credentials.
- Handle popup/new-window requests safely.
- Apply Content Security Policy/isolation supported by the chosen webview design.

### 3.18 Acceptance criteria

- A real supported bot Web App button opens inside the Fardgram Mini App surface.
- The Mini App can use the documented supported bridge methods.
- Closing it returns to the correct chat and state.
- Storage/cookies/permissions are isolated according to the design.
- Malicious schemes, arbitrary IPC, unapproved camera/mic and file access are rejected.
- Windows/macOS camera and microphone prompts behave correctly where supported.
- Test with at least one known public test Mini App and a malicious test page.

---

# FG-005 — Scheduled messages, scheduled posts and Send When Online

**Priority:** P0

### 3.19 Scope

Implement Telegram-native scheduled sends. This is different from Fardgram's existing offline attachment queue: an offline outbox item is not a server-scheduled Telegram message.

### 3.20 Required flows

- Open a schedule-send menu from the message composer.
- Choose a date/time with local timezone awareness.
- Provide sensible shortcuts (e.g. later today/tomorrow) without hard-coded timezone assumptions.
- Offer "Send When Online" only when the current Telegram API/account supports it.
- Schedule text, media, captions and supported attachments with the same validation as normal sends.
- View the scheduled-message list for the active chat.
- Edit content/time where Telegram supports it.
- Send immediately from the scheduled list where supported.
- Delete/cancel scheduled messages with confirmation.
- Show pending, uploading, scheduled, sending, sent, failed and cancelled states where meaningful.
- Handle server-side timezone/date normalization and daylight-saving changes.
- Prevent accidental double-send after app restart or network reconnection.

### 3.21 Technical requirements

- Use the official TDLib scheduling options/methods from the pinned schema.
- Persist only local UI drafts not already persisted by TDLib; do not build a second competing scheduler if Telegram owns the schedule.
- Reconcile scheduled message list updates with TDLib update events.
- Use server-confirmed message IDs and schedule times.
- Keep scheduled messages account- and chat-scoped.
- Handle chat permissions changing after scheduling.
- Handle deleted chat, blocked user, expired media and invalid schedule windows.

### 3.22 Acceptance criteria

- Schedule a text message, close/reopen Fardgram and verify the scheduled item remains.
- Schedule media and verify actual Telegram delivery.
- Edit/cancel a schedule and verify server state.
- Test past time, daylight-saving boundary, timezone change, offline state and duplicate update delivery.

---

# FG-006 — View Once / self-destructing media parity

**Priority:** P0

### 3.23 Do not conflate these concepts

Implement distinct behavior for:

1. **View Once:** media is intended to be opened once under Telegram's rules.
2. **Self-destructing/TTL media:** media expires after a configured Telegram-supported interval or after viewing, depending on media type and API semantics.
3. **Chat auto-delete:** a chat-level setting that deletes messages after a duration.
4. **Secret-chat behavior:** only where the official desktop client and TDLib support it. Do not imply that ordinary cloud chats become end-to-end encrypted.
5. **Spoilers/protected content:** separate visibility and forwarding/download restrictions.

### 3.24 Required flows

- Offer View Once/TTL options only for media types and chat contexts supported by Telegram.
- Explain the selected behavior clearly before sending.
- Render received one-time media with the correct locked/expired/opened state.
- Open media in a dedicated viewer that obeys server-provided expiry/consumption semantics.
- Remove/disable expired media consistently in history, previews, search, shared media, downloads and notifications.
- Handle app crash/restart after opening without creating an unintended second view.
- Do not retain an ordinary cached copy after expiry unless TDLib explicitly owns a cache whose semantics cannot be changed; in that case ensure the UI cannot expose it and document the underlying limitation.
- Ensure existing deleted-message archival logic never captures self-destructing, protected, expiring or otherwise excluded content.

### 3.25 Security and privacy

- No thumbnail or message preview in notifications for protected/view-once media.
- No automatic prefetch of view-once media.
- No local archive, saved copy, diagnostic attachment or AI analysis of this media.
- Disable context-menu save/copy/forward actions when Telegram prohibits them.
- Do not claim screenshot prevention on desktop unless the OS and Telegram protocol actually enforce it; explain platform limitations honestly.
- Respect API permission errors rather than attempting to bypass them.

### 3.26 Acceptance criteria

- Sending and receiving one-time media works with a real account when supported.
- Opened/expired status survives app restart and is reconciled from TDLib.
- Search, previews, downloads, cache cleanup and message archival do not leak expired content.
- Regression tests cover protected media and the existing deleted-message local archive.

---

# FG-007 — Photo, video and GIF editor before sending

**Priority:** P0

### 3.27 Media editor scope

Build a complete pre-send editor; do not merely place static buttons around the existing media preview.

#### Photo tools

- Crop with freeform and aspect-ratio presets.
- Rotate and flip.
- Straighten, if implemented reliably.
- Draw/freehand annotations with undo/redo.
- Add text with font, size, alignment, color and positioning options.
- Add stickers/custom emoji where supported.
- Blur or pixelate selected regions where technically safe.
- Add/remove markup layers without destructively modifying the selected source until the user confirms.
- Preview at realistic message dimensions.

#### Video tools

- Timeline with start/end trim handles.
- Duration and resulting file-size estimate.
- Seek, frame preview and playback.
- Mute/unmute or preserve audio where supported.
- Select cover/thumbnail frame.
- Rotate/crop where supported.
- Output quality/resolution options constrained by Telegram's API and file limits.
- Cancel/undo/reset editing.
- Do not re-encode unnecessarily; preserve original quality when no edit is requested.

#### GIF/animation tools

- Preview animation.
- Trim/edit supported animated media.
- Set caption and emoji where supported.
- Preserve correct MIME type and animation metadata.

#### Shared behavior

- Multiple-file and album composition.
- Caption and formatting.
- Spoiler selection.
- Send compressed vs send as file/original quality.
- Upload progress/cancel/retry.
- Preserve file order and captions across album items.
- Correctly reject unsupported formats and oversized files with actionable feedback.

### 3.28 Architecture

- Keep source file immutable until user confirms the final output.
- Use a dedicated media-processing service/worker/native pipeline for expensive operations; do not block the React main thread.
- Avoid large base64 strings in React state or Tauri JSON IPC.
- Use temporary files with safe cleanup and bounded disk usage.
- Maintain cancellation and progress reporting.
- Preserve EXIF/privacy policy; strip sensitive metadata where expected and explain behavior.
- Use platform-appropriate codecs; do not assume every Windows codec is available.
- Add memory limits for large images/video and graceful failure.

### 3.29 Acceptance criteria

- Edit photo, video and GIF/animation flows produce correct media sent to Telegram.
- Original file remains unchanged unless the user deliberately replaces it.
- Video output has correct duration, audio, orientation, poster and MIME/container metadata.
- Cancel/undo/reopen and app restart do not leave unbounded temporary files.
- Regression tests cover mixed albums, captions, spoilers, original-file sending and large files.

---

# FG-008 — Telegram Business features

**Priority:** P1  
**Important:** Business functionality is account/subscription/region dependent. Show only the capabilities returned by Telegram for the current account.

### 3.30 Profile and business identity

- Business opening hours and timezone.
- Business location/address/map information where supported.
- Business profile details and start page customization.
- Business intro/start-page text and media if available.
- Show business-specific profile indicators without confusing them with ordinary user fields.

### 3.31 Automated messaging

- Greeting/away messages with exact Telegram schedule rules.
- Configure recipients/exclusions where supported.
- Quick replies: create, edit, delete, order and insert into composer.
- Rich quick-reply content only if the API supports it.
- Show unavailable/expired/permission states clearly.
- Ensure client-side shortcuts do not pretend to be server-side auto-replies.

### 3.32 Business chat links and automation

- Create/manage business chat links where supported.
- Preview the link and its prefilled message.
- Copy/share/revoke links.
- Connect/manage a business bot only through official Telegram-supported methods.
- Display the connected bot and permissions clearly.
- Do not silently forward private messages to an external bot.
- Make any business automation state visible and reversible.

### 3.33 Business settings and acceptance

- Dedicated Business settings section.
- Empty states for accounts without Business access.
- Feature gates and server-side error handling.
- Tests for unsupported account, supported account, expired entitlement and network error.
- No hidden assumptions based on subscription name or local hard-coded flags.

---

# FG-009 — Passkey login and passkey management

**Priority:** P1

### 3.34 Compatibility gate

- Inspect the current TDLib schema for passkey capability flags and authentication/registration methods.
- Verify the exact pinned runtime supports both login and enrollment, not just a capability field.
- Determine whether platform-native WebAuthn/Windows Hello integration is performed by TDLib or requires an OS API bridge.
- Do not invent passkey registration or use an arbitrary web login page to impersonate official Telegram authentication.

### 3.35 User flows

- Offer Passkey on the authorization screen only when TDLib says the account/platform can use it.
- Start the official authentication challenge.
- Invoke the OS passkey provider securely.
- Handle success, cancellation, no credential, user verification failure, unavailable authenticator and timeout.
- Add a new passkey from account security settings where supported.
- List existing passkeys using only information the API returns.
- Rename/revoke a passkey if supported by official API.
- Keep existing phone, QR and 2-step verification flows as fallback.

### 3.36 Security requirements

- Never store private passkey material in app storage or logs.
- Use platform credential APIs or the TDLib-provided secure handoff.
- Do not serialize authentication challenges into analytics/diagnostic logs.
- Do not expose authentication tokens to React devtools or persistent local storage.
- Avoid fallback paths that lower account security without the user's choice.

### 3.37 Acceptance criteria

- Real registration and sign-in work on supported platform/account.
- Unsupported devices retain existing login methods.
- Cancellation/failure returns to a valid auth state.
- No credentials appear in logs, diagnostics, crash reports or snapshots.

---

# FG-010 — Saved Messages 2.0

**Priority:** P1

### 3.38 Core behaviors

- Open Saved Messages from navigation/profile/menu.
- Save/forward messages into Saved Messages using Telegram-native behavior.
- Preserve original sender, source chat, original date and message link where Telegram exposes them.
- Navigate from a saved item to its original source when still accessible.
- Search saved messages.
- Filter by media category and date.
- Paginate efficiently and preserve scroll position.
- Support pinned items and saved content in topics where Telegram provides them.

### 3.39 Organization

- Display source-chat context and source avatar.
- Support Telegram-native saved-message tags if exposed by the current TDLib version/account.
- Allow filtering by tag and source chat.
- Support tag creation/removal only if the server API supports it.
- Show tag limitations for accounts without the required entitlement.
- Distinguish actual Telegram tags from local Fardgram-only labels; local-only labels must be clearly identified and must not claim synchronization.
- Avoid implementing a parallel folder system that conflicts with Telegram's own data model.

### 3.40 Acceptance criteria

- Saved content synchronizes with the official client.
- Source context and navigation work.
- Search, filters, pagination and pins remain stable across restart.
- No duplicate saves after retry or network reconnection.

---

# FG-011 — Full chat/history export

**Priority:** P1

### 3.41 Scope

Implement user-requested export of Telegram chat/history data, separate from Fardgram's redacted diagnostics ZIP export.

### 3.42 Export options

- Export current conversation.
- Export selected conversations where supported.
- Choose date range.
- Choose output format (HTML and JSON where Telegram/TDLib provides supported export semantics).
- Include/exclude photos, videos, voice, audio, documents, stickers and other media by category.
- Include/exclude service messages and supported metadata.
- Choose output folder using a native file picker.
- Show estimated size only when a reliable estimate is available.
- Show progress, pause/cancel if supported, and completion summary.
- Provide a safe way to open the export folder.

### 3.43 Data correctness

- Preserve message ordering, timestamps, sender identity labels, reply relationships, edits/forwards and topic boundaries where possible.
- Correctly handle large chats and paginated history.
- Preserve original media filenames where safe; prevent path traversal and filename collisions.
- Include a manifest describing export scope, time range, format and media selection.
- Explain exclusions (e.g. content not accessible under Telegram permissions, expired media, protected content or data not returned by Telegram).
- Do not silently export other accounts or chats.

### 3.44 Privacy/security

- Export only after explicit user action and a clear scope summary.
- Avoid exporting secrets, session keys, local cache databases or diagnostics.
- Do not upload exports to cloud/AI services automatically.
- Sanitize untrusted filenames and HTML output; escape message text and URLs to avoid script injection when opening HTML exports.
- Consider optional password-protected archive only if a well-maintained, reviewed implementation is available; do not roll custom cryptography.

### 3.45 Acceptance criteria

- Export a small and a large chat.
- Open HTML output offline and verify content is safely escaped.
- Parse JSON output and verify metadata/ordering.
- Cancel export and verify partial files are cleaned or clearly marked incomplete.
- Confirm diagnostics export remains separate and redacted.

---

# FG-012 — Voice/video transcription and transcript UX

**Priority:** P1

### 3.46 Scope and consent

Support Telegram-native transcription where TDLib exposes it. Consider local transcription only as an optional Fardgram enhancement, not a fake Telegram-native feature. A cloud AI provider must never receive a voice/video message automatically.

### 3.47 Required behavior

- Show a transcript action only for supported media/account types.
- Show Telegram-native processing/transcription status and errors.
- Display transcript in a readable expandable panel or inline segment.
- Preserve timestamps or word segments if returned.
- Copy transcript text.
- Search transcript only if local indexing is explicitly enabled and privacy implications are disclosed.
- Support RTL/Persian text and mixed-language output.
- Offer local model transcription only when a compatible model is configured and the user explicitly selects it.
- Allow the user to cancel local processing and remove generated local transcript data.

### 3.48 Engineering details

- Never send audio bytes through React state.
- Use bounded streaming/temp files for local model execution.
- Do not assume a cloud API's output equals Telegram's native transcript.
- Store transcript metadata in a privacy-conscious way; user preference should control persistence.
- Handle unsupported language, poor audio, long media, low disk space and cancellation.

### 3.49 Acceptance criteria

- Native transcription works only when the server/API permits it.
- Local transcription is explicitly opt-in and clearly labeled.
- Transcript is not included in diagnostics by default.
- Tests cover no transcript, processing, error, long voice note, RTL text and account without entitlement.

---

# FG-013 — Native message and conversation translation

**Priority:** P1

### 3.50 Translation capabilities

- Translate an individual message through the official feature if available to the current account/client.
- Translate a conversation or visible message range only if officially supported; otherwise provide a clearly labeled Fardgram AI translation workflow.
- Select source/target language and remember user preference.
- Detect source language only when reliable; allow manual override.
- Show original and translated text together or with a reversible toggle.
- Preserve formatting, links, code blocks, quotes and entity boundaries.
- Correctly support Persian/Arabic RTL and bidirectional mixed content.
- Provide retry/copy actions and a clear translation error state.

### 3.51 AI privacy requirements

- Separate Telegram-native translation from external AI-provider translation.
- Before sending message content to a cloud provider, disclose provider and content scope and require an explicit user action/consent.
- Allow local translation via configured local model where practical.
- Never send entire chat history when the user requested one message.
- Do not persist translated private content unless the user enables history/cache.
- Offer a per-message action and an explicit opt-in for batch translation.

### 3.52 Acceptance criteria

- Translate a single supported message and restore original display.
- Formatting and links remain valid.
- Test mixed RTL/LTR, code, long messages, unsupported language, provider failure and offline mode.

---

# FG-014 — Rich Messages editor and advanced rich-message rendering

**Priority:** P1

### 3.53 Scope

Fardgram already has some rich-message rendering and composer formatting. Audit the current state and implement the missing authoring and compatibility pieces rather than replacing the existing renderer.

### 3.54 Editor capabilities

- Block insertion menu/slash menu where appropriate.
- Headings and paragraph blocks.
- Bold, italic, underline, strikethrough and inline code.
- Code blocks with language/format handling where supported.
- Quotes and nested quotes.
- Ordered/unordered lists.
- Links and buttons only when the Telegram rich-message format/API supports them.
- Tables where supported.
- Images and supported media blocks.
- Audio tracks/playlists in rich messages where Telegram supports them.
- Preview of final message before submission.
- Submit shortcut such as Ctrl+Enter only when it does not conflict with normal editing and the user can configure it.
- Draft recovery and no accidental loss when changing chats.

### 3.55 Renderer requirements

- Render untrusted rich content safely; no arbitrary script execution or raw HTML injection.
- Sanitize links and use safe external-link handling.
- Preserve indentation, blank lines, nested lists and code formatting.
- Provide responsive layout for wide tables and code blocks.
- Include copy-code and open-link affordances.
- Respect theme, font size, high contrast and screen readers.
- Handle quote replies to rich messages where officially supported.

### 3.56 Acceptance criteria

- Round-trip authoring and rendering of supported block types.
- Export/conversion to plain text does not lose critical line breaks or list structure.
- Malicious HTML/script payloads render inert.
- Long message and narrow-window tests pass.

---

# FG-015 — Advanced polls and quiz parity

**Priority:** P1

### 3.57 Existing baseline

The changelog already documents polls and quizzes, multiple-choice submissions, result updates, correct-answer explanations, restrictions and vote revocation. Do not rebuild those basics unless the audit finds they are broken.

### 3.58 Additional capabilities to verify/implement

- Media attachments on poll questions/options if the current Telegram API supports them.
- Option-level links where supported.
- Anonymous/public vote configuration.
- Multiple answers and quiz mode.
- Correct answer and explanation.
- Revote and vote withdrawal where permitted.
- Quiz/poll close state and closed-at information.
- Result distribution and voter list when visibility rules permit.
- Poll search/shared-media behavior.
- Native updates to existing poll messages without duplicate stale result cards.
- Rich poll creation/edit UI with validation and clear limits returned by Telegram.

### 3.59 Acceptance criteria

- Create and vote in every supported poll type.
- Verify results synchronize with official Telegram client.
- Unsupported features are hidden or disabled with a clear explanation.
- Tests cover anonymous/public restrictions, closed poll, changed permissions, vote revocation and update ordering.

---

# FG-016 — Advanced search tabs and discovery

**Priority:** P1

### 3.60 Existing baseline

Fardgram already documents global search, in-chat search, server pagination, filters and exact context loading. Improve the existing architecture; do not build a second search implementation.

### 3.61 Required search experience

- Single search entry point with explicit current scope: global, current chat, selected folder or selected topic.
- Search tabs/categories where supported by official Telegram Desktop/API: Apps, Channels, Posts, Media and other categories returned by the server/API.
- Message search with filters by sender, date, media type and chat/topic.
- Search users/chats/channels with correct distinctions between local contacts and global discovery.
- Search public posts/channels only through official supported APIs and server-provided results.
- Search bots/apps where supported.
- Recent searches and clear-history controls with privacy settings.
- Query highlighting in result snippets and exact jump to source message.
- Preserve pagination cursor and filter state when navigating back.
- Empty, no results, unsupported query, rate limit and network error states.

### 3.62 Beta/experimental handling

The Telegram Desktop 7.3.4 changelog (dated 2026-10-29) describes tabs for searching apps, channels, posts and media as a beta change. Treat this as an **experimental parity target** unless verified in the stable version/API and supported by TDLib. Do not label a server/API capability stable just because it appears in a beta desktop changelog.

### 3.63 Acceptance criteria

- Current search flows continue to work.
- Each tab uses a real supported API or is explicitly marked unavailable.
- Pagination, query changes and rapid typing do not cause stale results.
- Selecting a result opens the correct chat/topic and message context.
- Search history is handled according to user privacy settings.

---

# FG-017 — Advanced group, channel and community administration

**Priority:** P1

### 3.64 Existing baseline

Fardgram documents basic group/supergroup/channel creation, topic view, pinned messages and permission templates. Preserve these features and extend the missing administration workflows.

### 3.65 Group/member management

- Display member list with pagination/search.
- Add/remove members when permitted.
- Promote/demote administrators with granular rights.
- Restrict/unrestrict members and configure rights.
- Ban/unban users when supported.
- View join requests, approve/decline and manage invite links where supported.
- Show role, member tags and custom labels only if Telegram exposes them.
- Member audit log/recent actions where API permits.
- Slow mode, permissions, anti-spam settings and group defaults where supported.
- Handle anonymous admins and hidden members correctly.

### 3.66 Topics/forum management

- Create, rename, close/reopen and delete topics where permitted.
- Set topic icon/emoji/color where Telegram supports it.
- Pin/unpin topic messages and topic itself where applicable.
- Topic-specific unread counts, notifications, drafts and last-read positions.
- Search within one topic.
- Preserve topic selection and history anchors during navigation.
- Avoid mixing non-contiguous pinned/topic history into the normal timeline.

### 3.67 Channel management

- Channel info, admins and permissions.
- Schedule channel posts using FG-005.
- Manage linked discussion group and comments where supported.
- Channel direct messages if available to that account/channel.
- Manage join requests, invite links, bans and restrictions.
- Display view/reaction/comment statistics only when returned by Telegram.
- Edit/delete/pin posts with proper rights validation.

### 3.68 Community/linked spaces

- Investigate official Community support and actual API methods before design.
- If communities are an official supported entity, provide a hub to access linked groups/channels/bots, notifications and discovery.
- If they are only a concept or web-only feature without a usable client API, document this instead of inventing a local community layer that does not sync with Telegram.

### 3.69 Acceptance criteria

- Permission-sensitive actions are available only to authorized users.
- Server-side permission failures are handled without stale optimistic UI.
- Member/topic lists paginate and remain performant at large scale.
- Admin actions are reflected through TDLib updates and survive restart.

---

# FG-018 — Telegram Stars, gifts, paid media, payments and Money/Wallet integrations

**Priority:** P2  
**High-risk integration:** must use official Telegram/TON interfaces and never create a private-key custody system inside Fardgram.

### 3.70 Feature inventory to audit

- Stars balance and transaction history where available.
- Sending/receiving Stars and supported gifts.
- Gift catalog and gift ownership.
- Collectible gifts, transfer/conversion or display features where officially supported.
- Paid media presentation and purchase flow.
- Paid messages if available to the account.
- Invoice/payment message display and checkout through supported Telegram methods.
- TON Wallet/Money features only where officially documented, available to the region/account and exposed to third-party clients.
- Gift/collectible details and transaction history.

### 3.71 Security and compliance

- Do not store seed phrases or private wallet keys in Fardgram.
- Prefer official Telegram Wallet/Money handoff or a trusted external wallet flow.
- Never log transaction IDs with personally identifying context unless explicitly required and safely redacted.
- Clearly distinguish Telegram Stars, TON, fiat payments and external wallet assets.
- Never show a fake balance or infer balance from local cached UI.
- Confirm all purchases/transfers with explicit user action and server confirmation.
- Handle failed, pending, rejected, refunded and duplicate payment updates.
- Do not bypass regional, account or regulatory restrictions.
- Make unavailable features disappear or display a transparent unsupported message.

### 3.72 Acceptance criteria

- Read-only balance/history works only when officially available.
- A supported purchase/transfer flow uses official server-confirmed methods.
- No private keys or wallet secrets are persisted by Fardgram.
- Duplicate requests, retry and ambiguous payment status are safe.

---

# FG-019 — Stickers, custom emoji, emoji status and profile media parity

**Priority:** P2

### 3.73 Sticker and emoji management

- Browse installed sticker sets and emoji sets.
- Search stickers and custom emoji.
- Add/remove sticker sets with server-confirmed state.
- Show recent/favorite stickers and emoji.
- Support animated/video stickers and rendering only to the extent supported by current TDLib/runtime.
- Provide context actions for pack preview, add/remove and share.
- Respect content restrictions and premium/account gates.
- Do not confuse a static emoji glyph with a Telegram custom emoji document.

### 3.74 Sticker creation/editor (optional if official APIs support it)

- Prepare media in supported formats and dimensions.
- Preview animation/video sticker output.
- Validate size, duration and format.
- Open the official supported sticker-management bot/flow if client APIs cannot create packs directly.
- Never claim a sticker pack was published until Telegram confirms it.

### 3.75 Emoji status/profile media

- Set/remove emoji status where available.
- Display video profile media and profile photos correctly.
- Handle animation, crop and playback preferences.
- Respect user privacy and content restrictions.
- QR code for public username/profile only if supported by official data and safe URL generation.

### 3.76 Acceptance criteria

- Pack add/remove and custom emoji render correctly.
- Animated assets do not crash or stall rendering.
- Unsupported sticker types degrade gracefully.
- Profile media and status synchronize with official client.

---

# FG-020 — Localization, Persian/RTL completeness and accessibility

**Priority:** P2, but foundational QA should begin early.

### 3.77 Localization audit

Fardgram's README mentions Persian typography/RTL support while the changelog also mentions English standardization. Do not assume full Persian localization exists. Audit every user-facing string, date/number format, notification and system dialog.

### 3.78 Persian/RTL requirements

- Full Persian translation of navigation, settings, dialogs, tooltips, errors, onboarding and notifications.
- Correct RTL layout without mirroring icons or media controls that should remain directional.
- Correct mixed Persian/English/code/URL rendering using bidi isolation.
- Vazirmatn or the existing project font stack with proper fallback.
- Jalali calendar/date display only as an optional localized presentation; all stored/API timestamps remain canonical and timezone-aware.
- Persian digits vs Latin digits setting where useful.
- Correct pluralization, relative dates and number grouping.
- Search normalization for Persian/Arabic character variants, zero-width non-joiner, Arabic Yeh/Kaf variants and diacritics, without corrupting source text.
- Correct Persian text entry with IME composition; never lose input during async suggestions.
- RTL in story captions, poll options, rich editor, code blocks, export HTML and Mini Apps chrome.

### 3.79 Other localization

- Keep all strings in a localization catalog; do not add new hard-coded UI strings.
- Support language packs only through a validated format.
- Provide fallback and missing-string reporting in development.
- Keep language selection independent from message content language.

### 3.80 Accessibility requirements

- Full keyboard navigation and visible focus state.
- Semantic accessible names for icon-only buttons.
- Screen-reader announcements for unread markers, incoming messages, call states, upload/download progress and errors.
- High contrast/forced colors.
- Zoom and high-DPI layouts.
- Reduced motion.
- Color is never the only way to convey state.
- Dialog focus trap/restore and Escape behavior.
- Accessible media controls and waveform descriptions.

### 3.81 Acceptance criteria

- Run the repository accessibility matrix and Playwright visual/E2E checks.
- Test Persian and mixed RTL/LTR messages at common DPI levels.
- No clipping in narrow layouts or long translations.
- Keyboard-only use is possible for all newly implemented feature flows.

---

# FG-021 — Drag-and-drop folders and file-set archive sending

**Priority:** P2

### 3.82 Required behavior

- Drag one or more files onto a chat.
- Drag a folder or a set of files and offer sending them as one archive where the official Telegram client/API behavior and local OS permissions permit it.
- Preview selected files and archive structure before upload.
- Choose archive name and supported format if the implementation offers multiple options.
- Show archive generation and upload progress separately.
- Support cancellation and cleanup.
- Enforce safe file/folder traversal and block symlink/path escapes.
- Preserve file names and relative directory structure safely.
- Avoid including hidden/system files without explicit user confirmation.
- Respect file size and account limits returned by Telegram.

### 3.83 Engineering details

- Use native file/folder picker and Tauri-scoped paths.
- Do not pass arbitrary paths from webview to Rust without validation.
- Create temporary archives in a bounded application-owned temp directory.
- Never overwrite an existing user file.
- Clean temp archives after successful send/cancel/expiry.
- Use established offline attachment queue only if its existing metadata and hashing design supports the archive as a single immutable attachment.

### 3.84 Acceptance criteria

- Drag individual file, multi-file set and folder.
- Archive opens correctly and maintains directory structure.
- Cancellation and failures remove temporary files.
- ZIP bombs, symlinks and path traversal tests are included.

---

# FG-022 — Location sharing and live location

**Priority:** P2

### 3.85 Required capabilities

- Display static location messages with a map preview and coordinate/address details returned by Telegram.
- Select a location through a native or web map picker only with explicit user permission.
- Send current location only after explicit confirmation.
- Share a live location for supported durations where Telegram exposes the feature.
- Display active live-location state and remaining duration.
- Stop live location sharing where the API permits.
- Show updates and expiry correctly.
- Open location in an external map application safely.
- Handle unsupported map tiles/provider configuration and offline mode.

### 3.86 Privacy

- Never request location at startup.
- Do not collect background location unless explicitly required, supported and consented to.
- No location coordinates in logs or diagnostics.
- Make active sharing obvious and easy to stop.
- Do not infer precise location from network telemetry or proxy information.

### 3.87 Acceptance criteria

- Static location send/receive works with real Telegram data.
- Live location updates/expiry work where supported.
- Permission denial and unavailable location service are graceful.
- Location data is excluded from diagnostics by default.

---

# FG-023 — Advanced notification, focus and desktop integration parity

**Priority:** P2

### 3.88 Audit existing functionality first

Fardgram already documents native notifications, system tray, startup behavior, window geometry restoration and notification settings. Do not rebuild them. Audit the gaps below.

### 3.89 Potential parity improvements

- Per-chat, per-folder, per-topic and per-account notification controls.
- Separate notifications for mentions, replies, reactions, calls and business events where Telegram exposes these categories.
- Mute presets and custom durations.
- Notification previews with privacy levels (full text, sender only, hidden content).
- Suppress notifications for active conversation when configured.
- Focus/Do Not Disturb integration where OS supports it.
- Correct notification click routing to exact chat/topic/message.
- Group notifications without losing unread count/context.
- Ensure notification placement does not move off-screen or appear on the wrong monitor.
- Respect system proxy/network state without leaking it to notification payloads.
- Native application shortcuts and safe global shortcuts where feasible.

### 3.90 Acceptance criteria

- Notification preferences survive restart and remain account-scoped.
- Click routing opens the correct account and message.
- Hidden-preview mode never leaks protected/view-once message content.
- Test multi-monitor, minimized, focus mode and offline transitions.

---

# FG-024 — Chat quality-of-life, message effects and interaction parity

**Priority:** P2

### 3.91 Audit and candidate features

- Animated text-message send effects where offered by Telegram Desktop.
- Message effects and supported animated reactions.
- Improved message context menus and selection behavior.
- Quote replies to rich messages where supported.
- Better code-block copy/select/indentation behavior.
- Audio playlist behavior within rich messages and voice/audio continuity.
- More complete message link previews and safe link tooltips.
- Better swipe/trackpad navigation and scroll-direction behavior.
- Preserve message selection across updates and virtualization.
- Keep keyboard shortcuts discoverable and prevent conflicts with ordinary text entry.

### 3.92 Requirements

- Follow Telegram server-side message semantics; UI effects must not alter actual message data.
- Motion must respect reduced-motion preference.
- Do not autoplay large/animated content in already-read messages unless allowed by settings.
- Avoid layout shifts and keep scroll anchors stable.
- Include performance budgets for large conversations.

---

# FG-025 — Telegram Communities and cross-chat community navigation

**Priority:** P3 / verify official API applicability

### 3.93 Investigation first

- Confirm whether Communities is a distinct official Telegram entity/API in the target baseline or a product concept built from linked groups/channels/bots.
- Identify exact TDLib methods/updates and account/region availability.
- Do not build a local-only concept and label it as Telegram Community.

### 3.94 If officially supported

- Dedicated community landing/navigation view.
- List linked groups, channels and bots returned by Telegram.
- Open correct chat/topic from community context.
- Aggregate unread notifications only where server semantics permit.
- Respect permissions and join state for every linked chat.
- Handle removed/unlinked members and unavailable child chats.

### 3.95 Acceptance criteria

- Community data is server-backed and synchronizes with official Telegram.
- Unsupported accounts do not see fake controls.

---

# FG-026 — Extended profile, status, QR and contact-sharing parity

**Priority:** P3

### 3.96 Candidate inventory

- Profile QR code for public username/profile links where officially supported.
- Share contact card and handle privacy controls.
- Video profile picture and profile-media playback.
- Emoji status and custom emoji status.
- Business profile details (see FG-008).
- Contact import/add/remove and contact synchronization where supported.
- Public username link preview and safe QR rendering.

### 3.97 Safety/quality

- Only use official public identifiers/URLs.
- Do not encode phone number or private identifiers in QR unless Telegram's official share flow does so and the user explicitly confirms.
- Never upload address book data without explicit OS permission and user action.
- Avoid background contact harvesting.

### 3.98 Acceptance criteria

- Profile changes synchronize with Telegram.
- QR codes resolve to correct public links and do not expose private data.
- Contact permissions and sync status are explicit.

---

# FG-027 — Screen-reader, keyboard-only and high-contrast parity audit

**Priority:** P3 audit; foundational requirements apply to every feature.

### 3.99 Audit coverage

- Main navigation, chat list, message list, composer, media viewer, settings, authorization, notifications, call windows, Mini Apps shell, stories and dialogs.
- Read/unread state, unread separator, pinned messages and selection state.
- Screen reader announcements for newly arriving messages without announcing every irrelevant background update.
- Logical tab order and arrow-key navigation in lists where appropriate.
- Accessible labels and keyboard shortcuts for all icon-only controls.
- High contrast/forced colors and Windows scaling.
- Reduced motion and animated content controls.

### 3.100 Acceptance criteria

- Run automated accessibility scans and manual screen-reader walkthroughs.
- No keyboard traps.
- Focus is restored after closing modal/dialog/auxiliary window.
- New features meet the same baseline; accessibility is not deferred to a final redesign.

---

## 4. Cross-cutting engineering requirements

Every feature must comply with all applicable sections below.

### 4.1 TDLib and transport contract

- Read the pinned TDLib schema and current native runtime metadata.
- Use exact official constructor and function names, parameter shapes and update types.
- Add typed domain mappings instead of leaking raw JSON through the whole React application.
- Validate all IDs, enums, dates and payload sizes at the Rust/transport boundary.
- Preserve request/response correlation and event ordering.
- Do not block the TDLib receive thread with UI, filesystem, image processing or network work.
- Do not create competing receive workers.
- Handle TDLib errors with structured application-level error types while preserving useful server codes.
- Keep mock adapter behavior aligned with the transport contract, but mark it as mock.
- Do not invent server-side features locally.

### 4.2 Tauri/Rust security

- Keep Tauri v2 capabilities minimal and scoped.
- Expose only necessary commands to the main trusted application origin.
- Use separate permission/capability rules for auxiliary windows and Mini Apps.
- Validate filesystem paths, filenames, URL schemes and account scope in Rust.
- Do not accept arbitrary process arguments from the frontend.
- Use OS permission APIs for camera, microphone, screen recording and notifications.
- Add explicit cleanup for spawned processes, media handles, temporary files and webviews.
- Avoid unsafe Rust unless required by the native FFI; document and isolate every unsafe block.
- Keep dependency versions pinned/managed and update license/security inventories.

### 4.3 State, race conditions and synchronization

- Treat TDLib updates as the authoritative source for server-side state.
- Optimistic UI must have rollback/reconciliation logic.
- Deduplicate updates and request retries using stable request/action identity.
- Handle late history/search results so older responses do not overwrite newer state.
- Ensure account switching cancels or isolates pending requests.
- Avoid memory leaks from subscriptions, listeners, media sessions and window events.
- For long-running operations, model explicit states and cancellation semantics.

### 4.4 Performance

- Preserve virtualized conversation history.
- Avoid rendering all search/media/member results at once.
- Use pagination and bounded caches.
- Do not move large blobs or video frames through JSON IPC.
- Do not put high-frequency telemetry in the same event channel as chat updates if it causes starvation.
- Measure startup, first interaction, history render, media open and feature-specific latency.
- Maintain existing performance and geometry-read budgets.
- Test long chats, large groups, many accounts, large files and high-DPI displays.

### 4.5 Privacy and diagnostics

- Default to no external analytics or message-content collection.
- Do not include message text, file paths, phone numbers, usernames, chat/message IDs, tokens, proxy secrets, passkey data, payment details, raw call/signaling data or precise location in logs.
- Respect the existing redacted diagnostics export contract.
- Feature-specific user data must be omitted from diagnostics unless the user explicitly selects a safe export and the disclosure says exactly what is included.
- Keep crash reporting opt-in and local-only unless product policy is explicitly changed by the user.
- No cloud AI processing without explicit action/consent.

### 4.6 UI/UX quality bar

- Match Fardgram's existing design system; do not create a visually unrelated subsystem.
- Keep controls small, purposeful and consistent.
- Include loading, empty, error, offline, unsupported, permission-denied and success states.
- No inert buttons or fake progress.
- Avoid excessive modal dialogs; prefer contextual panels when appropriate.
- Use confirmation for destructive actions and irreversible external transactions.
- Provide tooltips and accessible names for icon-only controls.
- Work at narrow widths and common DPI scaling factors.
- Support keyboard operation and reduced motion.
- Keep Persian/RTL behavior correct wherever text is shown.

---

## 5. Testing strategy and definition of done

### 5.1 Required test layers

For each feature, add the relevant subset of:

1. **Unit tests:** domain mapping, reducers, state transitions, date/time, permissions and error mapping.
2. **Transport contract tests:** typed request payloads, response mapping and event updates.
3. **Mock adapter tests:** UI state and error paths without network access.
4. **Component tests:** interactions, loading/empty/error states, keyboard and accessibility.
5. **Playwright E2E:** complete visible workflows in mock mode.
6. **Native TDLib smoke tests:** actual Tauri bridge/runtime with real TDLib methods; never substitute mock mode for this gate.
7. **Manual acceptance:** real Telegram account and a documented reproducible checklist.
8. **Regression tests:** existing messaging, multi-account, media, proxy, notifications, cache, updater and data migration flows remain intact.

### 5.2 Project commands

Read `package.json` before running commands because scripts can change. The repository documentation currently lists commands in this family:

```bash
npm install
npm run build
npm test
npm run test:e2e:types
npm run test:e2e:smoke
npm run test:e2e:regression
npm run test:e2e:visual
npm run test:e2e:performance
npm run test:e2e
npm run check
npm run check:release
npm run test:native-smoke -- -Profile Clean
npm run verify:tdlib
cargo check
```

Do not claim a command passed unless it was actually run and its result was inspected. If a command is unavailable in the current environment, report that limitation.

### 5.3 Native acceptance rule

A feature that requires TDLib/native OS integration cannot be marked `IMPLEMENTED` based only on browser tests. The completion report must distinguish:

- Browser mock verified
- Rust unit/contract verified
- Native Tauri shell verified
- Real TDLib/network/account verified
- Real device/OS permission verified

If real accounts/devices are not available, record the exact missing manual check and leave the final status as `PARTIAL` or `IMPLEMENTED — native test pending` according to the repository's status convention. Do not report full parity.

### 5.4 Definition of done

A feature is complete only when all applicable items are true:

- [ ] The feature was audited before implementation.
- [ ] API/version compatibility was verified.
- [ ] All main and failure user flows are implemented.
- [ ] Rust/native bridge changes are secure and typed where needed.
- [ ] Frontend state is synchronized from TDLib updates.
- [ ] Mock and native paths are consistent.
- [ ] Loading/empty/error/offline/permission states exist.
- [ ] Privacy and security review is completed.
- [ ] Unit/contract/component/E2E tests pass.
- [ ] Native smoke/manual check is complete or explicitly recorded as pending.
- [ ] Existing feature regressions are checked.
- [ ] Accessibility and RTL have been reviewed.
- [ ] README/docs/changelog are updated.
- [ ] This ledger is updated accurately.
- [ ] No unrelated refactor or second feature was bundled into the stage.

---

## 6. Required documentation changes after each feature

When a feature is completed:

- Add an accurate entry to `CHANGELOG.md` under the correct version/unreleased section.
- Update README only if the feature is genuinely user-facing and available in the release build.
- Update architecture documentation for new Rust commands, events, webviews, external processes or storage.
- Update native smoke/manual acceptance documentation.
- Update accessibility matrix if UI behavior changed.
- Update dependency/license inventory if a new dependency was introduced.
- Record minimum TDLib version/runtime requirement if the feature depends on a newer API.
- Include platform-specific limitations.

Do not advertise an experimental, mock-only or account-gated feature as universally available.

---

## 7. Recommended dependency graph

This is a suggested ordering, not permission to implement multiple features in one stage.

```text
FG-001 Calls ───────────────┐
                           ├── FG-002 Group calls / screen share
FG-003 Stories ────────────┤
FG-004 Mini Apps ──────────┤
FG-005 Scheduling ─────────┤
FG-006 View Once ──────────┤
FG-007 Media editor ───────┤
                           ├── FG-018 Payments/gifts (separate security review)
FG-008 Business ───────────┤
FG-009 Passkeys ───────────┤
FG-010 Saved Messages ─────┤
FG-011 Export ─────────────┤
FG-012 Transcription ──────┤
FG-013 Translation ────────┤
FG-014 Rich Messages ──────┤
FG-015 Polls ───────────────┤
FG-016 Search ─────────────┤
FG-017 Admin/community ────┤
FG-019 Stickers/profile ───┤
FG-020 Localization/a11y ──┤
FG-021 Archive upload ─────┤
FG-022 Location ───────────┤
FG-023 Notifications ──────┤
FG-024 Interaction polish ─┤
FG-025 Communities ────────┤
FG-026 Profile/contacts ───┤
FG-027 Accessibility audit ─┘
```

The diagram does not mean calls are a prerequisite for Stories, Mini Apps or scheduling. It only highlights that call windows depend on a reliable native media lifecycle and group calls build on one-to-one call infrastructure.

---

## 8. Official references and source-of-truth links

Use these links during implementation and check that the page/version still matches the current repository runtime. The official TDLib schema and the pinned runtime are the final authority for supported methods.

### Fardgram

- Repository: https://github.com/amirrezamortazavifard/Fardgram
- README: https://github.com/amirrezamortazavifard/Fardgram/blob/main/README.md
- Changelog: https://github.com/amirrezamortazavifard/Fardgram/blob/main/CHANGELOG.md
- Docs folder: https://github.com/amirrezamortazavifard/Fardgram/tree/main/docs
- Source: https://github.com/amirrezamortazavifard/Fardgram/tree/main/src
- Native source: https://github.com/amirrezamortazavifard/Fardgram/tree/main/src-tauri

### Telegram Desktop

- Official releases: https://github.com/telegramdesktop/tdesktop/releases
- Official desktop changelog: https://github.com/telegramdesktop/tdesktop/blob/dev/changelog.txt
- Published version history: https://telegramdesktop.github.io/tdesktop/changelog/

### TDLib

- TDLib overview: https://core.telegram.org/tdlib/
- TDLib getting started: https://core.telegram.org/tdlib/getting-started
- TDLib API/schema/docs: https://core.telegram.org/tdlib/docs/
- TDLib options: https://core.telegram.org/tdlib/options

### Mini Apps

- Mini Apps JavaScript API: https://core.telegram.org/bots/webapps
- Mini Apps MTProto/client integration: https://core.telegram.org/api/bots/webapps

### Baseline notes (as checked on 2026-11-05)

- Telegram Desktop 7.3.5 is listed as the latest stable release on 2026-11-05, with release date 2026-11-04.
- Telegram Desktop 7.3.4 (2026-10-29) is listed as a pre-release/beta and includes search tabs for apps, channels, posts and media. Treat those search tabs as beta-derived until stable/API availability is confirmed.
- The public Fardgram README describes Tauri 2, React 19, TypeScript, Zustand and a pinned TDLib 1.8.x runtime. Its exact current pin must be re-read from the working tree before each API decision.
- Fardgram's public changelog records real work on search, chat folders, rich composer formatting, media playback, deleted-message local retention with exclusions, Poll/Quiz, pinned messages, auto-delete, shared media, offline attachment queue, group/supergroup/channel creation, topics, diagnostics, cache and notifications. Audit before assuming these are absent.

---

## 9. Final instruction to Antigravity

You are the senior engineer responsible for making Fardgram a reliable, polished, secure and feature-complete Telegram desktop client.

Do not treat this document as a request to rapidly generate many UI screens. Treat it as a long-lived engineering backlog with strict vertical-slice delivery.

**For the current run, select exactly one unchecked feature from Section 2, audit the actual repository, implement that feature end-to-end, run the relevant checks, update the status and documentation, then stop.**

The implementation must be real, native where required, synchronized with Telegram, accessible, secure, tested and visually consistent with Fardgram. Never fake server functionality, never weaken privacy/security to make a demo work, and never mark incomplete work as done.

If a feature is blocked by the pinned TDLib version or platform support, do not silently skip it. Produce a concise technical blocker report with:

1. Exact TDLib method/type/update required.
2. Whether it exists in the pinned version.
3. New minimum version/build change required, if known.
4. Native/runtime/dependency impact.
5. Data migration and compatibility impact.
6. Safe implementation alternatives.
7. Recommended decision.

Then stop and wait for explicit direction rather than moving to another feature automatically.
