import { describe, expect, it, vi } from "vitest";
import {
  base64UrlToBuffer,
  bufferToBase64,
  bufferToBase64Url,
  isPasskeySupported,
  authenticateWithPasskey,
  createPasskeyWithWebAuthn,
} from "./passkeys";

describe("passkeys utilities", () => {
  it("encodes and decodes base64url correctly", () => {
    const original = new Uint8Array([72, 101, 108, 108, 111, 33, 63]); // "Hello!?"
    const b64 = bufferToBase64(original);
    const b64url = bufferToBase64Url(original);
    expect(b64url).not.toContain("+");
    expect(b64url).not.toContain("/");
    expect(b64url).not.toContain("=");

    const decodedBuf = base64UrlToBuffer(b64url);
    const decodedArr = new Uint8Array(decodedBuf);
    expect(decodedArr).toEqual(original);
  });

  it("checks platform passkey support", async () => {
    // When window.PublicKeyCredential is not available
    const origPKC = (globalThis as any).PublicKeyCredential;
    const origWinPKC = typeof window !== "undefined" ? (window as any).PublicKeyCredential : undefined;
    (globalThis as any).PublicKeyCredential = undefined;
    if (typeof window !== "undefined") (window as any).PublicKeyCredential = undefined;
    expect(await isPasskeySupported()).toBe(false);

    // When window.PublicKeyCredential is available
    const mockPKC = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    };
    (globalThis as any).PublicKeyCredential = mockPKC;
    if (typeof window !== "undefined") (window as any).PublicKeyCredential = mockPKC;
    expect(await isPasskeySupported()).toBe(true);
    (globalThis as any).PublicKeyCredential = origPKC;
    if (typeof window !== "undefined") (window as any).PublicKeyCredential = origWinPKC;
  });

  it("parses and executes WebAuthn authentication ceremony", async () => {
    const mockClientData = JSON.stringify({ type: "webauthn.get", challenge: "dGVzdA" });
    const mockAuthData = new Uint8Array([1, 2, 3, 4]).buffer;
    const mockSig = new Uint8Array([5, 6, 7, 8]).buffer;
    const mockUserHandle = new Uint8Array([9, 10]).buffer;

    const mockResponse: Partial<AuthenticatorAssertionResponse> = {
      clientDataJSON: new TextEncoder().encode(mockClientData).buffer as ArrayBuffer,
      authenticatorData: mockAuthData,
      signature: mockSig,
      userHandle: mockUserHandle,
    };

    const mockCredential = {
      id: "cred-abc-123",
      rawId: new Uint8Array([1, 2]).buffer,
      response: mockResponse,
      type: "public-key",
    };

    // Subclass or mock PublicKeyCredential
    class MockPKC {}
    Object.setPrototypeOf(mockCredential, MockPKC.prototype);
    (globalThis as any).PublicKeyCredential = MockPKC;

    const mockGet = vi.fn().mockResolvedValue(mockCredential);
    (globalThis.navigator as any).credentials = { get: mockGet, create: vi.fn() };

    const optionsJson = JSON.stringify({
      challenge: "dGVzdA",
      rpId: "telegram.org",
      allowCredentials: [{ id: "Y3JlZC0x", type: "public-key" }],
    });

    const result = await authenticateWithPasskey(optionsJson);
    expect(mockGet).toHaveBeenCalledOnce();
    expect(result.credentialId).toBe("cred-abc-123");
    expect(result.clientData).toBe(mockClientData);
    expect(result.authenticatorData).toBe(bufferToBase64(mockAuthData));
    expect(result.signature).toBe(bufferToBase64(mockSig));
    expect(result.userHandle).toBe(bufferToBase64(mockUserHandle));
  });

  it("parses and executes WebAuthn creation ceremony", async () => {
    const mockClientData = JSON.stringify({ type: "webauthn.create", challenge: "Y3JlYXRl" });
    const mockAttestation = new Uint8Array([10, 20, 30, 40]).buffer;

    const mockResponse: Partial<AuthenticatorAttestationResponse> = {
      clientDataJSON: new TextEncoder().encode(mockClientData).buffer as ArrayBuffer,
      attestationObject: mockAttestation,
    };

    const mockCredential = {
      id: "new-cred-789",
      rawId: new Uint8Array([3, 4]).buffer,
      response: mockResponse,
      type: "public-key",
    };

    class MockPKC {}
    Object.setPrototypeOf(mockCredential, MockPKC.prototype);
    (globalThis as any).PublicKeyCredential = MockPKC;

    const mockCreate = vi.fn().mockResolvedValue(mockCredential);
    (globalThis.navigator as any).credentials = { get: vi.fn(), create: mockCreate };

    const optionsJson = JSON.stringify({
      challenge: "Y3JlYXRl",
      rp: { name: "Telegram" },
      user: { id: "dXNlci0x", name: "User 1", displayName: "User One" },
    });

    const result = await createPasskeyWithWebAuthn(optionsJson);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result.clientData).toBe(mockClientData);
    expect(result.attestationObject).toBe(bufferToBase64(mockAttestation));
  });
});
