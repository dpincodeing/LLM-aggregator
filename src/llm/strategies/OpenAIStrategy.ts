// =============================================================================
// FILE: src/llm/strategies/OpenAIStrategy.ts
// PURPOSE: Concrete Strategy for the OpenAI Chat Completions API (streaming).
//
// API REFERENCE: https://platform.openai.com/docs/api-reference/chat
//
// PAYLOAD MAPPING (our format → OpenAI format):
//   ChatMessage[]   → messages[]         (role/content match 1-to-1)
//   options.model   → model              (default: gpt-4o)
//   options.temp    → temperature
//   options.maxTok  → max_completion_tokens
//   stream: true    → streams SSE chunks back
//
// This strategy uses the native `fetch` API (Node 18+) with ReadableStream
// parsing instead of the OpenAI SDK — this keeps the dependency footprint
// small and makes the HTTP contract explicit and auditable.
// =============================================================================

import {
  type ILLMProvider,
  type ChatMessage,
  type GenerationOptions,
  InvalidApiKeyError,
  ProviderError,
} from '../ILLMProvider.js';

// ── OpenAI-specific types ─────────────────────────────────────────────────────

/** Shape of a single SSE data chunk from the OpenAI streaming API. */
interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  choices: Array<{
    delta: {
      content?: string;    // Text fragment — may be undefined for the last chunk
      role?: string;
    };
    finish_reason: string | null;
    index: number;
  }>;
}

// ── Strategy Implementation ───────────────────────────────────────────────────

export class OpenAIStrategy implements ILLMProvider {
  private static readonly BASE_URL = 'https://api.openai.com/v1/chat/completions';
  private static readonly DEFAULT_MODEL = 'gpt-4o';
  private static readonly PROVIDER_NAME = 'openai';

  /**
   * Streams a chat completion from the OpenAI API.
   *
   * Internally:
   *   1. Builds the request body by mapping our ChatMessage[] to OpenAI's format.
   *   2. POSTs to the Chat Completions endpoint with `stream: true`.
   *   3. Parses the Server-Sent Events (SSE) line-by-line.
   *   4. Yields each text delta as a plain string chunk.
   */
  async *generateStream(
    messages: ChatMessage[],
    apiKey: string,
    options: GenerationOptions = {},
  ): AsyncIterable<string> {

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!apiKey || apiKey.trim().length === 0) {
      throw new InvalidApiKeyError(OpenAIStrategy.PROVIDER_NAME);
    }
    if (!messages || messages.length === 0) {
      throw new Error('[openai] generateStream: messages array must not be empty.');
    }

    // ── Build request payload ─────────────────────────────────────────────────
    // This is the explicit mapping from our generic format to OpenAI's schema.
    const requestBody = {
      // OpenAI's message format uses the same `role` and `content` fields
      // as our ChatMessage interface, so the mapping is direct.
      messages: messages.map(msg => ({
        role:    msg.role,
        content: msg.content,
      })),

      model:  options.model       ?? OpenAIStrategy.DEFAULT_MODEL,
      stream: true,               // MUST be true to receive SSE chunks

      // Only include optional fields if the caller provided them —
      // omitting them lets OpenAI use its own defaults.
      ...(options.temperature !== undefined && { temperature:            options.temperature }),
      ...(options.maxTokens   !== undefined && { max_completion_tokens:  options.maxTokens   }),
    };

    // ── Make the streaming HTTP request ───────────────────────────────────────
    let response: Response;
    try {
      response = await fetch(OpenAIStrategy.BASE_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          // API key injected here — it never leaves this function scope.
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr) {
      throw new ProviderError(
        OpenAIStrategy.PROVIDER_NAME,
        `Network error: ${(networkErr as Error).message}`
      );
    }

    // ── Handle HTTP-level errors ──────────────────────────────────────────────
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError(OpenAIStrategy.PROVIDER_NAME);
      }

      // For other errors, try to extract OpenAI's error message body.
      const errorBody = await response.text().catch(() => 'Unable to parse error body.');
      throw new ProviderError(
        OpenAIStrategy.PROVIDER_NAME,
        `HTTP ${response.status}: ${errorBody}`
      );
    }

    if (!response.body) {
      throw new ProviderError(OpenAIStrategy.PROVIDER_NAME, 'Response body is null.');
    }

    // ── Parse the SSE stream ──────────────────────────────────────────────────
    // OpenAI sends newline-delimited SSE lines in the format:
    //   data: {"id":"...","choices":[{"delta":{"content":"Hello"},...}]}
    //   data: [DONE]
    //
    // We read the body as text line-by-line and yield content deltas.
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append the latest chunk to our line buffer.
        buffer += decoder.decode(value, { stream: true });

        // Process all complete lines in the buffer.
        const lines = buffer.split('\n');

        // Keep the last (potentially incomplete) line in the buffer.
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines (SSE uses blank lines as event separators).
          if (!trimmed) continue;

          // Strip the "data: " SSE prefix.
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice('data: '.length);

          // The stream ends with the sentinel value [DONE].
          if (jsonStr === '[DONE]') return;

          // Parse the JSON chunk and yield the text delta, if any.
          try {
            const chunk = JSON.parse(jsonStr) as OpenAIStreamChunk;
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch {
            // Malformed JSON in a single chunk — log and skip rather than crash.
            console.warn('[openai] Failed to parse SSE chunk:', jsonStr);
          }
        }
      }
    } finally {
      // Always release the reader lock, even if an error was thrown mid-stream.
      reader.releaseLock();
    }
  }
}
