# LLM Aggregator Backend

Unified AI aggregator backend with BYOK (Bring Your Own Key) support for OpenAI, Anthropic, Gemini, and Perplexity.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Then edit `.env`:
- Set `DATABASE_URL` to your PostgreSQL connection string
- Set `ENCRYPTION_KEY` by running: `openssl rand -hex 32`

### 3. Set up the database
```bash
npx prisma migrate dev --name init
```

### 4. Seed providers
Run this SQL in your database:
```sql
INSERT INTO providers (id, display_name, base_url, default_model, is_enabled) VALUES
  ('openai',     'OpenAI',        'https://api.openai.com/v1/chat/completions',   'gpt-4o',            true),
  ('anthropic',  'Anthropic',     'https://api.anthropic.com/v1/messages',        'claude-opus-4-5',   true),
  ('gemini',     'Google Gemini', 'https://generativelanguage.googleapis.com',    'gemini-1.5-pro',    false),
  ('perplexity', 'Perplexity',    'https://api.perplexity.ai/chat/completions',   'sonar-pro',         false);
```

### 5. Run the example
Edit `src/examples/chat-usage.ts` and replace the placeholder API key with your real key, then:
```bash
npx tsx src/examples/chat-usage.ts
```

### 6. Build for production
```bash
npm run build
node dist/examples/chat-usage.js
```

## Project Structure
```
prisma/
  schema.prisma         # Database schema (Users, Providers, UserKeys)
src/
  utils/
    crypto.ts           # AES-256-GCM encrypt/decrypt utility
  llm/
    ILLMProvider.ts     # Strategy interface + typed errors
    llm-factory.ts      # StrategyFactory — maps provider name → strategy
    strategies/
      OpenAIStrategy.ts    # OpenAI streaming implementation
      AnthropicStrategy.ts # Anthropic streaming implementation
  examples/
    chat-usage.ts       # End-to-end usage example
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | 64-char hex string (32 bytes) for AES-256-GCM |
