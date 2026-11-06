import type { Message } from "../telegram/types";

export const isPlayableAudioMessage = (message: Message): boolean => {
  const content = message.content;
  if (content.kind === "media" && ["audio", "voice"].includes(content.mediaType)) return true;
  if (
    content.kind === "file" &&
    (content.mimeType?.startsWith("audio/") ||
      /\.(mp3|m4a|ogg|opus|wav|flac|aac|wma)$/i.test(content.fileName ?? ""))
  ) {
    return true;
  }
  return false;
};

export const audioMessageNeighbors = (messages: readonly Message[]) => {
  const audio = messages.filter(isPlayableAudioMessage);
  const identity = (message?: Message) => (message ? `${message.chatId}:${message.id}` : undefined);
  return new Map(
    audio.map((message, index) => [
      message.id,
      {
        previousId: identity(audio[index - 1]),
        nextId: identity(audio[index + 1]),
      },
    ]),
  );
};
