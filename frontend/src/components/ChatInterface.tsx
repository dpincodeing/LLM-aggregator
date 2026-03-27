import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'bot';
  content: string;
}

const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'bot', content: 'Hello! I am your premium AI assistant powered by your aggregated LLMs. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userText = input;
    setInput('');
    
    const newUserMsg: Message = { id: Date.now(), role: 'user', content: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsTyping(true);

    const botMsgId = Date.now() + 1;
    // Add empty bot message initially to stream into
    setMessages(prev => [...prev, { id: botMsgId, role: 'bot', content: '' }]);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, providerName: 'groq' })
      });

      if (!response.ok || !response.body) {
         let errorText = 'Backend Error';
         try {
           const errData = await response.json();
           errorText = errData.error || errorText;
         } catch {}
         setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: 'Error: ' + errorText } : m));
         setIsTyping(false);
         return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              setIsTyping(false);
              return;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                setMessages(prev => prev.map(m => {
                  if (m.id === botMsgId) {
                    return { ...m, content: m.content + data.text };
                  }
                  return m;
                }));
              }
            } catch (e) {
              // Ignore parse errors on partial chunks
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: 'Failed to connect to backend api.' } : m));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2><Bot size={24} color="var(--accent-primary)" /> Play Assistant</h2>
        <div className="status-badge"><div className="status-dot"></div> ONLINE</div>
      </div>
      
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message-wrapper ${msg.role}`}>
            <div className={`message-avatar ${msg.role}`}>
              {msg.role === 'bot' ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className={`message-bubble ${msg.role}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="message-wrapper bot">
             <div className="message-avatar bot"><Bot size={18} /></div>
             <div className="message-bubble bot" style={{ fontStyle: 'italic', opacity: 0.7 }}>
               Generating...
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-area">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything or prompt your model..." 
          className="chat-input"
          disabled={isTyping}
        />
        <button onClick={handleSend} className="btn-send" disabled={isTyping} style={{ opacity: isTyping ? 0.5 : 1 }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInterface;
