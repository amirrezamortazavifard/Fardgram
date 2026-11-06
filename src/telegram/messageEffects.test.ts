import { describe, it, expect } from "vitest";
import {
  TELEGRAM_MESSAGE_EFFECTS,
  getMessageEffect,
} from "./messageEffects";

describe("FG-024 Message Effects Catalog", () => {
  it("provides standard Telegram effects with valid IDs, emojis, and particles", () => {
    expect(TELEGRAM_MESSAGE_EFFECTS.length).toBeGreaterThanOrEqual(10);
    for (const effect of TELEGRAM_MESSAGE_EFFECTS) {
      expect(effect.id).toMatch(/^\d+$/);
      expect(effect.emoji.length).toBeGreaterThan(0);
      expect(effect.name.length).toBeGreaterThan(0);
      expect(effect.particles.length).toBeGreaterThan(0);
      expect(effect.particleColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("retrieves known effects by exact ID", () => {
    const fire = getMessageEffect("5104841245755180586");
    expect(fire).toBeDefined();
    expect(fire?.name).toBe("Fire");
    expect(fire?.emoji).toBe("🔥");

    const party = getMessageEffect("5046509860389126442");
    expect(party).toBeDefined();
    expect(party?.name).toBe("Party Popper");
  });

  it("handles null, empty or zero effect IDs safely", () => {
    expect(getMessageEffect(undefined)).toBeUndefined();
    expect(getMessageEffect("")).toBeUndefined();
    expect(getMessageEffect("0")).toBeUndefined();
  });

  it("gracefully maps unrecognized numeric effect IDs to a fallback effect", () => {
    const fallback = getMessageEffect("999999999");
    expect(fallback).toBeDefined();
    expect(TELEGRAM_MESSAGE_EFFECTS).toContain(fallback);
  });
});
