import { Bell, BellOff, Check, LoaderCircle, LogIn, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { translate } from "../i18n";
import { useTelegramStore } from "../store/telegramStore";
import { chatJoinKey } from "../telegram/chatJoin";
import { canPostToChannel } from "../telegram/chatManagement";
import { connectionPresentation } from "../telegram/connectionState";
import type { Chat } from "../telegram/types";

export const needsMembershipBar = (chat: Chat) =>
  (chat.kind === "group" || chat.kind === "channel") &&
  (chat.isMember !== true || chat.canSendMessages === false ||
    (chat.kind === "channel" && !canPostToChannel(chat)));

export function ChatMembershipBar({ chat }: { chat: Chat }) {
  const joinChat = useTelegramStore(state => state.joinChat);
  const refresh = useTelegramStore(state => state.refreshChatMembership);
  const setMuted = useTelegramStore(state => state.setChatMuted);
  const pendingMute = useTelegramStore(state => state.chatManagementPending.has(chat.id));
  const status = useTelegramStore(state => state.chatJoinStates.get(chatJoinKey({ chatId: chat.id })));
  const online = useTelegramStore(state => connectionPresentation(state.connectionStatus).operational);
  const [refreshing, setRefreshing] = useState(false);
  const refreshMembership = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await refresh(chat.id); } finally { setRefreshing(false); }
  };
  useEffect(() => {
    if (chat.isMember === undefined && online) void refreshMembership();
    // Refresh once when metadata is missing or connectivity returns. A failed
    // refresh leaves a manual retry, rather than a render-driven request loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, online]);

  if (chat.isMember === true && chat.kind === "channel") return (
    <div className="chat-membership-bar">
      <button type="button" role="switch" aria-label={translate("Mute")}
        aria-checked={chat.muted} disabled={pendingMute || !online}
        onClick={() => void setMuted(chat.id, !chat.muted)}>
        {pendingMute ? <LoaderCircle className="spin" size={18} /> : chat.muted ? <BellOff size={18} /> : <Bell size={18} />}
        <span>{chat.muted ? translate("Unmute") : translate("Mute")}</span>
      </button>
    </div>
  );
  if (chat.isBanned || (chat.isMember === true && chat.canSendMessages === false)) return (
    <div className="chat-membership-bar" role="status">
      <span>{chat.isBanned ? translate("You cannot join this chat") : translate("Sending messages is not allowed in this chat")}</span>
    </div>
  );
  const waitingForMetadata = chat.isMember === undefined || status === "joined";
  const requested = status === "requested";
  const joining = status === "joining";
  const label = waitingForMetadata ? translate("Refresh chat status")
    : requested ? translate("Request sent, awaiting admin approval")
      : joining ? translate("Joining...")
        : chat.joinByRequest ? translate("Apply to join")
          : chat.kind === "channel" ? translate("Join Channel") : translate("Join Group");
  return (
    <div className="chat-membership-bar" aria-busy={joining || refreshing}>
      <button type="button" disabled={!online || joining || requested || refreshing}
        onClick={() => waitingForMetadata ? void refreshMembership() : void joinChat({ chatId: chat.id })}>
        {joining || refreshing ? <LoaderCircle className="spin" size={18} />
          : requested ? <Check size={18} /> : waitingForMetadata ? <RefreshCw size={18} /> : <LogIn size={18} />}
        <span>{label}</span>
      </button>
    </div>
  );
}
