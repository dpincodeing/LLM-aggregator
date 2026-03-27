import 'dotenv/config';
import * as readline from 'node:readline';
import { encryptKey, decryptKey } from '../utils/crypto.js';
import { StrategyFactory }        from '../llm/llm-factory.js';
import { InvalidApiKeyError, ProviderError, type ChatMessage } from '../llm/ILLMProvider.js';

// =============================================================================
// Terminal Chat Interface
// Type your message and press Enter to chat with the AI.
// Type 'exit' to quit, 'clear' to reset conversation history.
// =============================================================================

const PROVIDER   = 'groq'; // Change to 'openai' or 'anthropic' if needed
const RAW_API_KEY = process.env.GROQ_API_KEY ?? '';

if (!RAW_API_KEY) {
  console.error('\n❌  GROQ_API_KEY is not set in your .env file.');
  console.error('    Add this line to your .env file:');
  console.error('    GROQ_API_KEY=gsk_your_key_here\n');
  process.exit(1);
}

// Encrypt the key once at startup (simulates loading from DB)
const encryptedPayload = encryptKey(RAW_API_KEY);

// Conversation history — grows with every turn so the AI remembers context
const history: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful, friendly assistant. Give clear and concise answers.' },
];

// Set up readline for terminal input
const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

// Coloured terminal helpers
const cyan   = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;

// Print welcome banner
console.log('\n' + cyan('╔════════════════════════════════════════╗'));
console.log(cyan('║       🤖  LLM Aggregator Chat          ║'));
console.log(cyan('╚════════════════════════════════════════╝'));
console.log(dim(`  Provider : ${PROVIDER}`));
console.log(dim('  Commands : "exit" to quit | "clear" to reset\n'));

// Main chat loop
async function chat(userInput: string): Promise<void> {
  if (userInput.toLowerCase() === 'exit') {
    console.log('\n' + yellow('Goodbye! 👋\n'));
    rl.close();
    process.exit(0);
  }

  if (userInput.toLowerCase() === 'clear') {
    // Keep system message, remove everything else
    history.splice(1);
    console.log(yellow('\n🔄 Conversation cleared!\n'));
    prompt();
    return;
  }

  if (!userInput.trim()) {
    prompt();
    return;
  }

  // Add user message to history
  history.push({ role: 'user', content: userInput });

  // Decrypt key and get provider strategy
  const decryptedKey = decryptKey(
    encryptedPayload.cipherText,
    encryptedPayload.iv,
    encryptedPayload.authTag,
  );
  const provider = StrategyFactory.getProvider(PROVIDER);

  // Stream the response
  process.stdout.write(green('\n🤖 Assistant: '));
  let fullResponse = '';

  try {
    for await (const chunk of provider.generateStream(history, decryptedKey)) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }

    // Add assistant response to history for context in next turn
    history.push({ role: 'assistant', content: fullResponse });
    console.log('\n');

  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      console.error('\n❌  Invalid API key. Please check your .env file.\n');
    } else if (err instanceof ProviderError) {
      console.error(`\n❌  Provider error: ${err.message}\n`);
    } else {
      console.error('\n❌  Unexpected error:', err, '\n');
    }
  }

  prompt();
}

function prompt(): void {
  rl.question(cyan('You: '), (input) => {
    chat(input.trim());
  });
}

// Start the chat
prompt();
