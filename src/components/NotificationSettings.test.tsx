import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NotificationSettings } from "./NotificationSettings";
import type { AppPreferences } from "../store/preferencesStore";

describe("FG-023 NotificationSettings Component", () => {
  const basePreferences: AppPreferences = {
    shortcuts: {} as any,
    language: "en",
    notificationsEnabled: true,
    notificationSound: true,
    notificationPreview: true,
    notificationPreviewMode: "full",
    notifyPrivateChats: true,
    notifyGroups: true,
    notifyChannels: true,
    notifyMentions: true,
    notifyReactions: true,
    suppressActiveConversation: true,
    flashWindowOnNotification: true,
    respectFocusMode: true,
    deletedMessageArchiveEnabled: true,
    antiEditEnabled: true,
    bypassProtectedContent: true,
    osintInspectorEnabled: true,
    sendOnEnter: true,
    blockTypingStatus: true,
    ghostMode: false,
    blockZalgoText: true,
    adBlockingEnabled: true,
    blockSponsoredMessages: true,
    customAdBlockingEnabled: false,
    adBlockKeywords: [],
    adBlockRegexRules: [],
    developerMode: false,
    performanceMonitoringEnabled: true,
    autoplayAnimations: true,
    autoDownloadImages: true,
    autoDownloadVideos: false,
    autoDownloadAudio: false,
    autoDownloadFiles: false,
    autoDownloadLimitMb: 10,
    cacheRetentionDays: 30,
    reduceMotion: false,
    chatFontSize: 14,
    quoteCollapseLines: 10,
    interfaceScale: 100,
    chatListRowHeight: 68,
    messageGroupSpacing: 4,
    messageRowSpacing: 1,
    messageBubblePadding: 4,
    unreadBadgePosition: "right",
    themeId: "fardgram-dark",
    backgroundStyle: "plain",
    wallpaperId: "default",
    wallpaperBlur: 0,
    wallpaperOpacity: 100,
    wallpaperCustomUrl: null,
    fontId: "system",
  };

  it("renders all sections, category controls, and preview privacy levels in English", () => {
    const html = renderToStaticMarkup(
      <NotificationSettings
        preferences={basePreferences}
        onChange={vi.fn()}
      />
    );

    // Section headers
    expect(html).toContain("Desktop Notifications");
    expect(html).toContain("Message Preview &amp; Privacy");
    expect(html).toContain("Notification Categories");
    expect(html).toContain("Exceptions &amp; Focus");

    // Controls
    expect(html).toContain("Enable Notifications");
    expect(html).toContain("Play Alert Sound");
    expect(html).toContain("Flash Taskbar Icon");
    expect(html).toContain("Name and Message");
    expect(html).toContain("Name Only");
    expect(html).toContain("No Preview");
    expect(html).toContain("View-once photos, self-destructing messages, and protected content chats are automatically redacted");

    // Categories
    expect(html).toContain("Private Chats");
    expect(html).toContain("Groups");
    expect(html).toContain("Channels");

    // Exceptions
    expect(html).toContain("Notify on @Mentions &amp; Replies");
    expect(html).toContain("Notify on Reactions");
    expect(html).toContain("Suppress in Active Conversation");
    expect(html).toContain("Respect OS Focus Assist / Do Not Disturb");
  });

  it("disables sub-options when notificationsEnabled is false", () => {
    const html = renderToStaticMarkup(
      <NotificationSettings
        preferences={{ ...basePreferences, notificationsEnabled: false }}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain("opacity-50 pointer-events-none");
  });
});
