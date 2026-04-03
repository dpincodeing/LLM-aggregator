<div align="center">

# ⚡ LLM Aggregator

### One API. Every Model. Your Keys.

A production-ready, **BYOK (Bring Your Own Key)** AI gateway that lets you switch between any LLM provider — OpenAI, Anthropic, Groq, and more — through a single, unified interface. Built with clean architecture, AES-256-GCM encrypted key storage, and a real-time streaming chat UI.

<br/>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](./LICENSE)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔄 **Unified API** | One `/api/chat` endpoint — switch providers with a single param |
| 🔐 **BYOK Security** | API keys encrypted with AES-256-GCM before touching the database |
| ⚡ **Real-time Streaming** | Server-Sent Events (SSE) for token-by-token streaming responses |
| 🏗️ **Strategy Pattern** | Clean, extensible architecture — add a new LLM in < 50 lines |
| 🎨 **Premium Chat UI** | Dark-mode React frontend with animated streaming output |
| 🗃️ **Type-safe ORM** | Prisma + PostgreSQL — fully typed DB access |
| 🔁 **Hot Reload Dev** | `tsx watch` on backend, Vite HMR on frontend |

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       React Frontend                     │
│           Vite · TypeScript · lucide-react               │
│   ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ Sidebar  │  │ ChatInterface│  │    Dashboard     │  │
│   └──────────┘  └──────┬───────┘  └──────────────────┘  │
│                         │ SSE /api/chat                   │
└─────────────────────────┼───────────────────────────────┘
                          │ Vite Proxy → :3000
┌─────────────────────────▼───────────────────────────────┐
│                   Express Backend  :3000                  │
│                                                          │
│  POST /api/chat                                          │
│        │                                                 │
│        ▼                                                 │
│  ┌─────────────────────────────────────┐                 │
│  │          Strategy Factory           │                 │
│  │  getProvider(providerName: string)  │                 │
│  └──┬───────────┬─────────────┬────────┘                 │
│     │           │             │                          │
│     ▼           ▼             ▼                          │
│  ┌──────┐  ┌─────────┐  ┌─────────┐                     │
│  │ Groq │  │ OpenAI  │  │Anthropic│  ← ILLMProvider     │
│  └──────┘  └─────────┘  └─────────┘                     │
│                                                          │
│  ┌──────────────────────────────────┐                    │
│  │ AES-256-GCM Key Vault (Prisma)   │                    │
│  │  encrypt(key) → store in DB      │                    │
│  │  decrypt(record) → use at call   │                    │
│  └──────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────▼──────────┐
              │  PostgreSQL Database  │
              │  Users · Providers   │
              │      UserKeys        │
              └──────────────────────┘
```

---

## 📁 Project Structure

```
llm-aggregator/
├── 📁 src/                        # Express backend
│   ├── server.ts                  # API server entry point
│   ├── 📁 llm/
│   │   ├── ILLMProvider.ts        # Strategy interface + typed errors
│   │   ├── llm-factory.ts         # StrategyFactory (provider registry)
│   │   └── 📁 strategies/
│   │       ├── OpenAIStrategy.ts  # OpenAI streaming adapter
│   │       ├── AnthropicStrategy.ts # Anthropic streaming adapter
│   │       └── GroqStrategy.ts    # Groq streaming adapter
│   ├── 📁 utils/
│   │   └── crypto.ts              # AES-256-GCM encrypt/decrypt
│   └── 📁 examples/
│       └── chat-usage.ts          # CLI usage example
│
├── 📁 frontend/                   # React + Vite frontend
│   ├── 📁 src/
│   │   ├── App.tsx                # Root component + routing
│   │   ├── 📁 components/
│   │   │   ├── ChatInterface.tsx  # SSE streaming chat UI
│   │   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   │   ├── Dashboard.tsx      # Stats & provider overview
│   │   │   └── Hero.tsx           # Landing hero section
│   │   └── index.css              # Global design system
│   └── vite.config.ts             # Dev proxy → :3000
│
├── 📁 prisma/
│   └── schema.prisma              # DB schema (Users, Providers, UserKeys)
│
├── .env.example                   # Environment variable template
├── package.json                   # Backend scripts & dependencies
└── tsconfig.json                  # TypeScript config
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** database (or use [Railway](https://railway.app) / [Supabase](https://supabase.com) for free)
- An API key from any supported provider

### 1. Clone & Install

```bash
git clone https://github.com/dpincodeing/LLM-aggregator.git
cd LLM-aggregator

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# PostgreSQL — use Railway, Supabase, or local Postgres
DATABASE_URL="postgresql://postgres:password@localhost:5432/llm_aggregator"

# Generate a secure 32-byte key:  openssl rand -hex 32
ENCRYPTION_KEY="your_64_char_hex_string_here"

# Add your provider API key(s)
GROQ_API_KEY="gsk_..."
# OPENAI_API_KEY="sk-..."
# ANTHROPIC_API_KEY="sk-ant-..."
```

### 3. Set Up the Database

```bash
# Run migrations
npm run db:migrate

# Seed supported providers
psql $DATABASE_URL -c "
INSERT INTO providers (id, display_name, base_url, default_model, is_enabled) VALUES
  ('groq',      'Groq',          'https://api.groq.com/openai/v1',               'llama-3.3-70b-versatile', true),
  ('openai',    'OpenAI',        'https://api.openai.com/v1/chat/completions',    'gpt-4o',                  true),
  ('anthropic', 'Anthropic',     'https://api.anthropic.com/v1/messages',         'claude-opus-4-5',         true)
ON CONFLICT DO NOTHING;"
```

### 4. Run in Development

```bash
# Terminal 1 — Start the Express API server
npm run dev          # → http://localhost:3000

# Terminal 2 — Start the Vite frontend
cd frontend
npm run dev          # → http://localhost:5173
```

Open **http://localhost:5173** and start chatting! 🎉

---

## 🔌 API Reference

### `POST /api/chat`

Streams a chat response using Server-Sent Events (SSE).

**Request Body**
```json
{
  "message": "Explain the strategy pattern in TypeScript",
  "providerName": "groq"
}
```

**Supported `providerName` values:** `"groq"` · `"openai"` · `"anthropic"`

**Response** — `text/event-stream`
```
data: {"text":"The"}
data: {"text":" strategy"}
data: {"text":" pattern..."}
data: [DONE]
```

**cURL Example**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "providerName": "groq"}' \
  --no-buffer
```

---

## 🔐 Security Model

All user API keys are encrypted **before** they ever reach the database:

```
User Key (plaintext)
       │
       ▼
AES-256-GCM encrypt(key, iv, authTag)
       │
       ▼
{ encryptedKey, iv, authTag }  →  stored in UserKeys table
```

The `ENCRYPTION_KEY` env variable is the only secret needed to decrypt keys at runtime — it **never** enters the database.

---

## 🛠️ Adding a New LLM Provider

Implement the `ILLMProvider` interface and register it in the factory — that's it:

```typescript
// src/llm/strategies/MyProviderStrategy.ts
import { ILLMProvider, Message } from '../ILLMProvider.js';

export class MyProviderStrategy implements ILLMProvider {
  async *generateStream(messages: Message[], apiKey: string) {
    // Your streaming logic here
    yield 'Hello ';
    yield 'from my provider!';
  }
}
```

```typescript
// src/llm/llm-factory.ts — add one line:
case 'myprovider': return new MyProviderStrategy();
```

---

## 📦 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Express API with hot reload (`tsx watch`) |
| `npm run chat` | Run interactive CLI chat example |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `cd frontend && npm run dev` | Start Vite frontend dev server |
| `cd frontend && npm run build` | Build frontend for production |

---

## 🧰 Tech Stack

**Backend**
- [Express 5](https://expressjs.com/) — HTTP server with async error handling
- [tsx](https://github.com/privatenumber/tsx) — TypeScript execution with hot reload
- [Prisma](https://prisma.io) — Type-safe PostgreSQL ORM
- Node.js `crypto` — AES-256-GCM key encryption

**Frontend**
- [React 18](https://react.dev/) — UI library
- [Vite 5](https://vitejs.dev/) — Dev server + bundler
- [lucide-react](https://lucide.dev/) — Icon system
- Server-Sent Events (native) — Real-time streaming

---

## 🗺️ Roadmap

- [ ] Multi-turn conversation memory
- [ ] Per-user API key management UI
- [ ] Token usage tracking & cost estimation dashboard
- [ ] Support for Google Gemini & Perplexity
- [ ] Rate limiting & request queuing
- [ ] Docker Compose deployment config

---

## 📄 License

MIT © [dpincodeing](https://github.com/dpincodeing)

---

<div align="center">

**If this helped you, drop a ⭐ — it means a lot!**

Made with precision and obsession over clean architecture.

</div>
