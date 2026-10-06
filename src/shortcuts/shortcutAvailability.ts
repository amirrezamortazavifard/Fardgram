import { invoke, isTauri } from "@tauri-apps/api/core";
import { parseShortcut } from "./shortcuts";

export type ShortcutAvailability = "available" | "conflict" | "unsupported";

export const checkShortcutAvailability = async (binding: string): Promise<ShortcutAvailability> => {
  const shortcut = parseShortcut(binding);
  if (!shortcut || !isTauri()) return "unsupported";
  return invoke<ShortcutAvailability>("fardgram_check_shortcut", { shortcut });
};
