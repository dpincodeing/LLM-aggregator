import 'dotenv/config';
// =============================================================================
// FILE: src/examples/chat-usage.ts

// =============================================================================
// FILE: src/examples/chat-usage.ts
// PURPOSE: Demonstrates how the three components wire together end-to-end.
//          This would live inside an Express/Fastify route handler in production.
// =============================================================================

import { decryptKey }      from '../utils/crypto.js';
import { StrategyFactory } from '../llm/llm-factory.js';
import { InvalidApiKeyError, ProviderError } from '../llm/ILLMProvider.js';
import { UnknownProviderError }              from '../llm/llm-factory.js';

/**
 * Example: what a chat controller handler might look like.
 *
 * In a real Express app:
 *   - `req.user.id` comes from JWT middleware.
 *   - The UserKey row is fetched from Prisma.
 *   - Streaming chunks are written to `res` as SSE.
 */
async function handleChatRequest(
  providerName: string,           // e.g. 'openai' — from request body
  encryptedKey: string,           // from UserKey DB row
  iv: string,                     // from UserKey DB row
  authTag: string,                // from UserKey DB row
  userMessages: { role: 'user' | 'assistant' | 'system'; content: string }[],
): Promise<void> {

  // Step 1 — Decrypt the stored API key.
  // This is the ONLY place the plaintext key exists; it lives only in memory
  // for the duration of this request and is never logged or re-stored.
  let decryptedApiKey: string;
  try {
    decryptedApiKey = decryptKey(encryptedKey, iv, authTag);
  } catch {
    console.error('Decryption failed — key may have been tampered with.');
    throw new Error('Unable to retrieve API key. Please re-register your key.');
  }

  // Step 2 — Get the correct strategy from the factory.
  let provider;
  try {
    provider = StrategyFactory.getProvider(providerName);
  } catch (err) {
    if (err instanceof UnknownProviderError) {
      throw new Error(`Unsupported provider: ${providerName}`);
    }
    throw err;
  }

  // Step 3 — Stream the response.
  try {
    for await (const chunk of provider.generateStream(userMessages, decryptedApiKey)) {
      // In production: res.write(`data: ${chunk}\n\n`)
      process.stdout.write(chunk);
    }
    console.log('\n[Stream complete]');

  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      // Surface a 401 to the client — their stored key is bad.
      throw err;
    }
    if (err instanceof ProviderError) {
      // Surface a 502 Bad Gateway — provider-side failure.
      throw err;
    }
    throw err; // Unexpected — let global error handler deal with it.
  }
}

// ── Quick smoke-test (run with ts-node) ───────────────────────────────────────
// (Remove this block when integrating into your HTTP framework)

import { encryptKey } from '../utils/crypto.js';

(async () => {
  // Simulate storing a key
  const rawKey = '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';
  const payload = encryptKey(rawKey);

  console.log('Encrypted payload:', payload);

  // Simulate a chat request
  await handleChatRequest(
    'groq',
    payload.cipherText,
    payload.iv,
    payload.authTag,
    [
      { role: 'system',    content: 'You are a helpful assistant.' },
      { role: 'user',      content: 'Say hello in one sentence.' },
    ],
  );
})();
