import { invoke, isTauri } from "@tauri-apps/api/core";

export interface OpenMiniAppOptions {
  id: string;
  url: string;
  title: string;
  botUsername?: string;
}

export const openNativeMiniApp = async (options: OpenMiniAppOptions): Promise<boolean> => {
  if (!isTauri()) return false;
  await invoke("fardgram_open_mini_app", {
    id: options.id,
    url: options.url,
    title: options.title,
    botUsername: options.botUsername,
  });
  return true;
};

export const closeNativeMiniApp = async (id: string): Promise<boolean> => {
  if (!isTauri()) return false;
  await invoke("fardgram_close_mini_app", { id });
  return true;
};
