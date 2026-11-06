import { currentLanguage, translate } from "../i18n";
import {
  Check,
  ClipboardList,
  Copy,
  Link,
  LoaderCircle,
  Search,
  Shield,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Chat,
  ChatAdminRightKey,
  ChatAdminRights,
  ChatEvent,
  ChatInviteLink,
  ChatInviteLinkPage,
  ChatJoinRequest,
  ChatJoinRequestPage,
  ChatManagement,
  ChatManagementCapabilities,
  ChatMemberStatusInput,
  ChatPermissions,
  CreateChatInviteLinkInput,
  ManagedChatMember,
  User,
} from "../telegram/types";
import {
  CHAT_ADMIN_RIGHT_LABELS,
  CHAT_PERMISSION_LABELS,
  DEFAULT_CHAT_ADMIN_RIGHTS,
  DEFAULT_CHAT_PERMISSIONS,
} from "../telegram/chatManagement";
import { useModalFocus } from "../hooks/useModalFocus";
import { useStableVisibility } from "../hooks/useStableVisibility";
import { Avatar } from "./Avatar";

interface ChatManagementDialogProps {
  chat: Chat;
  currentUserId?: string;
  contacts: User[];
  management?: ChatManagement;
  loading: boolean;
  error?: string;
  onLoad: (offset?: number) => Promise<ChatManagement | undefined>;
  onClose: () => void;
  onAddMembers: (userIds: string[]) => Promise<boolean>;
  onSetMemberStatus: (userId: string, status: ChatMemberStatusInput) => Promise<boolean>;
  onSetMemberTag: (userId: string, tag: string) => Promise<boolean>;
  onSetPermissions: (permissions: ChatPermissions) => Promise<boolean>;
  onSetSlowMode: (seconds: number) => Promise<boolean>;
  onTransferOwnership: (userId: string, password: string) => Promise<boolean>;
  onLoadEvents: (fromEventId?: string) => Promise<{ events: ChatEvent[]; nextEventId?: string; hasMore: boolean } | undefined>;
  onGetInviteLinks: (offsetDate?: number, offsetLink?: string) => Promise<ChatInviteLinkPage | undefined>;
  onSaveInviteLink: (input: Omit<CreateChatInviteLinkInput, "chatId">, inviteLink?: string) => Promise<ChatInviteLink | undefined>;
  onRevokeInviteLink: (inviteLink: string) => Promise<boolean>;
  onGetJoinRequests: (inviteLink?: string, offsetUserId?: string, offsetDate?: number) => Promise<ChatJoinRequestPage | undefined>;
  onProcessJoinRequest: (userId: string, approve: boolean) => Promise<boolean>;
  onProcessJoinRequests: (inviteLink: string | undefined, approve: boolean) => Promise<boolean>;
}

type Tab = "members" | "permissions" | "invites" | "audit";

interface JoinRequestBucket extends ChatJoinRequestPage {
  inviteLink?: string;
}

const roleLabel = (member: ManagedChatMember) => {
  if (member.status === "owner") return member.customTitle || translate("Owner");
  if (member.status === "administrator") return member.customTitle || translate("Admin");
  if (member.customTitle) return member.customTitle;
  if (member.status === "restricted") return translate("Restricted");
  if (member.status === "banned") return translate("Banned");
  if (member.status === "left") return translate("Left");
  return translate("Member");
};

const formatSlowMode = (seconds: number) => seconds === 0
  ? translate("Off")
  : seconds >= 60 ? translate("{{value0}} min", { value0: Math.round(seconds / 60) }) : translate("{{value0}} sec", { value0: seconds });

const ownershipTransferMessage = (management?: ChatManagement) => {
  const transfer = management?.ownershipTransfer;
  if (!transfer || transfer.available) return undefined;
  const wait = transfer.retryAfter ? translate(", retry in ~{{value0}} hours", { value0: Math.ceil(transfer.retryAfter / 3600) }) : "";
  if (transfer.reason === "passwordNeeded") return translate("Two-step verification must be enabled for your Telegram account");
  if (transfer.reason === "passwordTooFresh") return translate("Two-step verification was enabled too recently{{value0}}", { value0: wait });
  if (transfer.reason === "sessionTooFresh") return translate("This login session was created too recently{{value0}}", { value0: wait });
  return translate("Ownership cannot be transferred at this time");
};

const visibleAdminRights = (chat: Chat, capabilities: ChatManagementCapabilities) =>
  (Object.keys(CHAT_ADMIN_RIGHT_LABELS) as ChatAdminRightKey[]).filter((key) => {
    if (["canPostMessages", "canEditMessages", "canManageDirectMessages"].includes(key)) {
      return capabilities.chatType === "channel";
    }
    if (key === "canPinMessages" || key === "canManageTags") return capabilities.chatType !== "channel";
    if (key === "canManageTopics") return capabilities.chatType === "supergroup" && chat.isForum === true;
    if (key === "canPromoteMembers") return capabilities.chatType !== "basicGroup";
    if (key === "isAnonymous") return capabilities.chatType === "supergroup";
    if (["canManageChat", "canPostStories", "canEditStories", "canDeleteStories"].includes(key)) {
      return capabilities.chatType !== "basicGroup";
    }
    return true;
  });

const promotionRights = (capabilities: ChatManagementCapabilities): ChatAdminRights => {
  const base = capabilities.status === "administrator" && capabilities.adminRights
    ? capabilities.adminRights
    : DEFAULT_CHAT_ADMIN_RIGHTS;
  return {
    ...base,
    canPromoteMembers: false,
    isAnonymous: false,
  };
};

const deduplicateRequests = (buckets: JoinRequestBucket[]) => [
  ...new Map(buckets.flatMap((bucket) => bucket.requests).map((request) => [request.user.id, request])).values(),
];

export function ChatManagementDialog({
  chat,
  currentUserId,
  contacts,
  management,
  loading,
  error,
  onLoad,
  onClose,
  onAddMembers,
  onSetMemberStatus,
  onSetMemberTag,
  onSetPermissions,
  onSetSlowMode,
  onTransferOwnership,
  onLoadEvents,
  onGetInviteLinks,
  onSaveInviteLink,
  onRevokeInviteLink,
  onGetJoinRequests,
  onProcessJoinRequest,
  onProcessJoinRequests,
}: ChatManagementDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useModalFocus<HTMLElement>(onClose, false, closeRef);
  const showLoading = useStableVisibility(loading && !management);
  const capabilities = management?.capabilities ?? chat.management;
  const [tab, setTab] = useState<Tab>("members");
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [nextEventId, setNextEventId] = useState<string>();
  const [hasMoreEvents, setHasMoreEvents] = useState(false);
  const [transferUserId, setTransferUserId] = useState("");
  const [transferPassword, setTransferPassword] = useState("");
  const [localPermissions, setLocalPermissions] = useState<ChatPermissions>(management?.permissions ?? DEFAULT_CHAT_PERMISSIONS);
  const [inviteLinks, setInviteLinks] = useState<ChatInviteLink[]>([]);
  const [inviteHasMore, setInviteHasMore] = useState(false);
  const [nextInviteDate, setNextInviteDate] = useState<number>();
  const [nextInviteLink, setNextInviteLink] = useState<string>();
  const [joinRequestBuckets, setJoinRequestBuckets] = useState<JoinRequestBucket[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteExpiry, setInviteExpiry] = useState("");
  const [inviteLimit, setInviteLimit] = useState(0);
  const [inviteApproval, setInviteApproval] = useState(false);
  const [subscriptionStars, setSubscriptionStars] = useState(0);
  const [editingInviteLink, setEditingInviteLink] = useState<string>();
  const [memberTagDrafts, setMemberTagDrafts] = useState<Record<string, string>>({});

  useEffect(() => { void onLoad(); }, [onLoad]);
  useEffect(() => { if (management) setLocalPermissions(management.permissions); }, [management]);
  useEffect(() => {
    if (!management) return;
    setMemberTagDrafts(Object.fromEntries(
      management.members.map((member) => [member.user.id, member.customTitle ?? ""]),
    ));
  }, [management]);
  useEffect(() => {
    if (!capabilities?.canOpenManagement) onClose();
  }, [capabilities?.canOpenManagement, onClose]);
  useEffect(() => {
    if (tab !== "audit" || !capabilities?.canViewEventLog) return;
    let cancelled = false;
    void onLoadEvents().then((page) => {
      if (!cancelled && page) {
        setEvents(page.events);
        setNextEventId(page.nextEventId);
        setHasMoreEvents(page.hasMore);
      }
    });
    return () => { cancelled = true; };
  }, [capabilities?.canViewEventLog, onLoadEvents, tab]);
  useEffect(() => {
    if (tab !== "invites" || !capabilities?.canManageInvites) return;
    let cancelled = false;
    void onGetInviteLinks().then(async (links) => {
      if (cancelled || !links) return;
      setInviteLinks(links.links);
      setInviteHasMore(links.hasMore);
      setNextInviteDate(links.nextOffsetDate);
      setNextInviteLink(links.nextOffsetLink);
      const requestLinks = capabilities.canManageAllInvites
        ? [undefined]
        : links.links.map((link) => link.inviteLink);
      const pages = await Promise.all(requestLinks.map(async (inviteLink) => {
        const page = await onGetJoinRequests(inviteLink);
        return page ? { ...page, inviteLink } : undefined;
      }));
      if (!cancelled) setJoinRequestBuckets(pages.flatMap((page) => page ? [page] : []));
    });
    return () => { cancelled = true; };
  }, [capabilities?.canManageAllInvites, capabilities?.canManageInvites, onGetInviteLinks, onGetJoinRequests, tab]);

  const members = management?.members ?? [];
  const filteredMembers = useMemo(() => {
    const normalized = memberQuery.trim().toLocaleLowerCase();
    if (!normalized) return members;
    return members.filter((member) =>
      member.user.displayName.toLocaleLowerCase().includes(normalized) ||
      (member.user.username && member.user.username.toLocaleLowerCase().includes(normalized)) ||
      (member.customTitle && member.customTitle.toLocaleLowerCase().includes(normalized)),
    );
  }, [members, memberQuery]);
  const taggableMembers = members.filter(
    (member) => member.user.id !== currentUserId && member.status !== "left" && member.status !== "banned",
  );
  const joinRequests = useMemo(() => deduplicateRequests(joinRequestBuckets), [joinRequestBuckets]);
  const visibleContacts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return contacts
      .filter((user) => !members.some((member) => member.user.id === user.id && member.status !== "left" && member.status !== "banned"))
      .filter((user) => !normalized || `${user.displayName} ${user.username ?? ""}`.toLocaleLowerCase().includes(normalized));
  }, [contacts, members, query]);
  const adminRightKeys = useMemo(
    () => capabilities ? visibleAdminRights(chat, capabilities) : [],
    [capabilities, chat],
  );

  const canChangeMemberTo = (member: ManagedChatMember, action: "administrator" | "restricted" | "banned" | "member") => {
    if (!capabilities || member.status === "owner" || member.user.id === currentUserId) return false;
    if (member.status === "administrator" && member.canBeEdited === false) return false;
    if (action === "administrator") return capabilities.canPromoteMembers;
    if (action === "restricted" || action === "banned") {
      return capabilities.canRestrictMembers && (member.status !== "administrator" || capabilities.canPromoteMembers);
    }
    if (member.status === "administrator") return capabilities.canPromoteMembers;
    if (member.status === "restricted" || member.status === "banned") return capabilities.canRestrictMembers;
    if (member.status === "left") return capabilities.canAddMembers;
    return true;
  };

  const togglePermission = (key: keyof ChatPermissions) => {
    setLocalPermissions((current) => ({ ...current, [key]: !current[key] }));
  };
  const savePermissions = async () => {
    if (!capabilities?.canManagePermissions) return;
    setSaving(true);
    await onSetPermissions(localPermissions);
    setSaving(false);
  };
  const addSelected = async () => {
    if (!capabilities?.canAddMembers || selected.length === 0) return;
    setSaving(true);
    if (await onAddMembers(selected)) {
      setSelected([]);
      setQuery("");
    }
    setSaving(false);
  };
  const setMemberStatus = async (userId: string, status: ChatMemberStatusInput) => {
    setSaving(true);
    const updated = await onSetMemberStatus(userId, status);
    setSaving(false);
    return updated;
  };
  const updateMember = async (member: ManagedChatMember, action: "administrator" | "restricted" | "banned" | "member") => {
    if (!canChangeMemberTo(member, action)) return;
    if (action === "administrator") {
      await setMemberStatus(member.user.id, {
        kind: "administrator",
        rights: member.adminRights ?? promotionRights(capabilities!),
      });
    } else if (action === "restricted") {
      await setMemberStatus(member.user.id, {
        kind: "restricted",
        permissions: member.permissions ?? { ...DEFAULT_CHAT_PERMISSIONS, canSendBasicMessages: false },
      });
    } else if (action === "banned") {
      await setMemberStatus(member.user.id, { kind: "banned" });
    } else {
      await setMemberStatus(member.user.id, { kind: "member" });
    }
  };
  const updateAdministrator = async (
    member: ManagedChatMember,
    rights: ChatAdminRights = member.adminRights ?? DEFAULT_CHAT_ADMIN_RIGHTS,
  ) => {
    if (!capabilities?.canPromoteMembers || member.canBeEdited === false) return;
    await setMemberStatus(member.user.id, {
      kind: "administrator",
      rights,
    });
  };
  const updateMemberTag = async (member: ManagedChatMember) => {
    if (!capabilities?.canManageTags || member.user.id === currentUserId) return;
    setSaving(true);
    await onSetMemberTag(member.user.id, memberTagDrafts[member.user.id] ?? "");
    setSaving(false);
  };
  const transfer = async () => {
    if (!capabilities?.canTransferOwnership || !transferUserId || !transferPassword.trim()) return;
    setSaving(true);
    if (await onTransferOwnership(transferUserId, transferPassword)) {
      setTransferUserId("");
      setTransferPassword("");
    }
    setSaving(false);
  };
  const loadMoreEvents = async () => {
    if (!nextEventId || !capabilities?.canViewEventLog) return;
    const page = await onLoadEvents(nextEventId);
    if (page) {
      setEvents((current) => [...current, ...page.events.filter((event) => !current.some((item) => item.id === event.id))]);
      setNextEventId(page.nextEventId);
      setHasMoreEvents(page.hasMore);
    }
  };
  const loadMoreInvites = async () => {
    if (!inviteHasMore || !nextInviteLink || !capabilities?.canManageInvites) return;
    const page = await onGetInviteLinks(nextInviteDate, nextInviteLink);
    if (!page) return;
    setInviteLinks((current) => [...current, ...page.links.filter((link) => !current.some((item) => item.inviteLink === link.inviteLink))]);
    setInviteHasMore(page.hasMore);
    setNextInviteDate(page.nextOffsetDate);
    setNextInviteLink(page.nextOffsetLink);
    if (!capabilities.canManageAllInvites && page.links.length > 0) {
      const pages = await Promise.all(page.links.map(async (link) => {
        const requests = await onGetJoinRequests(link.inviteLink);
        return requests ? { ...requests, inviteLink: link.inviteLink } : undefined;
      }));
      setJoinRequestBuckets((current) => [
        ...current,
        ...pages.flatMap((requests) => requests && !current.some((bucket) => bucket.inviteLink === requests.inviteLink)
          ? [requests]
          : []),
      ]);
    }
  };
  const loadMoreRequests = async () => {
    const pendingBuckets = joinRequestBuckets.filter((bucket) => bucket.hasMore && bucket.nextOffsetUserId);
    const pages = await Promise.all(pendingBuckets.map(async (bucket) => {
      const page = await onGetJoinRequests(bucket.inviteLink, bucket.nextOffsetUserId, bucket.nextOffsetDate);
      return page ? { ...page, inviteLink: bucket.inviteLink } : undefined;
    }));
    setJoinRequestBuckets((current) => current.map((bucket) => {
      const page = pages.find((item) => item?.inviteLink === bucket.inviteLink);
      if (!page) return bucket;
      return {
        ...page,
        requests: [...bucket.requests, ...page.requests.filter((request) => !bucket.requests.some((item) => item.user.id === request.user.id))],
      };
    }));
  };
  const resetInviteForm = () => {
    setInviteName("");
    setInviteExpiry("");
    setInviteLimit(0);
    setInviteApproval(false);
    setSubscriptionStars(0);
    setEditingInviteLink(undefined);
  };
  const saveInvite = async () => {
    if (!capabilities?.canManageInvites) return;
    setSaving(true);
    const saved = await onSaveInviteLink({
      name: inviteName,
      expirationDate: subscriptionStars > 0 || !inviteExpiry ? undefined : Math.floor(new Date(inviteExpiry).getTime() / 1000),
      memberLimit: subscriptionStars > 0 || inviteApproval ? 0 : inviteLimit,
      createsJoinRequest: subscriptionStars === 0 && inviteApproval,
      subscriptionStars: subscriptionStars || undefined,
    }, editingInviteLink);
    if (saved) {
      const page = await onGetInviteLinks();
      if (page) {
        setInviteLinks(page.links);
        setInviteHasMore(page.hasMore);
        setNextInviteDate(page.nextOffsetDate);
        setNextInviteLink(page.nextOffsetLink);
      }
      resetInviteForm();
    }
    setSaving(false);
  };
  const editInvite = (link: ChatInviteLink) => {
    setEditingInviteLink(link.inviteLink);
    setInviteName(link.name);
    setInviteExpiry(link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "");
    setInviteLimit(link.memberLimit);
    setInviteApproval(link.createsJoinRequest);
    setSubscriptionStars(link.subscriptionStars ?? 0);
  };
  const revokeInvite = async (inviteLink: string) => {
    if (!capabilities?.canManageInvites) return;
    setSaving(true);
    if (await onRevokeInviteLink(inviteLink)) {
      setInviteLinks((current) => current.filter((link) => link.inviteLink !== inviteLink));
    }
    setSaving(false);
  };
  const processRequest = async (userId: string, approve: boolean) => {
    if (!capabilities?.canManageInvites) return;
    setSaving(true);
    if (await onProcessJoinRequest(userId, approve)) {
      setJoinRequestBuckets((current) => current.map((bucket) => ({
        ...bucket,
        requests: bucket.requests.filter((request) => request.user.id !== userId),
        totalCount: Math.max(0, bucket.totalCount - 1),
      })));
    }
    setSaving(false);
  };
  const processRequests = async (approve: boolean) => {
    if (!capabilities?.canManageInvites) return;
    setSaving(true);
    const targets = capabilities.canManageAllInvites
      ? [undefined]
      : [...new Set(joinRequestBuckets.map((bucket) => bucket.inviteLink).filter((value): value is string => Boolean(value)))];
    const results = await Promise.all(targets.map((inviteLink) => onProcessJoinRequests(inviteLink, approve)));
    if (results.every(Boolean)) setJoinRequestBuckets([]);
    setSaving(false);
  };

  const permissionTabVisible = Boolean(capabilities && (
    capabilities.canManagePermissions || capabilities.canManageSlowMode ||
    capabilities.canRestrictMembers || capabilities.canPromoteMembers
  ));
  const transferUnavailable = capabilities?.status === "owner" ? ownershipTransferMessage(management) : undefined;

  return (
    <div className="profile-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="chat-management-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-management-title" tabIndex={-1}>
        <header className="settings-dialog-header">
          <div><h2 id="chat-management-title">{translate("Manage \"{{value0}}\"", { value0: chat.title })}</h2><small>{translate("Members, permissions and recent actions")}</small></div>
          <button ref={closeRef} className="icon-button" type="button" aria-label={translate("Close management dialog")} onClick={onClose}><X size={19} /></button>
        </header>
        <nav className="chat-management-tabs" aria-label={translate("Management categories")}>
          <button type="button" className={tab === "members" ? "is-active" : ""} onClick={() => setTab("members")}><UsersRound size={16} />{translate("Members")}</button>
          {permissionTabVisible && <button type="button" className={tab === "permissions" ? "is-active" : ""} onClick={() => setTab("permissions")}><Shield size={16} />{translate("Permissions")}</button>}
          {capabilities?.canManageInvites && <button type="button" className={tab === "invites" ? "is-active" : ""} onClick={() => setTab("invites")}><Link size={16} />{translate("Invites")}</button>}
          {capabilities?.canViewEventLog && <button type="button" className={tab === "audit" ? "is-active" : ""} onClick={() => setTab("audit")}><ClipboardList size={16} />{translate("Recent Actions")}</button>}
        </nav>
        <div className="chat-management-body">
          {showLoading ? <div className="profile-state"><LoaderCircle className="spin" size={22} /></div> : error && !management ? <div className="profile-state is-error" role="alert">{error}<button className="dialog-secondary" type="button" onClick={() => void onLoad()}><LoaderCircle size={15} />{translate("Retry")}</button></div> : (
            <>
              {tab === "members" && (
                <>
                  {capabilities?.canAddMembers && <section className="management-section">
                    <div className="management-section-heading"><h3>{translate("Add Members")}</h3><span>{selected.length ? translate("{{value0}} selected", { value0: selected.length }) : translate("Select from contacts")}</span></div>
                    <label className="new-chat-search"><Search size={15} /><input aria-label={translate("Search contacts")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={translate("Search contacts...")} /></label>
                    <div className="management-contact-list">
                      {visibleContacts.slice(0, 20).map((user) => <label className="management-contact-row" key={user.id}><input type="checkbox" checked={selected.includes(user.id)} onChange={() => setSelected((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} /><Avatar avatar={user.avatar} size="small" /><span><strong>{user.displayName}</strong><small>{user.username ? `@${user.username}` : translate("Contact")}</small></span></label>)}
                      {visibleContacts.length === 0 && <p className="management-empty">{translate("No contacts available to add")}</p>}
                    </div>
                    <button className="dialog-primary" type="button" disabled={saving || selected.length === 0} onClick={() => void addSelected()}><UserPlus size={15} />{translate("Add Members")}</button>
                  </section>}
                  <section className="management-section">
                    <div className="management-section-heading"><h3>{translate("Members & Roles")}</h3><span>{translate("{{value0}} members", { value0: management?.memberCount ?? members.length })}</span></div>
                    {members.length > 5 && (
                      <label className="new-chat-search" style={{ marginBottom: 12 }}>
                        <Search size={15} />
                        <input
                          aria-label={translate("Search members")}
                          value={memberQuery}
                          onChange={(event) => setMemberQuery(event.target.value)}
                          placeholder={translate("Search members...")}
                        />
                      </label>
                    )}
                    <div className="management-member-list">
                      {filteredMembers.map((member) => {
                        const canChangeAny = (["member", "administrator", "restricted", "banned"] as const).some((action) => canChangeMemberTo(member, action));
                        const canKick = canChangeMemberTo(member, "banned");
                        return <div className="management-member-row" key={member.user.id}>
                          <Avatar avatar={member.user.avatar} size="small" />
                          <span className="management-member-identity"><strong>{member.user.displayName}{member.user.id === currentUserId ? translate(" (You)") : ""}</strong><small>{roleLabel(member)}{member.untilDate ? translate(" · Until {{value0}}", { value0: new Date(member.untilDate * 1000).toLocaleDateString(currentLanguage()) }) : ""}</small></span>
                          <div className="management-inline-actions">
                            {canChangeAny && <select aria-label={translate("Set role for {{value0}}", { value0: member.user.displayName })} value={member.status === "left" ? "member" : member.status} disabled={saving} onChange={(event) => void updateMember(member, event.target.value as "administrator" | "restricted" | "banned" | "member")}>
                              <option value="member" disabled={!canChangeMemberTo(member, "member")}>{translate("Member")}</option>
                              <option value="administrator" disabled={!canChangeMemberTo(member, "administrator")}>{translate("Administrator")}</option>
                              <option value="restricted" disabled={!canChangeMemberTo(member, "restricted")}>{translate("Restricted")}</option>
                              <option value="banned" disabled={!canChangeMemberTo(member, "banned")}>{translate("Banned")}</option>
                            </select>}
                            {canKick && member.status !== "banned" && member.status !== "left" && (
                              <button
                                className="icon-button"
                                type="button"
                                title={translate("Remove member")}
                                aria-label={translate("Remove {{value0}}", { value0: member.user.displayName })}
                                disabled={saving}
                                onClick={() => void updateMember(member, "banned")}
                              >
                                <UserMinus size={15} />
                              </button>
                            )}
                          </div>
                        </div>;
                      })}
                      {filteredMembers.length === 0 && memberQuery.trim() && (
                        <p className="management-empty">{translate("No members match your search")}</p>
                      )}
                    </div>
                    {management?.memberHasMore && <button className="dialog-secondary" type="button" disabled={loading} onClick={() => void onLoad((management.memberOffset ?? 0) + members.length)}>{translate("Load more members")}</button>}
                  </section>
                  {capabilities?.canManageTags && taggableMembers.length > 0 && <section className="management-section">
                    <div className="management-section-heading"><h3>{translate("Member Tags")}</h3><span>{translate("{{value0}} members", { value0: taggableMembers.length })}</span></div>
                    {taggableMembers.map((member) => <div className="management-exception-editor" key={member.user.id}><div className="management-exception-row"><Avatar avatar={member.user.avatar} size="small" /><span>{member.user.displayName}</span><small>{roleLabel(member)}</small></div><div className="management-admin-title"><label><span>{translate("Tag")}</span><input aria-label={translate("Set member tag for {{value0}}", { value0: member.user.displayName })} value={memberTagDrafts[member.user.id] ?? member.customTitle ?? ""} maxLength={16} disabled={saving} onChange={(event) => setMemberTagDrafts((current) => ({ ...current, [member.user.id]: event.target.value }))} /></label><button className="dialog-secondary" type="button" disabled={saving || (memberTagDrafts[member.user.id] ?? "") === (member.customTitle ?? "")} onClick={() => void updateMemberTag(member)}>{translate("Save Tag")}</button></div></div>)}
                  </section>}
                  {capabilities?.status === "owner" && <section className="management-section">
                    <div className="management-section-heading"><h3>{translate("Transfer Ownership")}</h3><span>{transferUnavailable ?? translate("Requires two-step verification password")}</span></div>
                    {capabilities.canTransferOwnership ? <>
                      <select aria-label={translate("Select new owner")} value={transferUserId} onChange={(event) => setTransferUserId(event.target.value)}><option value="">{translate("Select member")}</option>{members.filter((member) => member.status === "member" || member.status === "administrator").map((member) => <option key={member.user.id} value={member.user.id}>{member.user.displayName}</option>)}</select>
                      <input aria-label={translate("Two-step verification password")} type="password" value={transferPassword} onChange={(event) => setTransferPassword(event.target.value)} placeholder={translate("Two-step verification password")} />
                      <button className="dialog-danger" type="button" disabled={saving || !transferUserId || !transferPassword.trim()} onClick={() => void transfer()}>{translate("Transfer Ownership")}</button>
                    </> : <p className="management-empty">{transferUnavailable}</p>}
                  </section>}
                </>
              )}
              {tab === "permissions" && permissionTabVisible && <>
                {capabilities?.canManagePermissions && <section className="management-section"><div className="management-section-heading"><h3>{translate("Default Permissions")}</h3><span>{translate("Applies to all regular members")}</span></div><div className="management-permission-grid">{(Object.keys(CHAT_PERMISSION_LABELS) as (keyof ChatPermissions)[]).map((key) => <label key={key}><input type="checkbox" checked={localPermissions[key]} disabled={saving} onChange={() => togglePermission(key)} /><span>{CHAT_PERMISSION_LABELS[key]}</span></label>)}</div><button className="dialog-primary" type="button" disabled={saving} onClick={() => void savePermissions()}>{translate("Save Default Permissions")}</button></section>}
                {capabilities?.canManageSlowMode && <section className="management-section"><div className="management-section-heading"><h3>{translate("Slow Mode")}</h3><span>{formatSlowMode(management?.slowModeDelay ?? 0)}</span></div><select aria-label={translate("Slow mode delay")} disabled={saving} value={management?.slowModeDelay ?? 0} onChange={async (event) => { setSaving(true); await onSetSlowMode(Number(event.target.value)); setSaving(false); }}><option value={0}>{translate("Off")}</option><option value={5}>{translate("5 seconds")}</option><option value={10}>{translate("10 seconds")}</option><option value={30}>{translate("30 seconds")}</option><option value={60}>{translate("1 minute")}</option><option value={300}>{translate("5 minutes")}</option><option value={900}>{translate("15 minutes")}</option><option value={3600}>{translate("1 hour")}</option></select></section>}
                {capabilities?.canRestrictMembers && members.some((member) => member.status === "restricted") && <section className="management-section"><div className="management-section-heading"><h3>{translate("Exceptions & Restrictions")}</h3><span>{translate("Custom rights per restricted member")}</span></div>{members.filter((member) => member.status === "restricted").map((member) => <div className="management-exception-editor" key={member.user.id}><div className="management-exception-row"><Avatar avatar={member.user.avatar} size="small" /><span>{member.user.displayName}</span><small>{translate("{{value0}} allowed", { value0: Object.values(member.permissions ?? {}).filter(Boolean).length })}</small></div><div className="management-permission-grid">{(Object.keys(CHAT_PERMISSION_LABELS) as (keyof ChatPermissions)[]).map((key) => <label key={key}><input type="checkbox" checked={(member.permissions ?? DEFAULT_CHAT_PERMISSIONS)[key]} disabled={saving} onChange={() => void setMemberStatus(member.user.id, { kind: "restricted", permissions: { ...(member.permissions ?? DEFAULT_CHAT_PERMISSIONS), [key]: !(member.permissions ?? DEFAULT_CHAT_PERMISSIONS)[key] } })} /><span>{CHAT_PERMISSION_LABELS[key]}</span></label>)}</div></div>)}</section>}
                {capabilities?.canPromoteMembers && members.some((member) => member.status === "administrator" && member.canBeEdited !== false) && <section className="management-section"><div className="management-section-heading"><h3>{translate("Administrator Permissions")}</h3><span>{translate("Can only grant rights you possess")}</span></div>{members.filter((member) => member.status === "administrator" && member.canBeEdited !== false && member.user.id !== currentUserId).map((member) => <div className="management-exception-editor" key={member.user.id}><div className="management-exception-row"><Avatar avatar={member.user.avatar} size="small" /><span>{member.user.displayName}</span><small>{member.customTitle || translate("Administrator")}</small></div><div className="management-permission-grid">{adminRightKeys.map((key) => {
                  const actorCanGrant = capabilities.status === "owner" || capabilities.adminRights?.[key] === true;
                  return <label key={key}><input type="checkbox" checked={(member.adminRights ?? DEFAULT_CHAT_ADMIN_RIGHTS)[key]} disabled={saving || !actorCanGrant} onChange={() => void updateAdministrator(member, { ...(member.adminRights ?? DEFAULT_CHAT_ADMIN_RIGHTS), [key]: !(member.adminRights ?? DEFAULT_CHAT_ADMIN_RIGHTS)[key] })} /><span>{CHAT_ADMIN_RIGHT_LABELS[key]}</span></label>;
                })}</div></div>)}</section>}
              </>}
              {tab === "invites" && capabilities?.canManageInvites && <>
                <section className="management-section"><div className="management-section-heading"><h3>{editingInviteLink ? translate("Edit Invite Link") : translate("Create Invite Link")}</h3><span>{translate("Configure expiration, usage limit, or Stars subscription")}</span></div><div className="invite-form-grid"><label><span>{translate("Name")}</span><input aria-label={translate("Invite link name")} value={inviteName} onChange={(event) => setInviteName(event.target.value)} maxLength={32} placeholder={translate("e.g. Announcements")} /></label><label><span>{translate("Expire Date")}</span><input aria-label={translate("Invite link expiration")} type="datetime-local" value={inviteExpiry} onChange={(event) => setInviteExpiry(event.target.value)} disabled={subscriptionStars > 0} /></label><label><span>{translate("Member Limit")}</span><input aria-label={translate("Invite link member limit")} type="number" min={0} max={99999} value={inviteLimit} onChange={(event) => setInviteLimit(Math.max(0, Number(event.target.value)))} disabled={subscriptionStars > 0 || inviteApproval} /></label><label><span>{translate("Monthly Stars")}</span><input aria-label={translate("Subscription Stars")} type="number" min={0} max={1000000000} value={subscriptionStars} onChange={(event) => { const value = Math.max(0, Number(event.target.value)); setSubscriptionStars(value); if (value > 0) setInviteApproval(false); }} disabled={Boolean(editingInviteLink && !subscriptionStars) || chat.kind !== "channel"} /></label></div><label className="management-check"><input type="checkbox" checked={inviteApproval} disabled={subscriptionStars > 0} onChange={(event) => { setInviteApproval(event.target.checked); if (event.target.checked) setInviteLimit(0); }} /><span>{translate("Require admin approval to join")}</span></label><div className="management-inline-actions"><button className="dialog-primary" type="button" disabled={saving} onClick={() => void saveInvite()}>{editingInviteLink ? translate("Save Link") : translate("Create Link")}</button>{editingInviteLink && <button className="dialog-secondary" type="button" onClick={resetInviteForm}>{translate("Cancel")}</button>}</div></section>
                <section className="management-section"><div className="management-section-heading"><h3>{translate("Active Invite Links")}</h3><span>{translate("{{value0}} links", { value0: inviteLinks.length })}</span></div><div className="invite-link-list">{inviteLinks.map((link) => <div className="invite-link-row" key={link.inviteLink}><div className="invite-link-main"><strong>{link.name || translate("Invite Link")}{link.isPrimary ? translate(" · Primary Link") : ""}</strong><small>{link.subscriptionStars ? translate("{{value0}} Stars/month", { value0: link.subscriptionStars }) : link.createsJoinRequest ? translate("Requires Approval") : translate("Direct Join")}{link.expiresAt ? translate(" · Expires {{value0}}", { value0: new Date(link.expiresAt).toLocaleDateString(currentLanguage()) }) : ""}</small><code>{link.inviteLink}</code></div><div className="invite-source-stats" aria-label={translate("Member source stats for {{value0}}", { value0: link.name })}><span><strong>{link.memberCount}</strong><small>{translate("Joined")}</small></span><span><strong>{link.pendingJoinRequestCount}</strong><small>{translate("Pending")}</small></span><span><strong>{link.expiredMemberCount}</strong><small>{translate("Expired")}</small></span></div><div className="management-inline-actions"><button className="icon-button" type="button" aria-label={translate("Copy {{value0}}", { value0: link.name })} title={translate("Copy link")} onClick={() => void navigator.clipboard.writeText(link.inviteLink)}><Copy size={15} /></button><button className="dialog-secondary" type="button" disabled={saving} onClick={() => editInvite(link)}>{translate("Edit")}</button><button className="dialog-danger" type="button" disabled={saving} onClick={() => void revokeInvite(link.inviteLink)}>{translate("Revoke")}</button></div></div>)}{inviteLinks.length === 0 && <p className="management-empty">{translate("No active invite links")}</p>}</div>{inviteHasMore && <button className="dialog-secondary" type="button" disabled={saving} onClick={() => void loadMoreInvites()}>{translate("Load more links")}</button>}</section>
                <section className="management-section"><div className="management-section-heading"><h3>{translate("Join Requests")}</h3><span>{translate("{{value0}} pending", { value0: joinRequests.length })}</span></div>{joinRequests.length > 0 && <div className="management-inline-actions"><button className="dialog-primary" type="button" disabled={saving} onClick={() => void processRequests(true)}><Check size={14} />{translate("Approve All")}</button><button className="dialog-danger" type="button" disabled={saving} onClick={() => void processRequests(false)}>{translate("Decline All")}</button></div>}<div className="join-request-list">{joinRequests.map((request) => <div className="join-request-row" key={request.user.id}><Avatar avatar={request.user.avatar} size="small" /><span><strong>{request.user.displayName}</strong><small>{request.bio || new Date(request.date).toLocaleString(currentLanguage())}</small></span><div className="management-inline-actions"><button className="dialog-primary" type="button" aria-label={translate("Approve {{value0}}", { value0: request.user.displayName })} disabled={saving} onClick={() => void processRequest(request.user.id, true)}>{translate("Approve")}</button><button className="dialog-secondary" type="button" aria-label={translate("Decline {{value0}}", { value0: request.user.displayName })} disabled={saving} onClick={() => void processRequest(request.user.id, false)}>{translate("Decline")}</button></div></div>)}{joinRequests.length === 0 && <p className="management-empty">{translate("No pending join requests")}</p>}</div>{joinRequestBuckets.some((bucket) => bucket.hasMore) && <button className="dialog-secondary" type="button" disabled={saving} onClick={() => void loadMoreRequests()}>{translate("Load more requests")}</button>}</section>
              </>}
              {tab === "audit" && capabilities?.canViewEventLog && <section className="management-section"><div className="management-section-heading"><h3>{translate("Recent Actions")}</h3><span>{translate("{{value0}} events", { value0: events.length })}</span></div><div className="management-event-list">{events.map((event) => <div className="management-event-row" key={event.id}><div><strong>{event.summary}</strong><small>{event.actor?.displayName ?? translate("Unknown actor")} · {new Date(event.date).toLocaleString(currentLanguage())}</small></div></div>)}{events.length === 0 && <p className="management-empty">{translate("No recent administrative events")}</p>}</div>{hasMoreEvents && <button className="dialog-secondary" type="button" onClick={() => void loadMoreEvents()}>{translate("Load older events")}</button>}</section>}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
