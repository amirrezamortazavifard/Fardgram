import type { Message } from "./types";

export const messageExpired = (message: Pick<Message, "expiresAt">, now = Date.now()) =>
  message.expiresAt !== undefined && (!Number.isFinite(Date.parse(message.expiresAt)) || Date.parse(message.expiresAt) <= now);

export const messageCanBeCached = (message: Message) =>
  !message.isLocallyDeleted && !message.selfDestruct && !message.expiresAt && message.canSave !== false && message.permissions?.canSave !== false;

export const messageCanBeSaved = (message: Message, allowSaveTimed = false) =>
  message.canSave !== false && message.permissions?.canSave !== false && (allowSaveTimed || !message.selfDestruct) && !messageExpired(message);
