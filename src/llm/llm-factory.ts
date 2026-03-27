
// =============================================================================
// FILE: src/llm/llm-factory.ts
// PURPOSE: Factory that maps a provider name to an instantiated strategy class.
//
// DESIGN PATTERN — Factory + Strategy:
//   The Factory encapsulates the "which strategy to create" decision.
//   The Strategy interface (ILLMProvider) decouples the factory's output
//   from the calling code — callers never reference OpenAIStrategy directly.
//
// ADDING A NEW PROVIDER:
//   1. Create `src/llm/strategies/GeminiStrategy.ts` implementing ILLMProvider.
//   2. Import it here.
//   3. Add an entry to `STRATEGY_REGISTRY` below.
//   That's it — no changes required in any controller or service.
//
// THREAD SAFETY:
//   `getProvider()` instantiates a new strategy object on every call.
//   Strategies hold no shared mutable state so this is safe. If instantiation
//   cost becomes a concern, add a lazy singleton cache keyed by provider name.
// =============================================================================

import { type ILLMProvider } from './ILLMProvider.js';
import { OpenAIStrategy }    from './strategies/OpenAIStrategy.js';
import { AnthropicStrategy } from './strategies/AnthropicStrategy.js';
import { GroqStrategy } from './strategies/GroqStrategy.js';

// ── Supported provider names ──────────────────────────────────────────────────

/**
 * The set of provider slugs that the factory recognises.
 * These match the `id` column in the `Provider` database table.
 */
export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'perplexity'|'groq';

// ── Strategy Registry ─────────────────────────────────────────────────────────

/**
 * A constructor type for any class that implements ILLMProvider.
 * Using a constructor map (rather than instance map) means each `getProvider()`
 * call gets a fresh instance — safe for concurrent requests.
 */
type LLMProviderConstructor = new () => ILLMProvider;

/**
 * The registry maps each provider slug to its strategy constructor.
 *
 * `as const satisfies` gives us:
 *   - TypeScript narrows the keys to the exact literal strings.
 *   - The compiler verifies every value implements ILLMProvider's constructor shape.
 *   - Adding a new key that isn't in ProviderName is a compile-time error.
 */
const STRATEGY_REGISTRY: Record<ProviderName, LLMProviderConstructor> = {
  openai:     OpenAIStrategy,
  anthropic:  AnthropicStrategy,
  groq:       GroqStrategy,

  // ── Stubs for future providers ─────

  // ── Stubs for future providers ────────────────────────────────────────────
  // Replace these with real implementations as they are built.
  // They are typed here so that callers can reference 'gemini' / 'perplexity'
  // without a runtime crash during the development phase.
  gemini:     class GeminiStub implements ILLMProvider {
    async *generateStream(): AsyncIterable<string> {
      throw new UnsupportedProviderError('gemini');
    }
  },
  perplexity: class PerplexityStub implements ILLMProvider {
    async *generateStream(): AsyncIterable<string> {
      throw new UnsupportedProviderError('perplexity');
    }
  },
};

// ── Factory Class ─────────────────────────────────────────────────────────────

/**
 * StrategyFactory — resolves a provider name to a ready-to-use ILLMProvider.
 *
 * Usage:
 * ```ts
 * const provider = StrategyFactory.getProvider('openai');
 * for await (const chunk of provider.generateStream(messages, decryptedKey)) {
 *   res.write(chunk);
 * }
 * ```
 */
export class StrategyFactory {
  /**
   * Returns an instantiated ILLMProvider strategy for the given provider name.
   *
   * @param providerName  The slug identifying the LLM provider.
   *                      Must match a key in STRATEGY_REGISTRY.
   * @returns             A fresh ILLMProvider instance ready for use.
   * @throws {UnknownProviderError}  If providerName is not in the registry.
   */
  static getProvider(providerName: string): ILLMProvider {
    // Normalise casing to guard against accidental 'OpenAI' vs 'openai' mismatches.
    const normalised = providerName.toLowerCase().trim() as ProviderName;

    const StrategyClass = STRATEGY_REGISTRY[normalised];

    if (!StrategyClass) {
      throw new UnknownProviderError(providerName);
    }

    // Instantiate a new strategy. No arguments needed — the decrypted API key
    // is passed per-call to generateStream(), not stored on the instance.
    return new StrategyClass();
  }

  /**
   * Returns the list of currently registered (and non-stub) provider slugs.
   * Useful for validation in the key-registration endpoint.
   */
  static getSupportedProviders(): ProviderName[] {
    return Object.keys(STRATEGY_REGISTRY) as ProviderName[];
  }
}

// ── Factory-specific Error Classes ────────────────────────────────────────────

/** Thrown when an unrecognised provider slug is passed to the factory. */
export class UnknownProviderError extends Error {
  constructor(providerName: string) {
    const supported = Object.keys(STRATEGY_REGISTRY).join(', ');
    super(
      `[StrategyFactory] Unknown provider: "${providerName}". ` +
      `Supported providers: ${supported}`
    );
    this.name = 'UnknownProviderError';
  }
}

/** Thrown by stub strategies for providers not yet implemented. */
export class UnsupportedProviderError extends Error {
  constructor(providerName: string) {
    super(
      `[StrategyFactory] Provider "${providerName}" is recognised but not yet ` +
      `implemented. Check back soon or contribute a strategy class.`
    );
    this.name = 'UnsupportedProviderError';
  }
}
