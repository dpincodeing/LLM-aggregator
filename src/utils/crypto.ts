// =============================================================================
// FILE: src/utils/crypto.ts
// PURPOSE: Symmetric encryption / decryption of user API keys using AES-256-GCM.
//
// ALGORITHM CHOICE — AES-256-GCM:
//   • AES-256   → 256-bit key; effectively brute-force-proof with current hardware.
//   • GCM mode  → Galois/Counter Mode provides BOTH confidentiality AND integrity
//                 (authenticated encryption). The 16-byte authTag acts as an HMAC:
//                 decryption fails loudly if the ciphertext has been tampered with.
//   • Alternative (AES-256-CBC) lacks built-in authentication — you'd need a
//                 separate HMAC step (Encrypt-then-MAC). GCM handles it natively.
//
// KEY MANAGEMENT — DATA ENCRYPTION KEY (DEK):
//   The DEK is the single secret that protects all stored API keys.
//
//   HOW TO INJECT:
//     1. Generate once:  `openssl rand -hex 32`  (produces 64 hex chars = 32 bytes)
//     2. Store in your secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
//     3. Inject at runtime: ENCRYPTION_KEY=<64-hex-chars> in your .env or pod spec.
//
//   WHAT NOT TO DO:
//     ✗ Never commit the key to source control.
//     ✗ Never log it, even in debug mode.
//     ✗ Never re-use an IV across encryptions (this module generates a fresh one
//       each call via crypto.randomBytes).
//
//   KEY ROTATION:
//     When rotating the DEK, decrypt all UserKey rows with the OLD key, re-encrypt
//     with the NEW key, and update the rows in a single transaction before retiring
//     the old key from your secrets manager.
// =============================================================================

import crypto from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────────────

/** AES-256-GCM requires a 256-bit (32-byte) key. */
const KEY_LENGTH_BYTES = 32;

/** GCM standard IV length. 12 bytes is the NIST-recommended size; it maximises
 *  the security bound and allows GCM's counter to be used most efficiently. */
const IV_LENGTH_BYTES = 12;

/** GCM produces a 128-bit (16-byte) authentication tag by default. */
const AUTH_TAG_LENGTH_BYTES = 16;

const ALGORITHM = 'aes-256-gcm' as const;

// ── DEK Loading ───────────────────────────────────────────────────────────────

/**
 * Loads and validates the Data Encryption Key from the process environment.
 *
 * Called once at module load time so the application crashes immediately on
 * startup if the key is absent or malformed — fail-fast is safer than
 * discovering a misconfiguration at the first encrypt/decrypt call.
 *
 * @throws {Error} If ENCRYPTION_KEY is missing or not a valid 32-byte hex string.
 */
function loadDek(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error(
      '[crypto] ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // A 32-byte key encoded as hex is exactly 64 characters.
  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    throw new Error(
      '[crypto] ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      `Received ${rawKey.length} characters.`
    );
  }

  return Buffer.from(rawKey, 'hex');
}

/**
 * The DEK as a Buffer, loaded once when the module is first imported.
 * It is module-scoped and never exported — no other file can access the raw key.
 */
const DEK: Buffer = loadDek();

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The three components that must be persisted together in the database.
 * None of them is secret on its own — security derives entirely from the DEK.
 */
export interface EncryptedPayload {
  /** AES-256-GCM ciphertext, base64-encoded. */
  cipherText: string;

  /** 12-byte Initialization Vector, base64-encoded. Unique per encryption. */
  iv: string;

  /** 16-byte GCM authentication tag, base64-encoded. Verifies integrity on decrypt. */
  authTag: string;
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext API key using AES-256-GCM.
 *
 * A fresh, cryptographically random IV is generated for EVERY call.
 * Reusing an IV with the same key under GCM completely breaks confidentiality
 * (it reveals the XOR of two plaintexts), so this is non-negotiable.
 *
 * @param plainTextKey  The raw provider API key string (e.g. "sk-proj-...").
 * @returns             An EncryptedPayload with cipherText, iv, and authTag —
 *                      all base64-encoded strings ready for database storage.
 *
 * @example
 * const payload = encryptKey('sk-proj-abc123');
 * // Store payload.cipherText, payload.iv, payload.authTag in UserKey row.
 */
export function encryptKey(plainTextKey: string): EncryptedPayload {
  if (!plainTextKey || plainTextKey.trim().length === 0) {
    throw new Error('[crypto] encryptKey: plainTextKey must not be empty.');
  }

  // Generate a fresh random IV for this specific encryption operation.
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  // Create the cipher with our DEK and fresh IV.
  const cipher = crypto.createCipheriv(ALGORITHM, DEK, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  // Encrypt in two steps: update() processes the plaintext, final() flushes
  // any remaining bytes from internal padding (GCM has none, but this is
  // idiomatic Node crypto usage).
  const encryptedBuffer = Buffer.concat([
    cipher.update(plainTextKey, 'utf8'),
    cipher.final(),
  ]);

  // The authTag is only available AFTER cipher.final() is called.
  const authTag = cipher.getAuthTag();

  return {
    cipherText: encryptedBuffer.toString('base64'),
    iv:         iv.toString('base64'),
    authTag:    authTag.toString('base64'),
  };
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypts an AES-256-GCM encrypted payload back to the plaintext API key.
 *
 * GCM authentication is verified automatically by Node's crypto module:
 * if the ciphertext or authTag has been tampered with, `decipher.final()`
 * throws an `Error: Unsupported state or unable to authenticate data`.
 * We catch and re-wrap that error to avoid leaking internal details.
 *
 * @param cipherText  Base64-encoded ciphertext from EncryptedPayload.
 * @param iv          Base64-encoded IV from EncryptedPayload.
 * @param authTag     Base64-encoded authentication tag from EncryptedPayload.
 * @returns           The original plaintext API key string.
 *
 * @throws {Error}    If any input is missing, or if GCM authentication fails
 *                    (indicating data tampering or a wrong DEK).
 *
 * @example
 * const apiKey = decryptKey(row.encryptedKey, row.iv, row.authTag);
 * // Use apiKey to initialise the provider SDK — never log or store it again.
 */
export function decryptKey(
  cipherText: string,
  iv: string,
  authTag: string,
): string {
  // Validate all three required fields are present.
  if (!cipherText || !iv || !authTag) {
    throw new Error(
      '[crypto] decryptKey: cipherText, iv, and authTag are all required.'
    );
  }

  try {
    const ivBuffer         = Buffer.from(iv,         'base64');
    const cipherTextBuffer = Buffer.from(cipherText, 'base64');
    const authTagBuffer    = Buffer.from(authTag,    'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, DEK, ivBuffer, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });

    // The authTag MUST be set before calling final() — GCM verifies it there.
    decipher.setAuthTag(authTagBuffer);

    const decryptedBuffer = Buffer.concat([
      decipher.update(cipherTextBuffer),
      decipher.final(), // ← throws if authentication fails
    ]);

    return decryptedBuffer.toString('utf8');

  } catch (err) {
    // Do NOT re-throw the original error — it may contain timing or internal
    // details useful to an attacker. Emit a generic message instead.
    // Log the original error internally (not shown here) for debugging.
    throw new Error(
      '[crypto] decryptKey: Decryption failed. The data may have been tampered ' +
      'with, or the encryption key may have changed.'
    );
  }
}
