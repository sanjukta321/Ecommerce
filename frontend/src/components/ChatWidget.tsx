import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { post } from '../services/client';
import '../styles/ChatWidget.css';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

interface ChatResponse {
  message: { response: string };
}

const WELCOME: Message = {
  role: 'bot',
  content: "Hi! I'm your SB Store assistant. Ask me about your orders, products, returns, or anything else I can help with.",
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  const buildHistory = (msgs: Message[]) =>
    msgs
      .filter(m => m.role === 'user' || m.role === 'bot')
      .slice(-20)
      .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }));

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const history = buildHistory(messages);
      const res = await post<ChatResponse>(
        '/api/method/store_customizations.api.chatbot.chat',
        { message: text, history: JSON.stringify(history) }
      );
      const botText = res?.message?.response ?? "Sorry, I couldn't get a response. Please try again.";
      setMessages(prev => [...prev, { role: 'bot', content: botText }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: "Sorry, something went wrong. Please try again in a moment." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-avatar">
              <Bot />
            </div>
            <div className="chat-header-info">
              <div className="chat-header-title">SB Store Support</div>
              <div className="chat-header-status">Online</div>
            </div>
            <button className="chat-close-btn" onClick={() => setIsOpen(false)} aria-label="Close chat">
              <X size={18} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      <button
        className="chat-widget-btn"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Customer support chat"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </>
  );
}
