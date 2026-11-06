export interface TelegramMessageEffect {
  id: string;
  emoji: string;
  name: string;
  description: string;
  particles: string[];
  particleColor: string;
}

export const TELEGRAM_MESSAGE_EFFECTS: readonly TelegramMessageEffect[] = [
  {
    id: "5104841245755180586",
    emoji: "🔥",
    name: "Fire",
    description: "Fierce flame burst",
    particles: ["🔥", "✨", "💥"],
    particleColor: "#f97316",
  },
  {
    id: "5046509860389126442",
    emoji: "🎉",
    name: "Party Popper",
    description: "Celebratory confetti blast",
    particles: ["🎉", "🎊", "⭐", "✨"],
    particleColor: "#eab308",
  },
  {
    id: "5107584321108051014",
    emoji: "❤️",
    name: "Love Heart",
    description: "Floating loving hearts",
    particles: ["❤️", "💖", "💕", "✨"],
    particleColor: "#ec4899",
  },
  {
    id: "5107584321108051017",
    emoji: "👍",
    name: "Thumbs Up",
    description: "Approving thumbs popping",
    particles: ["👍", "🌟", "✨"],
    particleColor: "#0ea5e9",
  },
  {
    id: "5104858069142078847",
    emoji: "👎",
    name: "Thumbs Down",
    description: "Disapproving thumbs",
    particles: ["👎", "💨", "🍂"],
    particleColor: "#64748b",
  },
  {
    id: "5046589136023057076",
    emoji: "💩",
    name: "Poop",
    description: "Playful swirls",
    particles: ["💩", "💨", "💫"],
    particleColor: "#854d0e",
  },
  {
    id: "5044134455711629726",
    emoji: "⚡",
    name: "Lightning",
    description: "High-voltage electric sparks",
    particles: ["⚡", "✨", "💫"],
    particleColor: "#facc15",
  },
  {
    id: "5046509860389126444",
    emoji: "🕊️",
    name: "Peace Dove",
    description: "Peaceful soaring doves",
    particles: ["🕊️", "✨", "🍃"],
    particleColor: "#38bdf8",
  },
  {
    id: "5046509860389126445",
    emoji: "💯",
    name: "Hundred",
    description: "Maximum score marks",
    particles: ["💯", "🔥", "✨"],
    particleColor: "#ef4444",
  },
  {
    id: "5046509860389126446",
    emoji: "🏆",
    name: "Trophy",
    description: "Golden champions cup",
    particles: ["🏆", "⭐", "✨"],
    particleColor: "#eab308",
  },
];

const EFFECT_BY_ID = new Map<string, TelegramMessageEffect>(
  TELEGRAM_MESSAGE_EFFECTS.map((effect) => [effect.id, effect]),
);

export const getMessageEffect = (effectId?: string): TelegramMessageEffect | undefined => {
  if (!effectId || effectId === "0") return undefined;
  // Match exact ID
  const matched = EFFECT_BY_ID.get(effectId);
  if (matched) return matched;

  // Fallback match by deterministic index if an unrecognized ID is delivered by Telegram
  const numeric = Math.abs(Number(effectId) || 0);
  if (numeric > 0) {
    return TELEGRAM_MESSAGE_EFFECTS[numeric % TELEGRAM_MESSAGE_EFFECTS.length];
  }

  return undefined;
};
