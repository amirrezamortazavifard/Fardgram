import { invoke, isTauri } from "@tauri-apps/api/core";

export interface TelegramProtocolSettings { supported: boolean; registered: boolean; isDefault: boolean; }
export const telegramProtocol = {
  settings: (): Promise<TelegramProtocolSettings> => isTauri()
    ? invoke("fardgram_telegram_protocol_settings")
    : Promise.resolve({ supported: false, registered: false, isDefault: false }),
  register: (): Promise<TelegramProtocolSettings> => invoke("fardgram_register_telegram_protocol"),
  openDefaultApps: (): Promise<void> => invoke("fardgram_open_default_apps"),
};
