import { invoke, isTauri } from "@tauri-apps/api/core";

export const openSettingsWindow = async () => {
  if (!isTauri()) return false;
  await invoke("fardgram_open_settings_window");
  return true;
};
