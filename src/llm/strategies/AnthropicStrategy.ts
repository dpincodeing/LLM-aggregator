// =============================================================================
// FILE: src/llm/strategies/AnthropicStrategy.ts
// PURPOSE: Concrete Strategy for the Anthropic Messages API (streaming).
//
// API REFERENCE: https://docs.anthropic.com/en/api/messages-streaming
//
// PAYLOAD MAPPING (our format → Anthropic format):
//   ChatMessage[] (role: 'system')  → top-level `system` string (NOT in messages[])
//   ChatMessage[] (role: other)     → messages[]  (role: 'user' | 'assistant')
//   options.model                   → model       (default: claude-opus-4-5)
//   options.temperature             → temperature
//   options.maxTokens               → max_tokens  (REQUIRED by Anthropic — no default)
//
// KEY DIFFERENCES FROM OPENAI:
//   1. System prompt is a TOP-LEVEL field, not a message with role: 'system'.
//   2. max_tokens is MANDATORY — Anthropic has no server-side default.
//   3. Auth header is `x-api-key`, not `Authorization: Bearer`.
//   4. API version must be declared with `anthropic-version` header.
//   5. SSE event types are named (e.g. `content_block_delta`) not bare `data:`.
// =============================================================================

import {
  type ILLMProvider,
  type ChatMessage,
  type GenerationOptions,
  InvalidApiKeyError,
  ProviderError,
} from '../ILLMProvider.js';

// ── Anthropic-specific SSE event types ───────────────────────────────────────

/** Discriminated union of the SSE event types Anthropic sends. */
type AnthropicStreamEvent =
  | { type: 'message_start';       message: { id: string } }
  | { type: 'content_block_start'; index: number; content_block: { type: string; text: string } }
  | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } }
  | { type: 'content_block_stop';  index: number }
  | { type: 'message_delta';       delta: { stop_reason: string } }
  | { type: 'message_stop' }
  | { type: 'ping' }
  | { type: 'error';               error: { type: string; message: string } };

// ── Strategy Implementation ───────────────────────────────────────────────────

export class AnthropicStrategy implements ILLMProvider {
  private static readonly BASE_URL    = 'https://api.anthropic.com/v1/messages';
  private static readonly DEFAULT_MODEL  = 'claude-opus-4-5';

  /**
   * Anthropic REQUIRES max_tokens to be set. We use a safe fallback if the
   * caller does not specify one, but prefer the caller to be explicit.
   */
  private static readonly DEFAULT_MAX_TOKENS = 4096;

  /** The API version date header required by Anthropic. Update when migrating. */
  private static readonly API_VERSION = '2023-06-01';
  private static readonly PROVIDER_NAME = 'anthropic';

  /**
   * Streams a chat completion from the Anthropic Messages API.
   *
   * Internally:
   *   1. Separates system messages from the conversation history.
   *   2. Maps our ChatMessage[] to Anthropic's messages format.
   *   3. POSTs to /v1/messages with `stream: true`.
   *   4. Parses named SSE events and yields `content_block_delta` text.
   */
  async *generateStream(
    messages: ChatMessage[],
    apiKey: string,
    options: GenerationOptions = {},
  ): AsyncIterable<string> {

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!apiKey || apiKey.trim().length === 0) {
      throw new InvalidApiKeyError(AnthropicStrategy.PROVIDER_NAME);
    }
    if (!messages || messages.length === 0) {
      throw new Error('[anthropic] generateStream: messages array must not be empty.');
    }

    // ── KEY MAPPING DIFFERENCE #1: Extract system prompt ─────────────────────
    // Anthropic does NOT accept messages with role: 'system' in the messages[].
    // Instead, system instructions go in a dedicated top-level `system` field.
    // We concatenate multiple system messages (if present) with a newline.
    const systemMessages = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n');

    // Only user/assistant messages go into the `messages` array.
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role:    m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // ── Build Anthropic-format request body ───────────────────────────────────
    const requestBody: Record<string, unknown> = {
      model:      options.model ?? AnthropicStrategy.DEFAULT_MODEL,
      messages:   conversationMessages,

      // KEY MAPPING DIFFERENCE #2: max_tokens is REQUIRED.
      max_tokens: options.maxTokens ?? AnthropicStrategy.DEFAULT_MAX_TOKENS,

      stream:     true,
    };

    // Attach system prompt only if we found system messages.
    if (systemMessages.length > 0) {
      requestBody.system = systemMessages;
    }

    if (options.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    // ── Make the streaming HTTP request ───────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(AnthropicStrategy.BASE_URL, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',

          // KEY MAPPING DIFFERENCE #3: Auth header is x-api-key, not Bearer.
          'x-api-key':       apiKey,

          // KEY MAPPING DIFFERENCE #4: API version is required.
          'anthropic-version': AnthropicStrategy.API_VERSION,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr) {
      throw new ProviderError(
        AnthropicStrategy.PROVIDER_NAME,
        `Network error: ${(networkErr as Error).message}`
      );
    }

    // ── Handle HTTP-level errors ──────────────────────────────────────────────
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError(AnthropicStrategy.PROVIDER_NAME);
      }
      const errorBody = await response.text().catch(() => 'Unable to parse error body.');
      throw new ProviderError(
        AnthropicStrategy.PROVIDER_NAME,
        `HTTP ${response.status}: ${errorBody}`
      );
    }

    if (!response.body) {
      throw new ProviderError(AnthropicStrategy.PROVIDER_NAME, 'Response body is null.');
    }

    // ── Parse Anthropic's named SSE stream ───────────────────────────────────
    // KEY MAPPING DIFFERENCE #5: Anthropic SSE events have an `event:` line
    // BEFORE the `data:` line. We only need to yield text from events typed
    // as `content_block_delta` with a `text_delta` sub-type.
    //
    // Example SSE packet:
    //   event: content_block_delta
    //   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}
    //
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and `event:` type lines — we discriminate on
          // the `type` field inside the JSON data payload instead.
          if (!trimmed || trimmed.startsWith('event:')) continue;
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice('data: '.length);
          if (jsonStr === '[DONE]') return; // safety — Anthropic uses message_stop

          try {
            const event = JSON.parse(jsonStr) as AnthropicStreamEvent;

            // Surface any API-level errors embedded in the stream.
            if (event.type === 'error') {
              throw new ProviderError(
                AnthropicStrategy.PROVIDER_NAME,
                event.error.message
              );
            }

            // Yield only the incremental text delta chunks.
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta' &&
              event.delta.text
            ) {
              yield event.delta.text;
            }

            // message_stop signals the end of the stream — we can exit cleanly.
            if (event.type === 'message_stop') {
              return;
            }

          } catch (parseErr) {
            if (parseErr instanceof ProviderError) throw parseErr;
            console.warn('[anthropic] Failed to parse SSE chunk:', jsonStr);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
