import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { decryptKey } from './utils/crypto.js';
import { StrategyFactory, UnknownProviderError } from './llm/llm-factory.js';
import { InvalidApiKeyError, ProviderError } from './llm/ILLMProvider.js';

const app = express();
app.use(cors());
app.use(express.json());

// In a real app, you would fetch this from your database based on the authenticated user.
// For this standalone web app demo, we'll configure a default key or accept it from the frontend.
// The raw key from chat-usage.ts: (Wait, let's just use the process.env.GROQ_API_KEY directly 
// or simulate decryption if they provide encrypted keys. Let's simplify and use the StrategyFactory directly.)

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, providerName = 'groq' } = req.body;
    
    // Fallback key: either they have GROQ_API_KEY in .env, or we use a provided one.
    // For this aggregator demo, since the frontend currently doesn't send a key, 
    // we assume the backend has access to it via process.env.
    const apiKey = process.env.GROQ_API_KEY; 

    if (!apiKey) {
      return res.status(400).json({ error: 'No API key available in backend environment (.env)' });
    }

    const provider = StrategyFactory.getProvider(providerName);
    const userMessages = [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'user' as const, content: message },
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of provider.generateStream(userMessages, apiKey)) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err: any) {
    if (err instanceof UnknownProviderError) {
      return res.status(400).json({ error: `Unsupported provider` });
    }
    if (err instanceof InvalidApiKeyError) {
      return res.status(401).json({ error: 'Invalid API Key' });
    }
    if (err instanceof ProviderError) {
      return res.status(502).json({ error: 'Provider Error: ' + err.message });
    }
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LLM Aggregator API Server running on http://localhost:${PORT}`);
});
