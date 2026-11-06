/**
 * WebAuthn Passkeys Helper for Telegram / TDLib.
 *
 * Implements FIDO2 / WebAuthn ceremony transformations for Telegram Passkey
 * authentication (`getAuthenticationPasskeyParameters`, `checkAuthenticationPasskey`)
 * and enrollment (`getPasskeyParameters`, `addLoginPasskey`).
 */

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  return bufferToBase64(buffer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function isPasskeySupported(): Promise<boolean> {
  const pkc = typeof window !== "undefined" && window.PublicKeyCredential
    ? window.PublicKeyCredential
    : typeof globalThis !== "undefined"
      ? (globalThis as any).PublicKeyCredential
      : undefined;
  if (!pkc) {
    return false;
  }
  try {
    if (typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

export interface WebAuthnAssertionResult {
  credentialId: string;
  clientData: string;
  authenticatorData: string;
  signature: string;
  userHandle: string;
}

export async function authenticateWithPasskey(
  optionsJson: string,
): Promise<WebAuthnAssertionResult> {
  let parsed: any;
  try {
    parsed = JSON.parse(optionsJson);
  } catch (err) {
    throw new Error(`Failed to parse passkey authentication parameters: ${String(err)}`);
  }

  // Handle both { publicKey: ... } and direct options
  const rawOptions = parsed.publicKey ?? parsed;

  const requestOptions: PublicKeyCredentialRequestOptions = {
    challenge: typeof rawOptions.challenge === "string"
      ? base64UrlToBuffer(rawOptions.challenge)
      : rawOptions.challenge,
    timeout: rawOptions.timeout ?? 60000,
    rpId: rawOptions.rpId || rawOptions.rp_id || undefined,
    userVerification: rawOptions.userVerification ?? "preferred",
    allowCredentials: Array.isArray(rawOptions.allowCredentials)
      ? rawOptions.allowCredentials.map((c: any) => ({
          type: c.type ?? "public-key",
          id: typeof c.id === "string" ? base64UrlToBuffer(c.id) : c.id,
          transports: c.transports,
        }))
      : undefined,
  };

  const credential = await navigator.credentials.get({ publicKey: requestOptions });
  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new Error("No passkey credential received");
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  const clientData = new TextDecoder().decode(response.clientDataJSON);
  const authenticatorData = bufferToBase64(response.authenticatorData);
  const signature = bufferToBase64(response.signature);
  const userHandle = response.userHandle ? bufferToBase64(response.userHandle) : "";

  return {
    credentialId: credential.id,
    clientData,
    authenticatorData,
    signature,
    userHandle,
  };
}

export interface WebAuthnAttestationResult {
  clientData: string;
  attestationObject: string;
}

export async function createPasskeyWithWebAuthn(
  optionsJson: string,
): Promise<WebAuthnAttestationResult> {
  let parsed: any;
  try {
    parsed = JSON.parse(optionsJson);
  } catch (err) {
    throw new Error(`Failed to parse passkey creation parameters: ${String(err)}`);
  }

  const rawOptions = parsed.publicKey ?? parsed;

  const creationOptions: PublicKeyCredentialCreationOptions = {
    challenge: typeof rawOptions.challenge === "string"
      ? base64UrlToBuffer(rawOptions.challenge)
      : rawOptions.challenge,
    rp: rawOptions.rp ?? { name: "Telegram" },
    user: {
      id: typeof rawOptions.user?.id === "string"
        ? base64UrlToBuffer(rawOptions.user.id)
        : (rawOptions.user?.id ?? new Uint8Array([1, 2, 3, 4]).buffer),
      name: rawOptions.user?.name ?? "Telegram User",
      displayName: rawOptions.user?.displayName ?? rawOptions.user?.name ?? "Telegram User",
    },
    pubKeyCredParams: rawOptions.pubKeyCredParams ?? [
      { alg: -7, type: "public-key" }, // ES256
      { alg: -257, type: "public-key" }, // RS256
    ],
    timeout: rawOptions.timeout ?? 60000,
    attestation: rawOptions.attestation ?? "none",
    authenticatorSelection: rawOptions.authenticatorSelection ?? {
      userVerification: "preferred",
      residentKey: "preferred",
    },
  };

  const credential = await navigator.credentials.create({ publicKey: creationOptions });
  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new Error("Failed to create passkey credential");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const clientData = new TextDecoder().decode(response.clientDataJSON);
  const attestationObject = bufferToBase64(response.attestationObject);

  return {
    clientData,
    attestationObject,
  };
}
