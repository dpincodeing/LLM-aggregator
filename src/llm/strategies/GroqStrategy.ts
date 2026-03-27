import {
    type ILLMProvider,
    type ChatMessage,
    type GenerationOptions,
    InvalidApiKeyError,
    ProviderError,
  } from '../ILLMProvider.js';
  
  export class GroqStrategy implements ILLMProvider {
    private static readonly BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
    private static readonly DEFAULT_MODEL = 'llama-3.1-8b-instant';
    private static readonly PROVIDER_NAME = 'groq';
  
    async *generateStream(
      messages: ChatMessage[],
      apiKey: string,
      options: GenerationOptions = {},
    ): AsyncIterable<string> {
  
      if (!apiKey || apiKey.trim().length === 0) {
        throw new InvalidApiKeyError(GroqStrategy.PROVIDER_NAME);
      }
  
      const requestBody = {
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        model: options.model ?? GroqStrategy.DEFAULT_MODEL,
        stream: true,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
      };
  
      let response: Response;
      try {
        response = await fetch(GroqStrategy.BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });
      } catch (networkErr) {
        throw new ProviderError(GroqStrategy.PROVIDER_NAME, `Network error: ${(networkErr as Error).message}`);
      }
  
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new InvalidApiKeyError(GroqStrategy.PROVIDER_NAME);
        }
        const errorBody = await response.text().catch(() => 'Unable to parse error body.');
        throw new ProviderError(GroqStrategy.PROVIDER_NAME, `HTTP ${response.status}: ${errorBody}`);
      }
  
      if (!response.body) {
        throw new ProviderError(GroqStrategy.PROVIDER_NAME, 'Response body is null.');
      }
  
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
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice('data: '.length);
            if (jsonStr === '[DONE]') return;
            try {
              const chunk = JSON.parse(jsonStr);
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) yield delta;
            } catch {
              console.warn('[groq] Failed to parse SSE chunk:', jsonStr);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }