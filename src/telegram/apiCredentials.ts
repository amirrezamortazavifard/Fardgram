import { invoke } from "@tauri-apps/api/core";
import type { TelegramApiCredentialsInfo, ApiCredentialsTestResult } from "./types";

export async function getApiCredentials(): Promise<TelegramApiCredentialsInfo> {
  return await invoke<TelegramApiCredentialsInfo>("telegram_get_api_credentials");
}

export async function saveApiCredentials(
  apiId: number,
  apiHash: string,
  appTitle?: string,
  shortName?: string,
): Promise<TelegramApiCredentialsInfo> {
  return await invoke<TelegramApiCredentialsInfo>("telegram_save_api_credentials", {
    apiId,
    apiHash,
    appTitle: appTitle?.trim() || undefined,
    shortName: shortName?.trim() || undefined,
  });
}

export async function clearApiCredentials(): Promise<TelegramApiCredentialsInfo> {
  return await invoke<TelegramApiCredentialsInfo>("telegram_clear_api_credentials");
}

export async function testApiCredentials(
  apiId: number,
  apiHash: string,
): Promise<ApiCredentialsTestResult> {
  return await invoke<ApiCredentialsTestResult>("telegram_test_api_credentials", {
    apiId,
    apiHash,
  });
}
