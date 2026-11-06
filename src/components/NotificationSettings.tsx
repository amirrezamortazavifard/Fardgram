import React from "react";
import {
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  User,
  Users,
  Megaphone,
  AtSign,
  Heart,
  Monitor,
  Moon,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  usePreferencesStore,
  type AppPreferences,
  type NotificationPreviewMode,
} from "../store/preferencesStore";

export interface NotificationSettingsProps {
  preferences: AppPreferences;
  onChange: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  preferences,
  onChange,
}) => {
  return (
    <div className="space-y-6" data-testid="notification-settings-view">
      {/* Master Toggle & Sound */}
      <section className="settings-section rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4 shadow-sm backdrop-blur-sm">
        <div className="settings-section-heading mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
            <Bell size={18} strokeWidth={2} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Desktop Notifications
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Manage alert banners, sounds, and visual taskbar flashes
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Master Switch */}
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                Enable Notifications
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Show desktop popups when new messages arrive
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notificationsEnabled}
              onChange={(e) => onChange("notificationsEnabled", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>

          {/* Sound Switch */}
          <label className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${!preferences.notificationsEnabled ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                Play Alert Sound
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Play acoustic tone when notifications arrive
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notificationSound}
              disabled={!preferences.notificationsEnabled}
              onChange={(e) => onChange("notificationSound", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>

          {/* Flash Taskbar */}
          <label className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${!preferences.notificationsEnabled ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                Flash Taskbar Icon
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Flash the application taskbar button until the window is focused
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.flashWindowOnNotification}
              disabled={!preferences.notificationsEnabled}
              onChange={(e) => onChange("flashWindowOnNotification", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>
        </div>
      </section>

      {/* Message Preview & Privacy */}
      <section className={`settings-section rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4 shadow-sm backdrop-blur-sm ${!preferences.notificationsEnabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="settings-section-heading mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Eye size={18} strokeWidth={2} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Message Preview & Privacy
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Choose how much detail is exposed on lockscreen and desktop banners
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            {
              id: "full",
              title: "Name and Message",
              desc: "Show sender name and message text",
              icon: Eye,
            },
            {
              id: "nameOnly",
              title: "Name Only",
              desc: "Show sender name, hide message text",
              icon: User,
            },
            {
              id: "hidden",
              title: "No Preview",
              desc: "Hide all sender and message details",
              icon: EyeOff,
            },
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = preferences.notificationPreviewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onChange("notificationPreviewMode", mode.id as NotificationPreviewMode);
                  onChange("notificationPreview", mode.id !== "hidden");
                }}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-900 dark:text-sky-200 font-semibold ring-1 ring-sky-500 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                }`}
              >
                <Icon size={16} className={`mb-2 ${isSelected ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`} />
                <span className="text-xs font-semibold leading-tight mb-1">{mode.title}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal leading-normal">
                  {mode.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Protected Content Privacy Disclaimer */}
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/50 text-[11px] text-slate-600 dark:text-slate-400">
          <ShieldCheck size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <span>
            View-once photos, self-destructing messages, and protected content chats are automatically redacted from all desktop notifications.
          </span>
        </div>
      </section>

      {/* Categories */}
      <section className={`settings-section rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4 shadow-sm backdrop-blur-sm ${!preferences.notificationsEnabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="settings-section-heading mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Users size={18} strokeWidth={2} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notification Categories
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Enable or silence notifications by conversation type
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <User size={16} className="text-sky-500 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Private Chats
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Direct one-on-one messages
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifyPrivateChats}
              onChange={(e) => onChange("notifyPrivateChats", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <Users size={16} className="text-emerald-500 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Groups
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Group chats and forum topic messages
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifyGroups}
              onChange={(e) => onChange("notifyGroups", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div className="flex items-center gap-2.5">
              <Megaphone size={16} className="text-amber-500 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Channels
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Broadcast posts and announcements
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifyChannels}
              onChange={(e) => onChange("notifyChannels", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>
        </div>
      </section>

      {/* Triggers & Active Focus */}
      <section className={`settings-section rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-4 shadow-sm backdrop-blur-sm ${!preferences.notificationsEnabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="settings-section-heading mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <AtSign size={18} strokeWidth={2} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Exceptions & Focus
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Manage priority triggers and active window suppression
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                Notify on @Mentions & Replies
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Always notify when someone mentions you or replies to you, even if the chat is muted
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifyMentions}
              onChange={(e) => onChange("notifyMentions", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                Notify on Reactions
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Receive notifications when members react to your messages
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifyReactions}
              onChange={(e) => onChange("notifyReactions", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                Suppress in Active Conversation
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Silence desktop popups when you are already viewing the conversation
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.suppressActiveConversation}
              onChange={(e) => onChange("suppressActiveConversation", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                Respect OS Focus Assist / Do Not Disturb
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically silence alerts when Windows Focus or DND mode is active
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.respectFocusMode}
              onChange={(e) => onChange("respectFocusMode", e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
          </label>
        </div>
      </section>
    </div>
  );
};
