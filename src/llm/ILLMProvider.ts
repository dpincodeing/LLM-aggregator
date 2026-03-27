// =============================================================================
// FILE: src/llm/ILLMProvider.ts
// PURPOSE: The canonical contract every LLM provider strategy must satisfy.
//
// DESIGN PATTERN — Strategy:
//   This interface is the "Strategy" in the Strategy Pattern. The Factory
//   (llm-factory.ts) selects the correct concrete Strategy at runtime based
//   on the provider name. The calling code (e.g. a chat controller) only ever
//   references ILLMProvider — it has zero knowledge of which provider is
//   actually being used.
//
// WHY STREAMING:
//   All major LLM APIs support server-sent event (SSE) streaming. Returning a
//   Node.js AsyncIterable<string> is the lowest-common-denominator abstraction:
//   - It's natively awaitable with `for await...of`.
//   - It can be piped to an HTTP response using a ReadableStream or SSE writer.
//   - Each strategy maps the provider's proprietary stream format to plain
//     string chunks internally, keeping the caller clean.
// =============================================================================

/**
 * A single message in a conversation turn.
 * Mirrors the OpenAI / Anthropic message format closely enough to be
 * provider-agnostic at the interface level.
 */
export interface ChatMessage {
  /** 'user' | 'assistant' | 'system' */
  role: 'user' | 'assistant' | 'system';

  /** The text content of the message. */
  content: string;
}

/**
 * Optional generation parameters that callers may pass per-request.
 * Each strategy is responsible for mapping these to its provider's format.
 */
export interface GenerationOptions {
  /** Sampling temperature — controls randomness. Typically 0.0–2.0. */
  temperature?: number;

  /** Maximum tokens to generate in the response. */
  maxTokens?: number;

  /** Override the provider's default model for this request. */
  model?: string;
}

/**
 * ILLMProvider — the Strategy interface.
 *
 * Every concrete provider strategy (OpenAI, Anthropic, Gemini, Perplexity)
 * must implement this interface. This gives the rest of the codebase a single,
 * stable API surface regardless of how each provider's SDK works underneath.
 */
export interface ILLMProvider {
  /**
   * Sends a conversation to the LLM and returns an async stream of text chunks.
   *
   * The strategy implementation is responsible for:
   *   1. Mapping `messages` to the provider's required request body format.
   *   2. Authenticating using the decrypted `apiKey`.
   *   3. Making the HTTP/SDK call with streaming enabled.
   *   4. Yielding each incremental text chunk as a plain string.
   *   5. Throwing a typed error if the API rejects the key or the call fails.
   *
   * @param messages      The full conversation history to send to the model.
   * @param apiKey        The decrypted, plaintext API key for this provider.
   *                      NEVER log or persist this value.
   * @param options       Optional generation parameters (temperature, maxTokens…).
   * @returns             An AsyncIterable that yields string chunks as they
   *                      arrive from the provider's stream.
   *
   * @throws {InvalidApiKeyError}  If the provider rejects the key (HTTP 401/403).
   * @throws {ProviderError}       For any other provider-side failure.
   */
  generateStream(
    messages: ChatMessage[],
    apiKey: string,
    options?: GenerationOptions,
  ): AsyncIterable<string>;
}

// ── Typed Error Classes ───────────────────────────────────────────────────────
// Defining these here keeps the interface file self-contained. Callers can
// import and `instanceof`-check them without depending on a strategy file.

/** Thrown when a provider responds with HTTP 401 or 403. */
export class InvalidApiKeyError extends Error {
  constructor(provider: string) {
    super(`[${provider}] API key is invalid or has been revoked.`);
    this.name = 'InvalidApiKeyError';
  }
}

/** Thrown for any other provider-side error (rate limit, 5xx, etc.). */
export class ProviderError extends Error {
  constructor(provider: string, detail: string) {
    super(`[${provider}] Provider error: ${detail}`);
    this.name = 'ProviderError';
  }
}
