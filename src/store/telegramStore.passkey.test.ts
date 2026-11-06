import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockTelegramTransport } from "../telegram/mockTransport";
import { createTelegramStore } from "./telegramStore";
import * as passkeysModule from "../telegram/passkeys";

describe("telegramStore passkey features (FG-009)", () => {
  let transport: MockTelegramTransport;
  let store: ReturnType<typeof createTelegramStore>;

  beforeEach(() => {
    transport = new MockTelegramTransport();
    store = createTelegramStore(transport);
  });

  it("loads login passkeys and checks platform availability", async () => {
    vi.spyOn(passkeysModule, "isPasskeySupported").mockResolvedValue(true);

    await store.getState().initialize();
    await store.getState().loadLoginPasskeys();

    const state = store.getState();
    expect(state.passkeys.length).toBeGreaterThanOrEqual(2);
    expect(state.passkeys[0].name).toContain("Windows Hello");
    expect(state.passkeyAuthAvailable).toBe(true);
    expect(state.passkeysLoading).toBe(false);
  });

  it("registers a new passkey via WebAuthn attestation", async () => {
    vi.spyOn(passkeysModule, "createPasskeyWithWebAuthn").mockResolvedValue({
      clientData: "mock-client-data",
      attestationObject: "mock-attestation",
    });

    await store.getState().initialize();
    await store.getState().loadLoginPasskeys();

    const initialCount = store.getState().passkeys.length;
    const newPasskey = await store.getState().registerPasskey("Touch ID");

    expect(newPasskey).not.toBeNull();
    expect(store.getState().passkeys.length).toBe(initialCount + 1);
    expect(store.getState().passkeys[0].id).toBe(newPasskey?.id);
  });

  it("removes an existing passkey by id", async () => {
    await store.getState().initialize();
    await store.getState().loadLoginPasskeys();

    const passkeyId = store.getState().passkeys[0].id;
    const success = await store.getState().removePasskey(passkeyId);

    expect(success).toBe(true);
    expect(store.getState().passkeys.some((p) => p.id === passkeyId)).toBe(false);
  });

  it("logs in with passkey challenge and transitions authorization to ready", async () => {
    vi.spyOn(passkeysModule, "authenticateWithPasskey").mockResolvedValue({
      credentialId: "pk-win-hello-1",
      clientData: "mock-client-data",
      authenticatorData: "mock-auth-data",
      signature: "mock-signature",
      userHandle: "mock-user-handle",
    });

    // Start in authorization flow
    transport = new MockTelegramTransport({ authFlow: true });
    store = createTelegramStore(transport);
    await store.getState().initialize();

    const success = await store.getState().loginWithPasskey();

    expect(success).toBe(true);
    expect(store.getState().authorization.kind).toBe("ready");
  });
});
