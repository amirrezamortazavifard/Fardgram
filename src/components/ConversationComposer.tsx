import { translate } from "../i18n";
import { isCaptionContent } from "../telegram/messageContent";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BellOff,
  Calendar,
  Check,
  Edit3,
  FileText,
  LoaderCircle,
  Paperclip,
  Reply,
  Send,
  Smile,
  X,
  Sparkles,
  Wand2,
  Settings,
  Mic,
  Video,
  Plus,
  Pencil,
  Eye,
} from "lucide-react";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";
import { MediaEditorModal, type MediaEditorResult } from "./MediaEditorModal";
import { AttachmentPickerMenu } from "./AttachmentPickerMenu";
import { ArchiveDropModal } from "./ArchiveDropModal";
import {
  scanDataTransfer,
  sanitizeRelativePath,
  type ScannedArchiveFile,
} from "../utils/archiveBuilder";
import { CreatePollDialog } from "./CreatePollDialog";
import { SendLocationDialog } from "./SendLocationDialog";
import { MessageEffectPicker } from "./MessageEffectPicker";
import type { TelegramMessageEffect } from "../telegram/messageEffects";
import { VoiceVideoRecorder, type RecordingKind } from "./VoiceVideoRecorder";
import { useAgentStore } from "../agent/agentStore";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type RefObject,
} from "react";
import { useComposerPanelLayout } from "../hooks/useComposerPanelLayout";
import { useComposerAutoResize } from "../hooks/useComposerAutoResize";
import type { ComposerFocus } from "../hooks/useComposerFocus";
import { useStableVisibility } from "../hooks/useStableVisibility";
import {
  canPreviewOutgoingAttachment,
  canSendAttachmentAsMedia,
  classifyOutgoingAttachment,
  inspectOutgoingAttachment,
} from "../media/outgoingAttachments";
import {
  closeMediaViewerWindowSession,
  openMediaViewerWindow,
  syncMediaViewerWindowSession,
} from "../media/mediaViewerWindowBridge";
import {
  closeVideoPreviewWindow,
  openVideoPreviewWindow,
} from "../media/videoWindowBridge";
import { preferencesStore, usePreferencesStore } from "../store/preferencesStore";
import { shortcutActionForEvent } from "../shortcuts/shortcuts";
import { equalFormattedText } from "../utils/formattedText";
import { useTelegramStore } from "../store/telegramStore";
import { colorThemeForThemeId } from "../theme/theme";
import type { AttachmentSendMode, BotCommandSuggestion, ConnectionStatus, InlineQueryResultPage, Message, MessageReplyQuote, MessageSchedulingState, MessageTextEntity, OutgoingAttachment, User } from "../telegram/types";
import { TELEGRAM_ALBUM_MAX_ITEMS } from "../telegram/types";
import type { PhotoMessage } from "../utils/mediaViewerModel";
import { motionLifecycleTiming } from "../utils/motionTokens";
import {
  composerInlineQueryForDraft,
  composerMentionQueryForDraft,
  insertComposerMention,
  insertComposerText,
  mentionTextForUser,
  type ComposerTextInsertion,
} from "../utils/composerInsertion";
import { chatMentionAuthorsFor, mentionSuggestionsFor, mergeMentionSuggestions } from "../utils/mentionSuggestions";
import {
  prependComposerFormattedText,
  reconcileComposerMentionEntities,
  trimComposerFormattedText,
} from "../utils/composerMentions";
import { messageSummary } from "./conversationMessages";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { EmojiPicker } from "./EmojiPicker";
import { MotionPresence } from "./MotionPresence";
import { MediaSpoiler } from "./Spoiler";
import { StableImage } from "./StableImage";
import { Avatar } from "./Avatar";
import { ComposerInput, type ComposerInputElement } from "./ComposerInput";
import { ComposerMessagePreview } from "./ComposerMessagePreview";
import { parseMarkdownToFormattedText } from "../utils/markdownEntities";

interface ConversationComposerProps {
  chatId: string;
  draftKey?: string;
  editingMessage?: Message;
  replyingTo?: Message;
  replyQuote?: MessageReplyQuote;
  contextTitle?: string;
  contextSubject?: string;
  contextSubjectIsAdministrator?: boolean;
  defaultBotUsername?: string;
  users?: ReadonlyMap<string, User>;
  textInsertion?: ComposerTextInsertion;
  knownNonBotUsernames?: ReadonlySet<string>;
  mentionsEnabled?: boolean;
  mentionMessages?: readonly Message[];
  recentMentionUserIds?: readonly string[];
  onTextInsertionApplied?: (id: string) => void;
  onGeometryChange?: () => void;
  inputRef: RefObject<ComposerInputElement | null>;
  onEditLatestVisible: () => void;
  focus: ComposerFocus;
  inert?: boolean;
  connectionStatus: ConnectionStatus;
  queuedMessageCount: number;
  failedQueuedMessageCount: number;
  queuedAttachmentCount: number;
  failedAttachmentCount: number;
  onSendMessage: (
    text: string,
    replyToMessageId?: string,
    replyQuote?: MessageReplyQuote,
    entities?: MessageTextEntity[],
    disableNotification?: boolean,
    schedulingState?: MessageSchedulingState,
    effectId?: string,
  ) => Promise<boolean>;
  onEditMessage: (messageId: string, text: string, entities?: MessageTextEntity[]) => Promise<boolean>;
  onDraftChange: (chatId: string, text: string, replyToMessageId?: string, replyQuote?: MessageReplyQuote, entities?: MessageTextEntity[]) => void;
  onTypingChange: (chatId: string, typing: boolean) => Promise<void>;
  onSendFiles: (
    attachments: OutgoingAttachment[],
    caption?: string,
    captionEntities?: MessageTextEntity[],
    replyToMessageId?: string,
    replyQuote?: MessageReplyQuote,
    disableNotification?: boolean,
    schedulingState?: MessageSchedulingState,
    effectId?: string,
  ) => Promise<boolean>;
  onCancelEditing: () => void;
  onCancelReply: () => void;
  onGetBotCommands: (query?: string, botUsername?: string) => Promise<BotCommandSuggestion[]>;
  onGetInlineResults: (botUsername: string, query: string, offset?: string) => Promise<InlineQueryResultPage | undefined>;
  onSendInlineResult: (botUserId: string, queryId: string, resultId: string, replyToMessageId?: string) => Promise<boolean>;
  onSendBotStart: (botUserId: string, parameter?: string) => Promise<boolean>;
  enableSilentSending?: boolean;
  onOpenAgent?: () => void;
  allowSendWhenOnline?: boolean;
  scheduledMessageCount?: number;
  onOpenScheduledMessages?: () => void;
}

const LOCAL_DRAFT_DELAY_MS = 750;
const TYPING_REFRESH_MS = 4_000;
const TYPING_IDLE_MS = 5_000;

interface PendingAttachment {
  id: string;
  attachment: OutgoingAttachment;
  previewUrl?: string;
}

type AttachmentPreviewSession =
  | { kind: "photo"; id: string; draftKey: string }
  | { kind: "video"; id: string; draftKey: string; attachmentId: string };

const ATTACHMENT_KIND_LABELS: Record<OutgoingAttachment["kind"], string> = {
  get photo() { return translate("图片"); },
  get video() { return translate("视频"); },
  get audio() { return translate("音频"); },
  get voice() { return translate("语音"); },
  get videoNote() { return translate("视频消息"); },
  animation: "GIF",
  get document() { return translate("文件"); },
};

const attachmentSizeLabel = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const pendingAttachmentFrom = (attachment: OutgoingAttachment): PendingAttachment => ({
  id: crypto.randomUUID(),
  attachment,
  previewUrl: canPreviewOutgoingAttachment(attachment.kind)
    ? URL.createObjectURL(attachment.file)
    : undefined,
});

const ignoreViewerFileAction = async () => undefined;

export const ConversationComposer = memo(function ConversationComposer({
  focus,
  inert = false,
  chatId,
  draftKey = chatId,
  editingMessage,
  replyingTo,
  replyQuote,
  contextTitle,
  contextSubject,
  contextSubjectIsAdministrator = false,
  defaultBotUsername,
  users,
  textInsertion,
  knownNonBotUsernames,
  mentionsEnabled = false,
  mentionMessages,
  recentMentionUserIds = [],
  onTextInsertionApplied,
  onGeometryChange,
  inputRef,
  onEditLatestVisible,
  connectionStatus,
  queuedMessageCount,
  failedQueuedMessageCount,
  queuedAttachmentCount,
  failedAttachmentCount,
  onSendMessage,
  onEditMessage,
  onDraftChange,
  onTypingChange,
  onSendFiles,
  onCancelEditing,
  onCancelReply,
  onGetBotCommands,
  onGetInlineResults,
  onSendInlineResult,
  onSendBotStart,
  enableSilentSending = false,
  onOpenAgent,
  allowSendWhenOnline = false,
  scheduledMessageCount = 0,
  onOpenScheduledMessages,
}: ConversationComposerProps) {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showSendMenu, setShowSendMenu] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState<TelegramMessageEffect | undefined>(undefined);
  const [showEffectPicker, setShowEffectPicker] = useState(false);
  const focusComposer = focus.request;
  useTranslation();
  const sendPoll = useTelegramStore((state) => state.sendPoll);
  const sendLocation = useTelegramStore((state) => state.sendLocation);
  const chatDraft = useTelegramStore((state) => state.drafts.get(draftKey));
  const getChatMentionSuggestions = useTelegramStore((state) => state.getChatMentionSuggestions);
  const activeAccountId = useTelegramStore((state) => state.activeAccountId);
  const mentionHistory = useTelegramStore((state) => state.messages.get(chatId));
  const mentionSearchMessages = useTelegramStore((state) =>
    state.chatMessageSearch.input?.chatId === chatId ? state.chatMessageSearch.messages : undefined);
  const mentionAuthors = useMemo(() => chatMentionAuthorsFor(
    chatId, users, mentionMessages, mentionHistory, mentionSearchMessages,
  ), [chatId, users, mentionMessages, mentionHistory, mentionSearchMessages]);
  const localAttachmentDraft = useTelegramStore((state) => state.localAttachmentDrafts.get(draftKey));
  const loadLocalAttachmentDraft = useTelegramStore((state) => state.loadLocalAttachmentDraft);
  const saveLocalAttachmentDraft = useTelegramStore((state) => state.saveLocalAttachmentDraft);
  const updateLocalAttachmentDraftOptions = useTelegramStore((state) => state.updateLocalAttachmentDraftOptions);
  const clearLocalAttachmentDraft = useTelegramStore((state) => state.clearLocalAttachmentDraft);
  const quickReplyShortcuts = useTelegramStore((state) => state.quickReplyShortcuts);
  const loadQuickReplyShortcuts = useTelegramStore((state) => state.loadQuickReplyShortcuts);
  const activeReplyQuote = replyingTo ? replyQuote : chatDraft?.replyQuote;
  const composerContextMessage = editingMessage ?? replyingTo;
  const editingCaption = Boolean(editingMessage && isCaptionContent(editingMessage.content));
  const composerContextKey = editingMessage
    ? `edit:${editingMessage.id}`
    : replyingTo
      ? `reply:${replyingTo.id}`
      : "";
  const [draft, setDraft] = useState(chatDraft?.text ?? "");
  const [, refreshFormatting] = useState(0);
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachmentPending, setAttachmentPending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState<string>();
  const [attachmentMode, setAttachmentMode] = useState<AttachmentSendMode>(localAttachmentDraft?.mode ?? "media");
  const [attachmentSpoiler, setAttachmentSpoiler] = useState(localAttachmentDraft?.hasSpoiler ?? false);
  const [muteVideos, setMuteVideos] = useState(localAttachmentDraft?.muteVideos ?? false);
  const [attachmentSelfDestruct, setAttachmentSelfDestruct] = useState<import("../telegram/types").MessageSelfDestructType | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<PendingAttachment | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [disableNotification, setDisableNotification] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiTransforming, setAiTransforming] = useState(false);
  const aiAnchorRef = useRef<HTMLDivElement>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingKind>("voice");
  const [activeRecording, setActiveRecording] = useState<RecordingKind | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveDropFiles, setArchiveDropFiles] = useState<ScannedArchiveFile[]>([]);
  const [archiveDropDefaultName, setArchiveDropDefaultName] = useState("archive.zip");
  const [archiveDropHasDirectory, setArchiveDropHasDirectory] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const paperclipAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadQuickReplyShortcuts();
  }, [loadQuickReplyShortcuts]);

  useEffect(() => {
    if (!aiMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (aiAnchorRef.current && !aiAnchorRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [aiMenuOpen]);
  const [botSuggestions, setBotSuggestions] = useState<BotCommandSuggestion[]>([]);
  const [activeBotSuggestionIndex, setActiveBotSuggestionIndex] = useState(0);
  const [remoteMentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [localMentionSuggestions, setLocalMentionSuggestions] = useState<User[]>([]);
  const mentionSuggestions = useMemo(() => mergeMentionSuggestions(localMentionSuggestions, remoteMentionSuggestions),
    [localMentionSuggestions, remoteMentionSuggestions]);
  const [activeMentionSuggestionIndex, setActiveMentionSuggestionIndex] = useState(0);
  const [inlineResults, setInlineResults] = useState<InlineQueryResultPage>();
  const [inlineLoading, setInlineLoading] = useState(false);
  const botSuggestionPanelRef = useRef<HTMLElement | null>(null);
  const showSending = useStableVisibility(sending, { minimumVisible: 220 });
  const showAttachmentPending = useStableVisibility(attachmentPending, { minimumVisible: 220 });
  const showInlineLoading = useStableVisibility(inlineLoading);
  const selectedBotRef = useRef<BotCommandSuggestion | undefined>(undefined);
  const botCommandQueryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const botCommandGenerationRef = useRef(0);
  const inlineQueryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inlineQueryGenerationRef = useRef(0);
  const mentionSearchCacheRef = useRef<{ context: string; results: Map<string, User[]> }>({
    context: "",
    results: new Map(),
  });
  const sendOnEnter = usePreferencesStore((state) => state.sendOnEnter);
  const blockTypingStatus = usePreferencesStore((state) => state.blockTypingStatus);
  const colorTheme = usePreferencesStore((state) => colorThemeForThemeId(state.themeId));
  const composerRef = useRef<HTMLDivElement>(null);
  useComposerPanelLayout(composerRef);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const mentionEntitiesRef = useRef<MessageTextEntity[]>(chatDraft?.entities ?? []);
  const composingRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingDraftRef = useRef<{
    text: string;
    entities?: MessageTextEntity[];
    replyToMessageId?: string;
    replyQuote?: MessageReplyQuote;
  } | undefined>(undefined);
  const localDraftDirtyRef = useRef(false);
  const previousEditingRef = useRef<Message | undefined>(undefined);
  const draftBeforeEditRef = useRef<string | undefined>(undefined);
  const entitiesBeforeEditRef = useRef<MessageTextEntity[] | undefined>(undefined);
  const typingActiveRef = useRef(false);
  const typingRefreshRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const replyToMessageIdRef = useRef(replyingTo?.id ?? chatDraft?.replyToMessageId);
  const replyQuoteRef = useRef<MessageReplyQuote | undefined>(activeReplyQuote);
  const emojiOpenTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const emojiCloseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const emojiOpenedByHoverRef = useRef(false);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  const pendingAttachmentDraftKeyRef = useRef<string | undefined>(undefined);
  const localAttachmentBatchIdRef = useRef<string | undefined>(undefined);
  const attachmentPreviewSessionRef = useRef<AttachmentPreviewSession | undefined>(undefined);
  const attachmentPreviewGenerationRef = useRef(0);
  const attachmentModeRef = useRef(attachmentMode);
  const attachmentSpoilerRef = useRef(attachmentSpoiler);
  const muteVideosRef = useRef(muteVideos);
  const fileDragDepthRef = useRef(0);
  const appliedTextInsertionRef = useRef<string | undefined>(undefined);
  const previousComposerContextKeyRef = useRef(composerContextKey);
  const mediaModeAvailable = pendingAttachments.length > 0 && pendingAttachments.every(
    ({ attachment }) => canSendAttachmentAsMedia(attachment.kind),
  );
  const hasPreviewableAttachments = pendingAttachments.some(
    ({ attachment, previewUrl }) => previewUrl && canPreviewOutgoingAttachment(attachment.kind),
  );
  const photoPreviewMessages = useMemo<PhotoMessage[]>(() => pendingAttachments.flatMap((pending) =>
    pending.previewUrl && ["photo", "animation"].includes(pending.attachment.kind)
      ? [{
          id: pending.id,
          chatId: `attachment-draft:${draftKey}`,
          senderId: "self",
          outgoing: true,
          sentAt: new Date(pending.attachment.file.lastModified || 0).toISOString(),
          delivery: "read",
          content: {
            kind: "media",
            mediaType: "photo",
            fileName: pending.attachment.file.name,
            mimeType: pending.attachment.file.type || undefined,
            size: pending.attachment.file.size,
            sizeLabel: attachmentSizeLabel(pending.attachment.file.size),
            width: pending.attachment.width,
            height: pending.attachment.height,
            previewDataUrl: pending.previewUrl,
          },
        }]
      : [],
  ), [draftKey, pendingAttachments]);

  const closeAttachmentPreviewSession = useCallback(() => {
    attachmentPreviewGenerationRef.current += 1;
    const session = attachmentPreviewSessionRef.current;
    attachmentPreviewSessionRef.current = undefined;
    if (!session) return;
    if (session.kind === "photo") closeMediaViewerWindowSession(session.id);
    else closeVideoPreviewWindow(session.id);
  }, []);

  const openPendingAttachmentPreview = useCallback((pending: PendingAttachment) => {
    const { attachment, previewUrl } = pending;
    if (!previewUrl || !canPreviewOutgoingAttachment(attachment.kind)) return;
    closeAttachmentPreviewSession();
    const generation = attachmentPreviewGenerationRef.current;

    if (attachment.kind === "photo" || attachment.kind === "animation") {
      if (!photoPreviewMessages.some((message) => message.id === pending.id)) return;
      void openMediaViewerWindow({
        messages: photoPreviewMessages,
        activeMessageId: pending.id,
        colorTheme,
      }, ignoreViewerFileAction, ignoreViewerFileAction, focus.capture(true)).then((id) => {
        if (!id) return;
        const stillStaged = generation === attachmentPreviewGenerationRef.current &&
          pendingAttachmentDraftKeyRef.current === draftKey &&
          pendingAttachmentsRef.current.some((candidate) => candidate.id === pending.id);
        if (!stillStaged) {
          closeMediaViewerWindowSession(id);
          return;
        }
        attachmentPreviewSessionRef.current = { kind: "photo", id, draftKey };
      });
      return;
    }

    if (attachment.kind === "video") {
      void openVideoPreviewWindow({
        source: previewUrl,
        label: attachment.file.name,
        width: attachment.width,
        height: attachment.height,
        duration: attachment.duration,
        colorTheme,
      }, focus.capture(true)).then((id) => {
        if (!id) return;
        const stillStaged = generation === attachmentPreviewGenerationRef.current &&
          pendingAttachmentDraftKeyRef.current === draftKey &&
          pendingAttachmentsRef.current.some((candidate) => candidate.id === pending.id);
        if (!stillStaged) {
          closeVideoPreviewWindow(id);
          return;
        }
        attachmentPreviewSessionRef.current = {
          kind: "video",
          id,
          draftKey,
          attachmentId: pending.id,
        };
      });
    }
  }, [closeAttachmentPreviewSession, colorTheme, draftKey, focus, photoPreviewMessages]);

  pendingAttachmentsRef.current = pendingAttachments;
  attachmentModeRef.current = attachmentMode;
  attachmentSpoilerRef.current = attachmentSpoiler;
  muteVideosRef.current = muteVideos;

  useEffect(() => {
    const generation = ++botCommandGenerationRef.current;
    if (botCommandQueryTimerRef.current) globalThis.clearTimeout(botCommandQueryTimerRef.current);
    const slash = !editingMessage ? draft.match(/^\/([A-Za-z0-9_]*)(?:@([A-Za-z0-9_]{5,32}))?$/) : null;
    const commandPrefix = !editingMessage
      ? draft.match(/^\/([A-Za-z0-9_]+)(?:@([A-Za-z0-9_]{5,32}))?(?:\s|$)/)
      : null;
    const selectedBot = selectedBotRef.current;
    const selectedBotMatchesDraft = Boolean(
      selectedBot && commandPrefix &&
      selectedBot.command.toLocaleLowerCase() === commandPrefix[1].toLocaleLowerCase() &&
      (!commandPrefix[2] || selectedBot.botUsername.toLocaleLowerCase() === commandPrefix[2].toLocaleLowerCase()),
    );
    if (!slash) {
      setBotSuggestions([]);
      setActiveBotSuggestionIndex(0);
      if (!selectedBotMatchesDraft) selectedBotRef.current = undefined;
      return;
    }
    const username = slash[2] || defaultBotUsername;
    setBotSuggestions([]);
    setActiveBotSuggestionIndex(0);
    if (!selectedBotMatchesDraft) selectedBotRef.current = undefined;

    const matchingQuickReplies: BotCommandSuggestion[] = (quickReplyShortcuts ?? [])
      .filter((qr) => !slash[1] || qr.name.toLowerCase().startsWith(slash[1].toLowerCase()))
      .map((qr) => ({
        botUserId: "",
        command: qr.name,
        description: `Quick Reply (/${qr.name})`,
        botUsername: "",
      }));

    botCommandQueryTimerRef.current = globalThis.setTimeout(() => {
      void onGetBotCommands(slash[1], username)
        .then((suggestions) => {
          if (botCommandGenerationRef.current !== generation) return;
          setBotSuggestions([...matchingQuickReplies, ...suggestions]);
          setActiveBotSuggestionIndex(0);
        })
        .catch(() => {
          if (botCommandGenerationRef.current === generation) setBotSuggestions(matchingQuickReplies);
        });
    }, 80);
    return () => {
      if (botCommandQueryTimerRef.current) globalThis.clearTimeout(botCommandQueryTimerRef.current);
    };
  }, [defaultBotUsername, draft, editingMessage, onGetBotCommands, quickReplyShortcuts]);

  const recentMentionKey = JSON.stringify(recentMentionUserIds);
  useLayoutEffect(() => {
    const mentionQuery = !editingMessage && mentionsEnabled
      ? composerMentionQueryForDraft(draft, inputRef.current?.selectionStart ?? draft.length)
      : undefined;
    setLocalMentionSuggestions(mentionQuery
      ? mentionSuggestionsFor(mentionAuthors, mentionQuery.query, recentMentionUserIds)
      : []);
    // New authors can update local matches without restarting the server query.
  }, [activeAccountId, draft, editingMessage, inputRef, mentionAuthors, mentionsEnabled, recentMentionKey]);

  useLayoutEffect(() => {
    const mentionQuery = !editingMessage && mentionsEnabled
      ? composerMentionQueryForDraft(
        draft,
        inputRef.current?.selectionStart ?? draft.length,
      )
      : undefined;
    setActiveMentionSuggestionIndex(0);
    if (!mentionQuery) {
      mentionSearchCacheRef.current = { context: "", results: new Map() };
      setMentionSuggestions([]);
      return;
    }
    const context = `${activeAccountId ?? ""}:${chatId}:${mentionQuery.start}`;
    const contextChanged = mentionSearchCacheRef.current.context !== context;
    if (contextChanged) {
      mentionSearchCacheRef.current = { context, results: new Map() };
      // Never show a candidate from the previous chat or account while this query loads.
      setMentionSuggestions([]);
    }
    const query = mentionQuery.query.trim();
    if (query && !contextChanged) {
      // Keep already confirmed matches visible while the next server query is in flight.
      setMentionSuggestions((current) => mentionSuggestionsFor(current, query, []));
    }
    const cached = mentionSearchCacheRef.current.results.get(query);
    if (cached) {
      setMentionSuggestions(cached);
      return;
    }
    let cancelled = false;
    const timer = globalThis.setTimeout(() => {
      void getChatMentionSuggestions(chatId, mentionQuery.query, recentMentionUserIds).then((suggestions) => {
        if (cancelled) return;
        mentionSearchCacheRef.current.results.set(query, suggestions);
        setMentionSuggestions(suggestions);
      }).catch(() => {
        if (!cancelled) setMentionSuggestions([]);
      });
    }, 40);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [activeAccountId, chatId, draft, editingMessage, getChatMentionSuggestions, inputRef, mentionsEnabled]);

  useEffect(() => {
    const generation = ++inlineQueryGenerationRef.current;
    if (inlineQueryTimerRef.current) globalThis.clearTimeout(inlineQueryTimerRef.current);
    const inline = !editingMessage ? composerInlineQueryForDraft(draft, knownNonBotUsernames) : undefined;
    if (!inline) {
      setInlineResults(undefined);
      setInlineLoading(false);
      return;
    }
    setInlineLoading(true);
    inlineQueryTimerRef.current = globalThis.setTimeout(() => {
      void onGetInlineResults(inline.username, inline.query)
        .then((page) => {
          if (inlineQueryGenerationRef.current !== generation) return;
          setInlineResults(page);
          setInlineLoading(false);
        })
        .catch(() => {
          if (inlineQueryGenerationRef.current !== generation) return;
          setInlineResults(undefined);
          setInlineLoading(false);
        });
    }, 180);
    return () => {
      if (inlineQueryTimerRef.current) globalThis.clearTimeout(inlineQueryTimerRef.current);
    };
  }, [draft, editingMessage, knownNonBotUsernames, onGetInlineResults]);

  useComposerAutoResize(inputRef, draft, !composing, chatId, onGeometryChange);

  useLayoutEffect(() => {
    if (previousComposerContextKeyRef.current === composerContextKey) return;
    previousComposerContextKeyRef.current = composerContextKey;
    onGeometryChange?.();
  }, [composerContextKey, onGeometryChange]);

  const clearEmojiOpenTimer = useCallback(() => {
    if (emojiOpenTimerRef.current) globalThis.clearTimeout(emojiOpenTimerRef.current);
    emojiOpenTimerRef.current = undefined;
  }, []);

  const clearEmojiCloseTimer = useCallback(() => {
    if (emojiCloseTimerRef.current) globalThis.clearTimeout(emojiCloseTimerRef.current);
    emojiCloseTimerRef.current = undefined;
  }, []);

  const closeEmojiPicker = useCallback((restoreFocus = false) => {
    const active = document.activeElement;
    // A hover timer can outlive a move to search or another conversation.
    // Only return focus while this picker or its trigger still owns it.
    if (restoreFocus && active instanceof Element && active.closest(".emoji-picker, .emoji-trigger") &&
      inputRef.current?.closest(".composer-wrap")?.contains(active)) focusComposer();
    clearEmojiOpenTimer();
    clearEmojiCloseTimer();
    emojiOpenedByHoverRef.current = false;
    setEmojiPickerOpen(false);
  }, [clearEmojiCloseTimer, clearEmojiOpenTimer, focusComposer, inputRef]);

  const scheduleEmojiPickerOpen = useCallback(() => {
    clearEmojiCloseTimer();
    if (editingMessage || emojiPickerOpen || emojiOpenTimerRef.current) return;
    emojiOpenTimerRef.current = globalThis.setTimeout(() => {
      emojiOpenTimerRef.current = undefined;
      emojiOpenedByHoverRef.current = true;
      setEmojiPickerOpen(true);
    }, motionLifecycleTiming.popoverHoverOpen);
  }, [clearEmojiCloseTimer, editingMessage, emojiPickerOpen]);

  const scheduleEmojiPickerClose = useCallback(() => {
    clearEmojiOpenTimer();
    clearEmojiCloseTimer();
    emojiCloseTimerRef.current = globalThis.setTimeout(() => {
      closeEmojiPicker(true);
    }, motionLifecycleTiming.popoverHoverClose);
  }, [clearEmojiCloseTimer, clearEmojiOpenTimer, closeEmojiPicker]);

  const toggleEmojiPicker = useCallback(() => {
    clearEmojiOpenTimer();
    clearEmojiCloseTimer();
    if (emojiPickerOpen && !emojiOpenedByHoverRef.current) {
      closeEmojiPicker(true);
    } else {
      emojiOpenedByHoverRef.current = false;
      setEmojiPickerOpen(true);
    }
  }, [clearEmojiCloseTimer, clearEmojiOpenTimer, closeEmojiPicker, emojiPickerOpen]);

  const flushDraft = useCallback(() => {
    if (draftTimerRef.current) globalThis.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = undefined;
    const pending = pendingDraftRef.current;
    pendingDraftRef.current = undefined;
    if (!pending) return;
    localDraftDirtyRef.current = false;
    onDraftChange(
      chatId,
      pending.text,
      pending.replyToMessageId,
      pending.replyQuote,
      pending.entities,
    );
  }, [chatId, onDraftChange]);

  const scheduleDraft = useCallback((
    text: string,
    replyToMessageId?: string,
    selectedReplyQuote?: MessageReplyQuote,
    entities: MessageTextEntity[] = mentionEntitiesRef.current,
  ) => {
    if (draftTimerRef.current) globalThis.clearTimeout(draftTimerRef.current);
    pendingDraftRef.current = {
      text,
      replyToMessageId,
      replyQuote: selectedReplyQuote,
      ...(entities.length ? { entities: [...entities] } : {}),
    };
    localDraftDirtyRef.current = true;
    draftTimerRef.current = globalThis.setTimeout(flushDraft, LOCAL_DRAFT_DELAY_MS);
  }, [flushDraft]);

  const applyBotSuggestion = useCallback((suggestion: BotCommandSuggestion) => {
    selectedBotRef.current = suggestion;
    const includeUsername = Boolean(
      suggestion.botUsername &&
      suggestion.botUsername.toLocaleLowerCase() !== defaultBotUsername?.toLocaleLowerCase()
    );
    const next = `/${suggestion.command}${includeUsername ? `@${suggestion.botUsername}` : ""} `;
    mentionEntitiesRef.current = [];
    draftRef.current = next;
    setDraft(next);
    scheduleDraft(next, replyingTo?.id ?? chatDraft?.replyToMessageId, activeReplyQuote);
    focusComposer();
  }, [activeReplyQuote, chatDraft?.replyToMessageId, defaultBotUsername, focusComposer, replyingTo?.id, scheduleDraft]);

  const stopTyping = useCallback(() => {
    if (typingRefreshRef.current) globalThis.clearInterval(typingRefreshRef.current);
    if (typingIdleRef.current) globalThis.clearTimeout(typingIdleRef.current);
    typingRefreshRef.current = undefined;
    typingIdleRef.current = undefined;
    if (!typingActiveRef.current) return;
    typingActiveRef.current = false;
    void onTypingChange(chatId, false);
  }, [chatId, onTypingChange]);

  const keepTyping = useCallback((text: string) => {
    if (blockTypingStatus || editingMessage || !text.trim()) {
      stopTyping();
      return;
    }
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      void onTypingChange(chatId, true);
      typingRefreshRef.current = globalThis.setInterval(() => {
        if (typingActiveRef.current) void onTypingChange(chatId, true);
      }, TYPING_REFRESH_MS);
    }
    if (typingIdleRef.current) globalThis.clearTimeout(typingIdleRef.current);
    typingIdleRef.current = globalThis.setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [blockTypingStatus, chatId, editingMessage, onTypingChange, stopTyping]);

  const commitInputSideEffects = useCallback((value: string) => {
    if (editingMessage) return;
    scheduleDraft(value, replyingTo?.id ?? chatDraft?.replyToMessageId, activeReplyQuote);
    keepTyping(value);
  }, [activeReplyQuote, chatDraft?.replyToMessageId, editingMessage, keepTyping, replyingTo?.id, scheduleDraft]);

  const applyMentionSuggestion = useCallback((user: User) => {
    const previousText = draftRef.current;
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? previousText.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const query = composerMentionQueryForDraft(previousText, selectionEnd);
    if (!query || query.start > selectionStart) return;
    const result = insertComposerMention(
      previousText,
      mentionTextForUser(user),
      user.id,
      query.start,
      query.end,
    );
    const insertedEntities = reconcileComposerMentionEntities(
      previousText,
      result.value,
      mentionEntitiesRef.current,
    );
    mentionEntitiesRef.current = [
      ...insertedEntities,
      result.entity,
    ].sort((left, right) => left.offset - right.offset);
    setMentionSuggestions([]);
    setActiveMentionSuggestionIndex(0);
    draftRef.current = result.value;
    setDraft(result.value);
    commitInputSideEffects(result.value);
    focusComposer({ cursor: result.cursor });
  }, [commitInputSideEffects, focusComposer, inputRef]);

  useEffect(() => {
    if (!textInsertion || textInsertion.draftKey !== draftKey || editingMessage || appliedTextInsertionRef.current === textInsertion.id) return;
    appliedTextInsertionRef.current = textInsertion.id;
    const input = inputRef.current;
    const previousText = draftRef.current;
    const selectionStart = input?.selectionStart ?? previousText.length;
    const selectionEnd = input?.selectionEnd ?? previousText.length;
    let insertedMention: MessageTextEntity | undefined;
    let result = insertComposerText(
      previousText,
      textInsertion.text,
      selectionStart,
      selectionEnd,
    );
    if (textInsertion.userId) {
      const mentionResult = insertComposerMention(
        previousText,
        textInsertion.text,
        textInsertion.userId,
        selectionStart,
        selectionEnd,
      );
      insertedMention = mentionResult.entity;
      result = mentionResult;
    }
    mentionEntitiesRef.current = [
      ...reconcileComposerMentionEntities(
        previousText,
        result.value,
        mentionEntitiesRef.current,
      ),
      ...(insertedMention ? [insertedMention] : []),
    ].sort((left, right) => left.offset - right.offset);
    draftRef.current = result.value;
    setDraft(result.value);
    commitInputSideEffects(result.value);
    onTextInsertionApplied?.(textInsertion.id);
    focusComposer({ cursor: result.cursor });
  }, [commitInputSideEffects, draftKey, editingMessage, focusComposer, inputRef, onTextInsertionApplied, textInsertion]);

  const finishComposition = useCallback((value: string) => {
    if (!composingRef.current) return;
    composingRef.current = false;
    setComposing(false);
    draftRef.current = value;
    setDraft(value);
    commitInputSideEffects(value);
  }, [commitInputSideEffects]);

  const insertEmoji = useCallback((emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? draftRef.current.length;
    const end = input?.selectionEnd ?? start;
    const value = `${draftRef.current.slice(0, start)}${emoji}${draftRef.current.slice(end)}`;
    mentionEntitiesRef.current = reconcileComposerMentionEntities(
      draftRef.current,
      value,
      mentionEntitiesRef.current,
    );
    draftRef.current = value;
    setDraft(value);
    commitInputSideEffects(value);
    focusComposer({ cursor: start + emoji.length });
  }, [commitInputSideEffects, focusComposer, inputRef]);

  useEffect(() => {
    const previous = previousEditingRef.current;
    if (editingMessage && previous?.id !== editingMessage.id) {
      if (!previous) draftBeforeEditRef.current = draftRef.current;
      if (!previous) entitiesBeforeEditRef.current = mentionEntitiesRef.current;
      if (draftTimerRef.current) flushDraft();
      draftRef.current = editingMessage.content.kind === "text" ? editingMessage.content.text
        : isCaptionContent(editingMessage.content) ? editingMessage.content.caption ?? "" : "";
      mentionEntitiesRef.current = editingMessage.content.kind === "text"
        ? editingMessage.content.entities ?? []
        : isCaptionContent(editingMessage.content) ? editingMessage.content.captionEntities ?? [] : [];
      setDraft(draftRef.current);
      stopTyping();
      focusComposer({ cursor: draftRef.current.length });
    } else if (!editingMessage && previous) {
      draftRef.current = draftBeforeEditRef.current ?? chatDraft?.text ?? "";
      mentionEntitiesRef.current = entitiesBeforeEditRef.current ?? chatDraft?.entities ?? [];
      draftBeforeEditRef.current = undefined;
      entitiesBeforeEditRef.current = undefined;
      setDraft(draftRef.current);
    }
    previousEditingRef.current = editingMessage;
  }, [chatDraft?.entities, chatDraft?.text, editingMessage, flushDraft, focusComposer, stopTyping]);

  useEffect(() => {
    if (editingMessage || localDraftDirtyRef.current || composingRef.current) return;
    const incoming = chatDraft?.text ?? "";
    const entitiesChanged = JSON.stringify(mentionEntitiesRef.current) !== JSON.stringify(chatDraft?.entities ?? []);
    mentionEntitiesRef.current = chatDraft?.entities ?? [];
    if (incoming === draftRef.current) {
      if (entitiesChanged) refreshFormatting(revision => revision + 1);
      return;
    }
    draftRef.current = incoming;
    setDraft(incoming);
  }, [chatDraft?.entities, chatDraft?.text, editingMessage]);

  useEffect(() => {
    const replyToMessageId = replyingTo?.id ?? chatDraft?.replyToMessageId;
    const quoteChanged = JSON.stringify(replyQuoteRef.current) !== JSON.stringify(activeReplyQuote);
    if (replyToMessageIdRef.current === replyToMessageId && !quoteChanged) return;
    replyToMessageIdRef.current = replyToMessageId;
    replyQuoteRef.current = activeReplyQuote;
    if (!editingMessage) scheduleDraft(draftRef.current, replyToMessageId, activeReplyQuote);
  }, [activeReplyQuote, chatDraft?.replyToMessageId, editingMessage, replyingTo?.id, scheduleDraft]);

  useEffect(() => {
    if (blockTypingStatus || editingMessage) stopTyping();
  }, [blockTypingStatus, editingMessage, stopTyping]);

  useEffect(() => {
    if (editingMessage) closeEmojiPicker();
  }, [closeEmojiPicker, editingMessage]);

  useEffect(() => () => {
    clearEmojiOpenTimer();
    clearEmojiCloseTimer();
  }, [clearEmojiCloseTimer, clearEmojiOpenTimer]);

  useEffect(() => () => {
    if (composingRef.current && !editingMessage) {
      pendingDraftRef.current = {
        text: draftRef.current,
        ...(mentionEntitiesRef.current.length
          ? { entities: [...mentionEntitiesRef.current] }
          : {}),
        replyToMessageId: replyToMessageIdRef.current,
        replyQuote: replyQuoteRef.current,
      };
    }
    flushDraft();
    stopTyping();
  }, [editingMessage, flushDraft, stopTyping]);

  useEffect(() => () => {
    closeAttachmentPreviewSession();
    for (const attachment of pendingAttachmentsRef.current) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
  }, [closeAttachmentPreviewSession]);

  useEffect(() => {
    const session = attachmentPreviewSessionRef.current;
    if (!session) return;
    if (session.draftKey !== draftKey) {
      closeAttachmentPreviewSession();
      return;
    }
    if (session.kind === "photo") {
      if (
        photoPreviewMessages.length === 0 ||
        !syncMediaViewerWindowSession(session.id, photoPreviewMessages, colorTheme)
      ) {
        attachmentPreviewSessionRef.current = undefined;
      }
      return;
    }
    if (!pendingAttachments.some((pending) => pending.id === session.attachmentId)) {
      closeAttachmentPreviewSession();
    }
  }, [closeAttachmentPreviewSession, colorTheme, draftKey, pendingAttachments, photoPreviewMessages]);

  useEffect(() => {
    const switchedDraft = pendingAttachmentDraftKeyRef.current !== draftKey;
    const batchChanged = localAttachmentBatchIdRef.current !== localAttachmentDraft?.batchId;
    if (
      !switchedDraft &&
      !batchChanged &&
      (!localAttachmentDraft || pendingAttachmentsRef.current.length > 0)
    ) return;
    pendingAttachmentDraftKeyRef.current = draftKey;
    localAttachmentBatchIdRef.current = localAttachmentDraft?.batchId;
    if (!switchedDraft && localAttachmentDraft && pendingAttachmentsRef.current.length > 0) return;

    closeAttachmentPreviewSession();
    for (const pending of pendingAttachmentsRef.current) {
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    }
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
    setAttachmentNotice(undefined);
    setAttachmentMode(localAttachmentDraft?.mode ?? "media");
    setAttachmentSpoiler(localAttachmentDraft?.hasSpoiler ?? false);
    setMuteVideos(localAttachmentDraft?.muteVideos ?? false);
    if (!localAttachmentDraft) return;

    let cancelled = false;
    setAttachmentPending(true);
    void loadLocalAttachmentDraft(draftKey).then((attachments) => {
      if (cancelled) return;
      const restored = attachments.map(pendingAttachmentFrom);
      pendingAttachmentsRef.current = restored;
      setPendingAttachments(restored);
    }).finally(() => {
      if (!cancelled) setAttachmentPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [closeAttachmentPreviewSession, draftKey, loadLocalAttachmentDraft, localAttachmentDraft]);

  const persistPendingAttachments = useCallback((next: PendingAttachment[]) => {
    if (next.length === 0) {
      void clearLocalAttachmentDraft(draftKey);
      return;
    }
    void saveLocalAttachmentDraft(
      draftKey,
      chatId,
      next.map(({ attachment }) => attachment),
      {
        mode: attachmentModeRef.current,
        hasSpoiler: attachmentSpoilerRef.current,
        muteVideos: muteVideosRef.current,
      },
    ).then((saved) => {
      if (!saved) return;
      updateLocalAttachmentDraftOptions(draftKey, {
        mode: attachmentModeRef.current,
        hasSpoiler: attachmentSpoilerRef.current,
        muteVideos: muteVideosRef.current,
      });
    });
  }, [chatId, clearLocalAttachmentDraft, draftKey, saveLocalAttachmentDraft, updateLocalAttachmentDraftOptions]);

  const updateAttachmentOptions = useCallback((options: Partial<{
    mode: AttachmentSendMode;
    hasSpoiler: boolean;
    muteVideos: boolean;
  }>) => {
    if (options.mode !== undefined) {
      attachmentModeRef.current = options.mode;
      setAttachmentMode(options.mode);
    }
    if (options.hasSpoiler !== undefined) {
      attachmentSpoilerRef.current = options.hasSpoiler;
      setAttachmentSpoiler(options.hasSpoiler);
    }
    if (options.muteVideos !== undefined) {
      muteVideosRef.current = options.muteVideos;
      setMuteVideos(options.muteVideos);
    }
    updateLocalAttachmentDraftOptions(draftKey, options);
  }, [draftKey, updateLocalAttachmentDraftOptions]);

  const addPendingAttachments = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const current = pendingAttachmentsRef.current;
    const available = Math.max(0, TELEGRAM_ALBUM_MAX_ITEMS - current.length);
    const accepted = files.slice(0, available).map((file) => pendingAttachmentFrom({
      file,
      kind: classifyOutgoingAttachment(file),
    }));
    const next = [...current, ...accepted];
    const mediaEligible = next.every(({ attachment }) => canSendAttachmentAsMedia(attachment.kind));
    if (!mediaEligible) {
      updateAttachmentOptions({ mode: "file", hasSpoiler: false, muteVideos: false });
    } else if (current.length === 0) {
      updateAttachmentOptions({ mode: "media" });
    }
    pendingAttachmentsRef.current = next;
    setPendingAttachments(next);
    setAttachmentNotice(files.length > available
      ? translate("一次最多发送 {{value0}} 个附件", { value0: TELEGRAM_ALBUM_MAX_ITEMS })
      : undefined);
    persistPendingAttachments(next);

    for (const pending of accepted) {
      void inspectOutgoingAttachment(pending.attachment.file).then((attachment) => {
        const latest = pendingAttachmentsRef.current;
        if (!latest.some((candidate) => candidate.id === pending.id)) return;
        const inspected = latest.map((candidate) =>
          candidate.id === pending.id ? { ...candidate, attachment } : candidate,
        );
        pendingAttachmentsRef.current = inspected;
        setPendingAttachments(inspected);
      });
    }
  }, [persistPendingAttachments, updateAttachmentOptions]);

  const removePendingAttachment = useCallback((id: string) => {
    closeAttachmentPreviewSession();
    const current = pendingAttachmentsRef.current;
    const removed = current.find((attachment) => attachment.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    const next = current.filter((attachment) => attachment.id !== id);
    pendingAttachmentsRef.current = next;
    setPendingAttachments(next);
    if (next.some(({ attachment }) => !canSendAttachmentAsMedia(attachment.kind))) {
      updateAttachmentOptions({ mode: "file", hasSpoiler: false, muteVideos: false });
    }
    persistPendingAttachments(next);
    setAttachmentNotice(undefined);
    focusComposer();
  }, [closeAttachmentPreviewSession, focusComposer, persistPendingAttachments, updateAttachmentOptions]);

  const updateEditedPendingAttachment = useCallback((id: string, result: MediaEditorResult) => {
    closeAttachmentPreviewSession();
    const current = pendingAttachmentsRef.current;
    const target = current.find((item) => item.id === id);
    if (!target) return;
    if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
    const newPreviewUrl = URL.createObjectURL(result.file);
    const updatedAttachment: OutgoingAttachment = {
      ...target.attachment,
      file: result.file,
      kind: result.kind ?? target.attachment.kind,
      width: result.width ?? target.attachment.width,
      height: result.height ?? target.attachment.height,
      duration: result.duration ?? target.attachment.duration,
      thumbnail: result.thumbnail ?? target.attachment.thumbnail,
      hasSpoiler: result.hasSpoiler ?? target.attachment.hasSpoiler,
    };
    const next = current.map((item) => item.id === id ? {
      ...item,
      attachment: updatedAttachment,
      previewUrl: newPreviewUrl,
    } : item);
    pendingAttachmentsRef.current = next;
    setPendingAttachments(next);
    if (result.hasSpoiler !== undefined) {
      setAttachmentSpoiler((prev) => prev || Boolean(result.hasSpoiler));
    }
    persistPendingAttachments(next);
  }, [closeAttachmentPreviewSession, persistPendingAttachments]);

  const sendPendingAttachments = async (schedulingState?: MessageSchedulingState, forceDisableNotification?: boolean) => {
    if (editingMessage || sending || attachmentPending || pendingAttachments.length === 0) return;
    const restoreFocus = focus.capture();
    const rawCaption = trimComposerFormattedText(draftRef.current, mentionEntitiesRef.current);
    const caption = parseMarkdownToFormattedText(rawCaption.text, rawCaption.entities);
    setAttachmentPending(true);
    try {
      const inspectedAttachments = await Promise.all(
        pendingAttachments.map(async ({ attachment }) => {
          const inspected = await inspectOutgoingAttachment(attachment.file);
          return {
            ...inspected,
            ...attachment,
            file: attachment.file,
          };
        }),
      );
      const sent = await onSendFiles(
        inspectedAttachments.map((attachment) => ({
          ...attachment,
          kind: attachmentMode === "file"
            ? "document"
            : muteVideos && attachment.kind === "video"
              ? "animation"
              : attachment.kind,
          hasSpoiler: attachmentMode === "media" &&
            canPreviewOutgoingAttachment(attachment.kind) &&
            attachmentSpoiler,
          selfDestructType: attachmentSelfDestruct ?? undefined,
        })),
        caption.text || undefined,
        caption.entities,
        replyingTo?.id ?? chatDraft?.replyToMessageId,
        activeReplyQuote,
        forceDisableNotification ?? disableNotification,
        schedulingState,
      );
      if (!sent) return;
      closeAttachmentPreviewSession();
      for (const attachment of pendingAttachments) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
      pendingAttachmentsRef.current = [];
      setPendingAttachments([]);
      setAttachmentNotice(undefined);
      setAttachmentMode("media");
      setAttachmentSpoiler(false);
      setMuteVideos(false);
      setAttachmentSelfDestruct(null);
      await clearLocalAttachmentDraft(draftKey);
      if (draftTimerRef.current) globalThis.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = undefined;
      pendingDraftRef.current = undefined;
      localDraftDirtyRef.current = false;
      draftRef.current = "";
      mentionEntitiesRef.current = [];
      setDraft("");
      onDraftChange(chatId, "", undefined, undefined);
      onCancelReply();
      stopTyping();
      restoreFocus();
    } finally {
      setAttachmentPending(false);
    }
  };

  const submitMessage = async (schedulingState?: MessageSchedulingState, forceDisableNotification?: boolean) => {
    if (sending) return;
    const original = editingMessage?.content;
    const originalText = original?.kind === "text" ? original.text
      : original && isCaptionContent(original) ? original.caption ?? "" : "";
    const originalEntities = original?.kind === "text" ? original.entities
      : original && isCaptionContent(original) ? original.captionEntities : undefined;
    // Compare on submission: edits reverted to the original are also a no-op.
    if (editingMessage && equalFormattedText(draftRef.current, mentionEntitiesRef.current, originalText, originalEntities)) {
      onCancelEditing();
      focusComposer();
      return;
    }
    if (!editingMessage && pendingAttachments.length > 0) {
      closeEmojiPicker();
      await sendPendingAttachments(schedulingState, forceDisableNotification);
      return;
    }
    const rawSubmitted = trimComposerFormattedText(draftRef.current, mentionEntitiesRef.current);
    const submitted = parseMarkdownToFormattedText(rawSubmitted.text, rawSubmitted.entities);
    if (!submitted.text && !editingCaption) return;
    const restoreFocus = focus.capture();
    closeEmojiPicker();
    if (editingMessage) {
      if (equalFormattedText(submitted.text, submitted.entities, originalText, originalEntities)) {
        onCancelEditing();
        restoreFocus();
        return;
      }
      setSending(true);
      const edited = await onEditMessage(editingMessage.id, submitted.text, submitted.entities);
      setSending(false);
      if (edited) onCancelEditing();
      restoreFocus();
      return;
    }

    const startCommand = submitted.text.match(/^\/start(?:@([A-Za-z0-9_]{5,32}))?(?:\s+(.+))?$/);
    const startBot = selectedBotRef.current;
    const requestedBotUsername = startCommand?.[1] ?? defaultBotUsername;
    const canUseBotStartApi = startCommand && startBot && startBot.command === "start" &&
      Boolean(requestedBotUsername) &&
      startBot.botUsername.toLocaleLowerCase() === requestedBotUsername?.toLocaleLowerCase();
    if (startCommand && startBot && canUseBotStartApi) {
      if (draftTimerRef.current) globalThis.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = undefined;
      pendingDraftRef.current = undefined;
      localDraftDirtyRef.current = false;
      draftRef.current = "";
      mentionEntitiesRef.current = [];
      setDraft("");
      onDraftChange(chatId, "", undefined, undefined);
      stopTyping();
      setSending(true);
      const sent = await onSendBotStart(startBot.botUserId, startCommand[2]);
      setSending(false);
      if (!sent) {
        draftRef.current = submitted.text;
        mentionEntitiesRef.current = submitted.entities;
        setDraft(submitted.text);
        scheduleDraft(submitted.text, replyingTo?.id ?? chatDraft?.replyToMessageId, activeReplyQuote);
      }
      else onCancelReply();
      restoreFocus();
      return;
    }

    if (draftTimerRef.current) globalThis.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = undefined;
    pendingDraftRef.current = undefined;
    localDraftDirtyRef.current = false;
    draftRef.current = "";
    mentionEntitiesRef.current = [];
    setDraft("");
    onDraftChange(chatId, "", undefined, undefined);
    stopTyping();
    focusComposer();
    setSending(true);
    const effectIdToSend = selectedEffect?.id;
    const sent = await onSendMessage(
      submitted.text,
      replyingTo?.id ?? chatDraft?.replyToMessageId,
      activeReplyQuote,
      submitted.entities,
      forceDisableNotification ?? disableNotification,
      schedulingState,
      effectIdToSend,
    );
    setSending(false);
    if (sent) {
      onCancelReply();
      setSelectedEffect(undefined);
    } else {
      const restored = prependComposerFormattedText(
        submitted,
        draftRef.current,
        mentionEntitiesRef.current,
      );
      draftRef.current = restored.text;
      mentionEntitiesRef.current = restored.entities;
      setDraft(restored.text);
      scheduleDraft(restored.text, replyingTo?.id ?? chatDraft?.replyToMessageId, activeReplyQuote);
    }
    restoreFocus();
  };

  const submitInlineResult = async (result: InlineQueryResultPage["results"][number]) => {
    const inline = composerInlineQueryForDraft(draftRef.current, knownNonBotUsernames);
    if (!inline || !inlineResults || sending) return;
    const restoreFocus = focus.capture();
    const bot = await onGetBotCommands("", inline.username);
    const botUserId = bot[0]?.botUserId ?? `bot:${inline.username}`;
    setSending(true);
    const sent = await onSendInlineResult(botUserId, inlineResults.queryId, result.id, replyingTo?.id ?? chatDraft?.replyToMessageId);
    setSending(false);
    if (sent) {
      draftRef.current = "";
      mentionEntitiesRef.current = [];
      setDraft("");
      onDraftChange(chatId, "", undefined);
      setInlineResults(undefined);
      onCancelReply();
    }
    restoreFocus();
  };

  const clearReply = useCallback(() => {
    if (draftTimerRef.current) globalThis.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = undefined;
    pendingDraftRef.current = undefined;
    localDraftDirtyRef.current = false;
    replyToMessageIdRef.current = undefined;
    replyQuoteRef.current = undefined;
    onDraftChange(
      chatId,
      draftRef.current,
      undefined,
      undefined,
      mentionEntitiesRef.current,
    );
    onCancelReply();
  }, [chatId, onCancelReply, onDraftChange]);
  const cancelReply = useCallback(() => { clearReply(); focusComposer(); }, [clearReply, focusComposer]);

  const handleFileDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (editingMessage || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    fileDragDepthRef.current += 1;
    setDraggingFiles(true);
  }, [editingMessage]);

  const handleFileDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (editingMessage || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, [editingMessage]);

  const handleFileDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) setDraggingFiles(false);
  }, []);

  const handleFileDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    if (editingMessage || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    fileDragDepthRef.current = 0;
    setDraggingFiles(false);

    try {
      const scanResult = await scanDataTransfer(event.dataTransfer);
      if (scanResult.files.length === 0) {
        focusComposer();
        return;
      }

      if (scanResult.hasDirectory || scanResult.files.length > 1) {
        setArchiveDropFiles(scanResult.files);
        setArchiveDropDefaultName(scanResult.suggestedArchiveName);
        setArchiveDropHasDirectory(scanResult.hasDirectory);
        setArchiveModalOpen(true);
      } else {
        addPendingAttachments(scanResult.files.map((f) => f.file));
      }
    } catch {
      addPendingAttachments(Array.from(event.dataTransfer.files));
    }
    focusComposer();
  }, [addPendingAttachments, editingMessage, focusComposer]);

  const botSuggestionGroups = useMemo(() => {
    const groups = new Map<string, {
      botUserId: string;
      botUsername: string;
      suggestions: BotCommandSuggestion[];
    }>();
    for (const suggestion of botSuggestions) {
      const existing = groups.get(suggestion.botUserId);
      if (existing) {
        existing.suggestions.push(suggestion);
      } else {
        groups.set(suggestion.botUserId, {
          botUserId: suggestion.botUserId,
          botUsername: suggestion.botUsername,
          suggestions: [suggestion],
        });
      }
    }
    return [...groups.values()];
  }, [botSuggestions]);

  useLayoutEffect(() => {
    const panel = botSuggestionPanelRef.current;
    if (!panel || botSuggestions.length === 0) return;
    panel.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [activeBotSuggestionIndex, botSuggestions.length]);

  // Only the foreground chooser may consume selection keys.
  const showInlinePanel = !emojiPickerOpen && !draggingFiles && !editingMessage && Boolean(showInlineLoading || inlineResults);
  const showMentionPanel = !emojiPickerOpen && !draggingFiles && !editingMessage && !showInlinePanel && mentionSuggestions.length > 0;
  const showBotPanel = !emojiPickerOpen && !draggingFiles && !editingMessage && !showInlinePanel && !showMentionPanel && botSuggestions.length > 0;
  let botSuggestionIndex = 0;

  return (
    <div
      inert={inert || undefined}
      className={`composer-wrap ${pendingAttachments.length > 0 && !editingMessage ? "has-attachments" : ""} ${draggingFiles ? "is-file-dragging" : ""}`}
      onDragEnter={handleFileDragEnter}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      <MotionPresence present={emojiPickerOpen && !editingMessage} variant="popover">
        {emojiPickerOpen && !editingMessage ? (
          <EmojiPicker
            chatId={chatId}
            replyToMessageId={replyingTo?.id ?? chatDraft?.replyToMessageId}
            replyQuote={activeReplyQuote}
            disableNotification={disableNotification}
            onEmoji={insertEmoji}
            onAssetSent={clearReply}
            onClose={closeEmojiPicker}
            onRequestComposerFocus={focusComposer}
            onCaptureComposerFocus={focus.capture}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") clearEmojiCloseTimer();
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") scheduleEmojiPickerClose();
            }}
          />
        ) : null}
      </MotionPresence>
      <input
        ref={mediaInputRef}
        className="sr-only"
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            updateAttachmentOptions({ mode: "media" });
            addPendingAttachments(files);
          }
          event.target.value = "";
          focusComposer();
        }}
      />
      <input
        ref={audioInputRef}
        className="sr-only"
        type="file"
        multiple
        accept="audio/*"
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) addPendingAttachments(files);
          event.target.value = "";
          focusComposer();
        }}
      />
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        multiple
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) addPendingAttachments(files);
          event.target.value = "";
          focusComposer();
        }}
      />
      <input
        ref={folderInputRef}
        className="sr-only"
        type="file"
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        onChange={async (event) => {
          const rawFiles = Array.from(event.target.files ?? []);
          if (rawFiles.length > 0) {
            const scanned: ScannedArchiveFile[] = rawFiles.map((file) => {
              const rel = (file as any).webkitRelativePath || file.name;
              return {
                file,
                relativePath: sanitizeRelativePath(rel),
                size: file.size,
                lastModified: file.lastModified || Date.now(),
              };
            });
            const firstDir = rawFiles[0] && (rawFiles[0] as any).webkitRelativePath
              ? (rawFiles[0] as any).webkitRelativePath.split("/")[0]
              : undefined;
            setArchiveDropFiles(scanned);
            setArchiveDropDefaultName(firstDir ? `${firstDir}.zip` : "archive.zip");
            setArchiveDropHasDirectory(true);
            setArchiveModalOpen(true);
          }
          event.target.value = "";
          focusComposer();
        }}
      />
      {connectionStatus !== "online" && connectionStatus !== "syncing" && (
        <ConnectionStatusIndicator
          className="composer-connection-status"
          status={connectionStatus}
        />
      )}
      {(queuedMessageCount > 0 || failedQueuedMessageCount > 0 || queuedAttachmentCount > 0 || failedAttachmentCount > 0) && (
        <div className="composer-outbox-status" role="status">
          {[
            failedQueuedMessageCount > 0 ? translate("{{value0}} 条离线消息需要手动重试", { value0: failedQueuedMessageCount }) : undefined,
            failedAttachmentCount > 0 ? translate("{{value0}} 个离线附件需要手动重试", { value0: failedAttachmentCount }) : undefined,
            queuedMessageCount > 0 ? translate("{{value0}} 条消息将在联网后发送", { value0: queuedMessageCount }) : undefined,
            queuedAttachmentCount > 0 ? translate("{{value0}} 个附件将在联网后上传", { value0: queuedAttachmentCount }) : undefined,
          ].filter(Boolean).join("；")}
        </div>
      )}
      {composerContextMessage && (
        <div className={`composer-context ${editingMessage ? "is-editing" : "is-replying"}`}>
          <span className="composer-context-icon">
            {editingMessage
              ? <Edit3 size={18} strokeWidth={1.9} />
              : <Reply size={18} strokeWidth={1.9} />}
          </span>
          <span className="composer-context-copy">
            <strong>
              {contextTitle}
              {contextSubject ? (
                <> <span className={`composer-context-subject ${contextSubjectIsAdministrator ? "is-administrator" : ""}`.trim()}>{contextSubject}</span></>
              ) : null}
            </strong>
            <small>{editingMessage
              ? messageSummary(composerContextMessage.content)
              : activeReplyQuote?.text ?? messageSummary(composerContextMessage.content)}</small>
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label={editingMessage ? translate("取消编辑") : translate("取消回复")}
            title={editingMessage ? translate("取消编辑") : translate("取消回复")}
            onClick={editingMessage ? () => { onCancelEditing(); focusComposer(); } : cancelReply}
          >
            <X size={17} strokeWidth={1.9} />
          </button>
        </div>
      )}
      {pendingAttachments.length > 0 && !editingMessage && (
        <section className="composer-attachment-preview" aria-label={translate("待发送附件")}>
          <header className="composer-attachment-header">
            <strong>{translate("待发送")}</strong>
            <span>{translate("{{value0}} 个附件", { value0: pendingAttachments.length })}</span>
          </header>
          <div className="composer-attachment-grid" data-count={pendingAttachments.length}>
            {pendingAttachments.map((pending) => {
              const { attachment } = pending;
              const concealed = attachmentMode === "media" &&
                attachmentSpoiler &&
                canPreviewOutgoingAttachment(attachment.kind);
              const extBadge = attachment.file.name.split(".").pop()?.toUpperCase().slice(0, 4);
              return (
                <article className="composer-attachment-item" key={pending.id}>
                  <div className="composer-attachment-open">
                    {pending.previewUrl ? (
                      <MediaSpoiler
                        active={concealed}
                        resetKey={`${draftKey}:${pending.id}:${attachmentSpoiler ? "concealed" : "plain"}`}
                      >
                        <button
                          className="composer-attachment-media-button"
                          type="button"
                          aria-label={translate("预览 {{value0}}", { value0: attachment.file.name })}
                          title={translate("预览附件")}
                          onClick={() => openPendingAttachmentPreview(pending)}
                        >
                          {attachment.kind === "video" ? (
                            <video src={pending.previewUrl} aria-hidden="true" muted />
                          ) : (
                            <StableImage src={pending.previewUrl} alt="" />
                          )}
                        </button>
                      </MediaSpoiler>
                    ) : (
                      <span className="composer-file-preview"><FileText size={25} /></span>
                    )}
                    {extBadge && <span className="composer-attachment-fmt-badge">{extBadge}</span>}
                    <span className="composer-attachment-kind">{ATTACHMENT_KIND_LABELS[attachment.kind]}</span>
                  </div>
                  <span className="composer-attachment-copy">
                    <strong>{attachment.file.name}</strong>
                    <small>{attachmentSizeLabel(attachment.file.size)}</small>
                  </span>
                  {canPreviewOutgoingAttachment(attachment.kind) && pending.previewUrl && (
                    <button
                      className="composer-attachment-edit-btn"
                      type="button"
                      aria-label={translate("编辑 {{value0}}", { value0: attachment.file.name })}
                      title="Edit photo, video or GIF"
                      onClick={() => setEditingAttachment(pending)}
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                  <button
                    className="composer-attachment-remove"
                    type="button"
                    aria-label={translate("移除 {{value0}}", { value0: attachment.file.name })}
                    title={translate("移除附件")}
                    onClick={() => removePendingAttachment(pending.id)}
                  >
                    <X size={14} />
                  </button>
                </article>
              );
            })}
            {pendingAttachments.length < TELEGRAM_ALBUM_MAX_ITEMS && (
              <button
                type="button"
                className="composer-attachment-add-more-btn"
                title="Add more files"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="composer-attachment-add-more-icon">
                  <Plus size={20} strokeWidth={2.2} />
                </div>
                <span>Add More</span>
              </button>
            )}
          </div>
          <div className="composer-attachment-options">
            <fieldset className="attachment-mode-control">
              <legend className="sr-only">{translate("附件发送方式")}</legend>
              <label>
                <input
                  type="radio"
                  name="attachment-mode"
                  checked={attachmentMode === "media"}
                  disabled={!mediaModeAvailable}
                  onChange={() => updateAttachmentOptions({ mode: "media" })}
                />
                <span>{translate("媒体")}</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="attachment-mode"
                  checked={attachmentMode === "file"}
                  onChange={() => updateAttachmentOptions({
                    mode: "file",
                    hasSpoiler: false,
                    muteVideos: false,
                  })}
                />
                <span>{translate("原文件")}</span>
              </label>
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={attachmentSpoiler}
                disabled={attachmentMode === "file" || !hasPreviewableAttachments}
                onChange={(event) => updateAttachmentOptions({ hasSpoiler: event.target.checked })}
              />{translate("剧透")}</label>
            {pendingAttachments.some(({ attachment }) => attachment.kind === "video") && (
              <label>
                <input
                  type="checkbox"
                  checked={muteVideos}
                  disabled={attachmentMode === "file"}
                  onChange={(event) => updateAttachmentOptions({ muteVideos: event.target.checked })}
                />{translate("作为静音动画")}</label>
            )}
            {allowSendWhenOnline && (
              <label>
                <input
                  type="checkbox"
                  checked={attachmentSelfDestruct?.kind === "immediately"}
                  disabled={attachmentMode === "file"}
                  onChange={(event) => {
                    setAttachmentSelfDestruct(event.target.checked ? { kind: "immediately" } : null);
                  }}
                />🔥 {translate("阅后即焚")}</label>
            )}
          </div>
          <footer>
            <span role={attachmentNotice ? "alert" : "status"}>
              {attachmentNotice ?? `${pendingAttachments.length} / ${TELEGRAM_ALBUM_MAX_ITEMS}`}
            </span>
            <button
              className="dialog-primary"
              type="button"
              disabled={attachmentPending}
              onClick={() => void sendPendingAttachments()}
            >
              {showAttachmentPending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
              <span>{translate("发送附件")}</span>
            </button>
          </footer>
        </section>
      )}
      <MotionPresence present={showMentionPanel} variant="popover">
        {showMentionPanel ? (
          <section className="mention-suggestion-panel" role="listbox" aria-label={translate("提及成员")}>
            {mentionSuggestions.map((user, index) => (
              <button
                className={index === activeMentionSuggestionIndex ? "is-active" : ""}
                data-mention-user-id={user.id}
                key={user.id}
                type="button"
                role="option"
                aria-selected={index === activeMentionSuggestionIndex}
                onPointerEnter={() => setActiveMentionSuggestionIndex(index)}
                onClick={() => applyMentionSuggestion(user)}
              >
                <Avatar avatar={user.avatar} size="small" />
                <span className="mention-suggestion-copy">
                  <strong>{user.displayName}</strong>
                  <small>{user.username ? `@${user.username.replace(/^@/, "")}` : translate("无用户名")}</small>
                </span>
                {index < 9 ? <kbd>Ctrl+{index + 1}</kbd> : null}
              </button>
            ))}
          </section>
        ) : null}
      </MotionPresence>
      <MotionPresence present={showBotPanel} variant="popover">
        {showBotPanel ? (
          <section ref={botSuggestionPanelRef} className="bot-suggestion-panel" role="listbox" aria-label={translate("机器人命令建议")}>
            {botSuggestionGroups.map((group) => {
              const groupStartIndex = botSuggestionIndex;
              botSuggestionIndex += group.suggestions.length;
              const botUser = users?.get(group.botUserId) ?? (
                group.botUsername
                  ? [...(users?.values() ?? [])].find((user) => user.username?.toLocaleLowerCase() === group.botUsername.toLocaleLowerCase())
                  : undefined
              );
              const botUsername = group.botUsername.replace(/^@/, "");
              const fallbackAvatar = {
                label: botUsername.slice(0, 2).toUpperCase() || "B",
                color: "#4675a8",
              };
              const botAvatar = botUser?.avatar ?? fallbackAvatar;
              return (
                <div
                  className="bot-suggestion-group"
                  data-bot-user-id={group.botUserId}
                  key={group.botUserId}
                  role="group"
                  aria-label={botUsername ? `@${botUsername}` : `ID ${group.botUserId}`}
                >
                  <div className="bot-suggestion-group-heading">
                    <strong>{botUser?.displayName ?? translate("机器人")}</strong>
                    <small>{botUsername ? `@${botUsername}` : `ID ${group.botUserId}`}</small>
                  </div>
                  {group.suggestions.map((suggestion, index) => {
                    const flatIndex = groupStartIndex + index;
                    return (
                      <button
                        className={flatIndex === activeBotSuggestionIndex ? "is-active" : ""}
                        key={`${suggestion.botUserId}-${suggestion.command}`}
                        type="button"
                        role="option"
                        aria-selected={flatIndex === activeBotSuggestionIndex}
                        onPointerEnter={() => setActiveBotSuggestionIndex(flatIndex)}
                        onClick={() => applyBotSuggestion(suggestion)}
                      >
                        <Avatar avatar={botAvatar} size="small" />
                        <span className="bot-suggestion-copy">
                          <span className="bot-suggestion-command">
                            <strong>/{suggestion.command}</strong>
                          </span>
                          <span className="bot-suggestion-description">{suggestion.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </section>
        ) : null}
      </MotionPresence>
      <MotionPresence present={showInlinePanel} variant="popover">
        {showInlinePanel ? (
          <section className="inline-query-panel" aria-label={translate("Inline 查询结果")}>
            {inlineResults ? inlineResults.results.map((result) => <button key={result.id} type="button" className="inline-query-result" onClick={() => void submitInlineResult(result)}><span className="inline-query-result-kind">{result.kind === "photo" ? translate("图片") : result.kind === "file" ? translate("文件") : translate("结果")}</span><span><strong>{result.title}</strong><small>{result.description || result.messageText}</small></span></button>) : <div className="inline-query-loading"><LoaderCircle className="spin" size={18} />{translate("正在查询机器人")}</div>}
            {inlineResults?.hasMore && <button type="button" className="inline-query-more" disabled={inlineLoading} onClick={() => { const inline = composerInlineQueryForDraft(draftRef.current, knownNonBotUsernames); if (inline && inlineResults.nextOffset) { setInlineLoading(true); void onGetInlineResults(inline.username, inline.query, inlineResults.nextOffset).then((page) => { if (page) setInlineResults((current) => current ? { ...page, results: [...current.results, ...page.results] } : page); setInlineLoading(false); }).catch(() => setInlineLoading(false)); } }}>{showInlineLoading && <LoaderCircle className="spin" size={15} />}{translate("加载更多结果")}</button>}
          </section>
        ) : null}
      </MotionPresence>
      <div ref={composerRef} className={`composer ${editingMessage ? "is-editing" : ""}`}>
        <div ref={paperclipAnchorRef} className="composer-paperclip-anchor">
          <button
            className={`icon-button ${attachmentMenuOpen ? "is-active" : ""}`}
            type="button"
            aria-label={translate("添加附件")}
            title={editingMessage ? translate("完成编辑后添加附件") : attachmentPending ? translate("正在选择文件") : translate("添加附件")}
            disabled={Boolean(editingMessage) || attachmentPending}
            onClick={() => setAttachmentMenuOpen((prev) => !prev)}
          >
            {showAttachmentPending
              ? <LoaderCircle className="spin" size={19} strokeWidth={1.8} />
              : <Paperclip size={20} strokeWidth={1.8} />}
          </button>
          <AttachmentPickerMenu
            isOpen={attachmentMenuOpen}
            onClose={() => setAttachmentMenuOpen(false)}
            onPickMedia={() => mediaInputRef.current?.click()}
            onPickDocument={() => {
              updateAttachmentOptions({ mode: "file" });
              fileInputRef.current?.click();
            }}
            onPickAudio={() => audioInputRef.current?.click()}
            onPickPoll={() => setShowPollDialog(true)}
            onPickFolder={() => folderInputRef.current?.click()}
            onPickLocation={() => setShowLocationDialog(true)}
          />
        </div>
        {previewOpen && draft.trim() && (
          <ComposerMessagePreview
            text={draft}
            entities={mentionEntitiesRef.current}
            colorTheme={colorTheme}
            onClose={() => setPreviewOpen(false)}
          />
        )}
        {selectedEffect && (
          <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-200 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{selectedEffect.emoji}</span>
              <span className="font-semibold">{selectedEffect.name} Effect</span>
              <span className="text-purple-600 dark:text-purple-400 opacity-80 text-[11px]">— {selectedEffect.description}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEffect(undefined)}
              title="Remove effect"
              aria-label="Remove message effect"
              className="p-1 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-300 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <ComposerInput
          inputRef={inputRef}
          value={draft}
          entities={mentionEntitiesRef.current}
          colorTheme={colorTheme}
          focus={focus}
          onChange={(value, entities) => {
            closeEmojiPicker();
            if (value === draftRef.current) refreshFormatting(revision => revision + 1);
            mentionEntitiesRef.current = entities;
            draftRef.current = value;
            setDraft(value);
            if (composingRef.current) return;
            commitInputSideEffects(value);
          }}
          onPasteFiles={(files) => {
            if (editingMessage) return false;
            addPendingAttachments(files);
            return true;
          }}
          onCompositionStart={() => {
            composingRef.current = true;
            setComposing(true);
            if (draftTimerRef.current) globalThis.clearTimeout(draftTimerRef.current);
            draftTimerRef.current = undefined;
            stopTyping();
          }}
          onCompositionEnd={finishComposition}
          onFocus={() => {
            if (!composingRef.current) keepTyping(draftRef.current);
          }}
          onBlur={(value) => {
            finishComposition(value);
            stopTyping();
          }}
          onKeyDown={(event) => {
            if (!event.nativeEvent.isComposing && !composingRef.current && event.key === "Escape") {
              if (showEffectPicker) {
                event.preventDefault();
                event.stopPropagation();
                setShowEffectPicker(false);
                return;
              }
              if (selectedEffect) {
                event.preventDefault();
                event.stopPropagation();
                setSelectedEffect(undefined);
                return;
              }
              if (replyingTo) {
                event.preventDefault();
                event.stopPropagation();
                onCancelReply();
                return;
              }
            }
            if (!event.nativeEvent.isComposing && !composingRef.current && (
              shortcutActionForEvent(event.nativeEvent, preferencesStore.getState().shortcuts) === "editLastMessage" ||
              (editingMessage && event.key === "Escape")
            )) {
              event.preventDefault();
              event.stopPropagation();
              if (event.repeat || sending) return;
              if (editingMessage) {
                onCancelEditing();
                focusComposer();
              } else if (!draftRef.current && !replyingTo && pendingAttachments.length === 0) {
                onEditLatestVisible();
              }
              return;
            }
            if (!event.nativeEvent.isComposing && !composingRef.current && showMentionPanel) {
              const shortcutKey = event.code.match(/^(?:Digit|Numpad)([1-9])$/)?.[1] ??
                event.key.match(/^[1-9]$/)?.[0];
              if (event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey && shortcutKey) {
                const index = Number(shortcutKey) - 1;
                if (index < mentionSuggestions.length) {
                  event.preventDefault();
                  applyMentionSuggestion(mentionSuggestions[index]);
                  return;
                }
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveMentionSuggestionIndex((current) =>
                  (current + direction + mentionSuggestions.length) % mentionSuggestions.length
                );
                return;
              }
              if (
                (event.key === "Enter" || event.key === "Tab") &&
                !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
              ) {
                event.preventDefault();
                applyMentionSuggestion(
                  mentionSuggestions[Math.min(activeMentionSuggestionIndex, mentionSuggestions.length - 1)],
                );
                return;
              }
            }
            if (!event.nativeEvent.isComposing && !composingRef.current && showBotPanel) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveBotSuggestionIndex((current) =>
                  (current + direction + botSuggestions.length) % botSuggestions.length
                );
                return;
              }
              if (
                (event.key === "Enter" || event.key === "Tab") &&
                !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
              ) {
                event.preventDefault();
                applyBotSuggestion(
                  botSuggestions[Math.min(activeBotSuggestionIndex, botSuggestions.length - 1)],
                );
                return;
              }
            }
            const submitWithKeyboard = event.key === "Enter" && (
              ((sendOnEnter || editingMessage) && !event.shiftKey) ||
              (!sendOnEnter && (event.ctrlKey || event.metaKey))
            );
            if (!submitWithKeyboard || event.nativeEvent.isComposing || composingRef.current) return;
            event.preventDefault();
            void submitMessage();
          }}
          placeholder={editingMessage ? translate("编辑消息") : translate("写一条消息")}
          busy={sending}
        />
        <button
          className={`icon-button emoji-trigger ${emojiPickerOpen ? "is-active" : ""}`}
          type="button"
          aria-label={translate("表情")}
          aria-expanded={emojiPickerOpen}
          aria-controls="emoji-picker"
          title={translate("表情")}
          disabled={Boolean(editingMessage)}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") scheduleEmojiPickerOpen();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") scheduleEmojiPickerClose();
          }}
          onClick={toggleEmojiPicker}
        >
          <Smile size={21} strokeWidth={1.8} />
        </button>
        {enableSilentSending && <button
          className={`icon-button composer-notification-toggle ${disableNotification ? "is-active" : ""}`}
          type="button"
          aria-label={translate("静默发送")}
          aria-pressed={disableNotification}
          title={disableNotification ? translate("已开启静默发送") : translate("开启静默发送")}
          disabled={Boolean(editingMessage)}
          onClick={() => {
            setDisableNotification((enabled) => !enabled);
            focusComposer();
          }}
        >
          {disableNotification
            ? <BellOff size={20} strokeWidth={1.8} />
            : <Bell size={20} strokeWidth={1.8} />}
        </button>}

        {/* Rich Message Preview Trigger (FG-014) */}
        <button
          className={`icon-button composer-preview-trigger ${previewOpen ? "is-active text-sky-400" : ""}`}
          type="button"
          aria-label={previewOpen ? "Hide message preview" : "Preview formatted message"}
          title={previewOpen ? "Hide message preview" : "Preview formatted message"}
          disabled={!draft.trim() && pendingAttachments.length === 0}
          onClick={() => setPreviewOpen((prev) => !prev)}
        >
          <Eye size={19} strokeWidth={1.8} />
        </button>

        {/* AI Co-pilot Quick Tools in Composer */}
        <div ref={aiAnchorRef} className="composer-ai-tools-anchor">
          <button
            className={`icon-button composer-ai-trigger ${aiMenuOpen ? "is-active" : ""}`}
            type="button"
            aria-label="AI Co-pilot Tools"
            title="AI Co-pilot: Writing tools, tone transformation & autonomous agent"
            disabled={aiTransforming}
            onClick={() => setAiMenuOpen((prev) => !prev)}
          >
            {aiTransforming ? (
              <LoaderCircle className="spin" size={19} strokeWidth={1.8} />
            ) : (
              <Sparkles size={20} strokeWidth={1.8} />
            )}
          </button>

          {aiMenuOpen && (
            <div className="composer-ai-menu" role="menu">
              <div className="composer-ai-menu-header">
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Wand2 size={13} style={{ color: "#38bdf8" }} />
                  <span>AI Co-Pilot</span>
                </span>
                <span style={{ fontSize: "10px", color: "#38bdf8", opacity: 0.9 }}>
                  {draft.trim() ? `${draft.trim().length} chars` : "Type message first"}
                </span>
              </div>

              <div className="composer-ai-scroll">
                {[
                  { id: "polish", label: "✨ Polish Grammar & Typos" },
                  { id: "formal", label: "👔 Formal & Business Tone" },
                  { id: "friendly", label: "😊 Warm & Friendly Tone" },
                  { id: "shorten", label: "⚡ Concise & Shorten" },
                  { id: "expand", label: "📝 Elaborate & Expand" },
                  { id: "persuasive", label: "🎯 Compelling & Persuasive" },
                  { id: "bullet_points", label: "📋 Format as Bullet Points" },
                  { id: "emojify", label: "🎉 Add Expressive Emojis" },
                  { id: "translate_en", label: "🇬🇧 Translate to English" },
                  { id: "translate_fa", label: "🇮🇷 Translate to Persian" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="composer-ai-item"
                    disabled={!draft.trim() || aiTransforming}
                    onClick={async () => {
                      setAiMenuOpen(false);
                      if (!draft.trim()) return;
                      setAiTransforming(true);
                      try {
                        const res = await useAgentStore
                          .getState()
                          .quickTransformText(opt.id as any, draft.trim());
                        if (res && res !== draft) {
                          setDraft(res);
                          keepTyping(res);
                          focusComposer();
                        }
                      } finally {
                        setAiTransforming(false);
                      }
                    }}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="composer-ai-settings-btn"
                title="Configure AI Agent providers, API keys, models, and custom prompts"
                onClick={() => {
                  setAiMenuOpen(false);
                  if (onOpenAgent) {
                    onOpenAgent();
                  } else {
                    useAgentStore.getState().openDialog("models");
                  }
                }}
              >
                <Settings size={13} strokeWidth={2} />
                <span>Configure AI Agent & Models</span>
              </button>
            </div>
          )}
        </div>

        {scheduledMessageCount > 0 && (
          <button
            className="icon-button scheduled-messages-badge-btn"
            type="button"
            aria-label={`Scheduled messages (${scheduledMessageCount})`}
            title={`Scheduled messages (${scheduledMessageCount})`}
            onClick={onOpenScheduledMessages}
            style={{ position: "relative" }}
          >
            <Calendar size={19} strokeWidth={2} />
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 15,
                height: 15,
                padding: "0 3px",
                borderRadius: 10,
                fontSize: 9,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0284c7",
                color: "#fff",
              }}
            >
              {scheduledMessageCount}
            </span>
          </button>
        )}

        {(!draft.trim() && !editingCaption && pendingAttachments.length === 0 && !editingMessage) ? (
          <div className="composer-record-actions">
            <button
              className="record-mode-toggle icon-button"
              type="button"
              aria-label={recordingMode === "voice" ? "Switch to Video Note" : "Switch to Voice Message"}
              title={recordingMode === "voice" ? "Switch to Video Note" : "Switch to Voice Message"}
              onClick={() => setRecordingMode((prev) => (prev === "voice" ? "video" : "voice"))}
            >
              {recordingMode === "voice" ? (
                <Video size={17} strokeWidth={1.8} style={{ opacity: 0.65 }} />
              ) : (
                <Mic size={17} strokeWidth={1.8} style={{ opacity: 0.65 }} />
              )}
            </button>
            <button
              className={`send-button icon-button is-record-trigger ${recordingMode === "video" ? "is-video-mode" : "is-voice-mode"}`}
              type="button"
              aria-label={recordingMode === "voice" ? "Record Voice Message" : "Record Video Message"}
              title={recordingMode === "voice" ? "Record Voice Message (Click to start)" : "Record Video Message (Click to start)"}
              onClick={() => setActiveRecording(recordingMode)}
            >
              {recordingMode === "voice" ? (
                <Mic size={20} strokeWidth={2} />
              ) : (
                <Video size={20} strokeWidth={2} />
              )}
            </button>
          </div>
        ) : (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
            {!editingMessage && (
              <button
                className="icon-button composer-schedule-trigger"
                type="button"
                aria-label="Schedule message"
                title="Schedule message"
                onClick={() => setShowScheduleDialog(true)}
              >
                <Calendar size={18} strokeWidth={2} className="text-sky-500" />
              </button>
            )}
            {!editingMessage && (
              <button
                className={`icon-button composer-effect-trigger ${selectedEffect ? "text-purple-500 bg-purple-50 dark:bg-purple-950/40" : ""}`}
                type="button"
                aria-label="Message send effect"
                title={selectedEffect ? `Active effect: ${selectedEffect.name} (Click to change)` : "Attach message send effect"}
                onClick={() => setShowEffectPicker((prev) => !prev)}
              >
                {selectedEffect ? (
                  <span className="text-base leading-none">{selectedEffect.emoji}</span>
                ) : (
                  <Sparkles size={18} strokeWidth={2} className="text-purple-500 hover:scale-110 transition-transform" />
                )}
              </button>
            )}
            <button
              className="send-button icon-button"
              type="button"
              aria-label={editingMessage ? translate("保存编辑") : translate("发送消息")}
              title={editingMessage ? translate("保存编辑") : translate("发送消息 (Right-click to schedule)")}
              disabled={(!draft.trim() && !editingCaption && pendingAttachments.length === 0) || sending || attachmentPending}
              onClick={() => void submitMessage()}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!editingMessage && (draft.trim() || editingCaption || pendingAttachments.length > 0)) {
                  setShowSendMenu((prev) => !prev);
                }
              }}
            >
              {showSending
                ? <LoaderCircle className="spin" size={19} strokeWidth={1.8} />
                : editingMessage
                  ? <Check size={19} strokeWidth={2.2} />
                  : <Send size={19} strokeWidth={2} />}
            </button>
            {showSendMenu && (
              <div
                className="send-menu-popup bg-white dark:bg-[#1e232e] text-slate-800 dark:text-white border border-slate-200 dark:border-white/10"
                style={{
                  position: "absolute",
                  bottom: "100%",
                  right: 0,
                  marginBottom: 8,
                  zIndex: 40,
                  borderRadius: 12,
                  padding: 4,
                  boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 180,
                }}
              >
                <button
                  type="button"
                  className="px-3 py-2 text-xs font-medium text-left rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 transition"
                  onClick={() => {
                    setShowSendMenu(false);
                    setShowScheduleDialog(true);
                  }}
                >
                  <Calendar size={14} className="text-sky-500" />
                  <span>Schedule message...</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-xs font-medium text-left rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 transition"
                  onClick={() => {
                    setShowSendMenu(false);
                    setShowEffectPicker(true);
                  }}
                >
                  <Sparkles size={14} className="text-purple-500" />
                  <span>Message effect...</span>
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-xs font-medium text-left rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 flex items-center gap-2 transition"
                  onClick={() => {
                    setShowSendMenu(false);
                    void submitMessage(undefined, true);
                  }}
                >
                  <BellOff size={14} className="text-amber-500" />
                  <span>Send without sound</span>
                </button>
              </div>
            )}
            {showEffectPicker && (
              <MessageEffectPicker
                selectedEffectId={selectedEffect?.id}
                onSelectEffect={(effect) => {
                  setSelectedEffect(effect);
                  setShowEffectPicker(false);
                }}
                onClose={() => setShowEffectPicker(false)}
              />
            )}
          </div>
        )}
      </div>
      {showScheduleDialog && (
        <ScheduleMessageDialog
          allowSendWhenOnline={allowSendWhenOnline}
          onSchedule={(state) => {
            setShowScheduleDialog(false);
            void submitMessage(state);
          }}
          onClose={() => setShowScheduleDialog(false)}
        />
      )}
      {showPollDialog && (
        <CreatePollDialog
          isOpen={showPollDialog}
          chatId={chatId}
          replyToMessageId={replyingTo?.id ?? chatDraft?.replyToMessageId}
          onSend={async (input) => {
            const success = await sendPoll(input);
            return success;
          }}
          onClose={() => setShowPollDialog(false)}
        />
      )}
      {showLocationDialog && (
        <SendLocationDialog
          isOpen={showLocationDialog}
          onSend={async (locationData) => {
            const success = await sendLocation({
              chatId,
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              horizontalAccuracy: locationData.horizontalAccuracy,
              livePeriod: locationData.livePeriod,
              heading: locationData.heading,
              title: locationData.title,
              address: locationData.address,
              replyToMessageId: replyingTo?.id ?? chatDraft?.replyToMessageId,
            });
            return success;
          }}
          onClose={() => setShowLocationDialog(false)}
        />
      )}
      {activeRecording && (
        <VoiceVideoRecorder
          activeKind={activeRecording}
          onClose={() => setActiveRecording(null)}
          onSendRecording={async (file, durationSec, kind) => {
            const outgoingAttachment: OutgoingAttachment = {
              file,
              kind,
              duration: durationSec,
              width: kind === "videoNote" ? 480 : undefined,
              height: kind === "videoNote" ? 480 : undefined,
            };
            return onSendFiles(
              [outgoingAttachment],
              undefined,
              undefined,
              replyingTo?.id ?? chatDraft?.replyToMessageId,
              activeReplyQuote,
              disableNotification,
            );
          }}
        />
      )}
      {editingAttachment && editingAttachment.previewUrl && (
        <MediaEditorModal
          attachment={editingAttachment.attachment}
          previewUrl={editingAttachment.previewUrl}
          onClose={() => setEditingAttachment(null)}
          onSave={(result) => {
            updateEditedPendingAttachment(editingAttachment.id, result);
            setEditingAttachment(null);
          }}
        />
      )}
      {archiveModalOpen && (
        <ArchiveDropModal
          isOpen={archiveModalOpen}
          files={archiveDropFiles}
          defaultArchiveName={archiveDropDefaultName}
          hasDirectory={archiveDropHasDirectory}
          onClose={() => setArchiveModalOpen(false)}
          onSendArchive={(archiveFile) => {
            updateAttachmentOptions({ mode: "file" });
            addPendingAttachments([archiveFile]);
          }}
          onSendSeparateFiles={(rawFiles) => {
            addPendingAttachments(rawFiles);
          }}
        />
      )}
      {draggingFiles && (
        <div className="composer-file-drop-overlay" role="status">
          <Paperclip size={24} />
          <strong>Drop files or folders to send</strong>
        </div>
      )}
    </div>
  );
});
