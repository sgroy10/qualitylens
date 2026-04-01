import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const LANGUAGES = [
  { code: 'en', name: 'English', greeting: 'Ask me anything about QC specs...' },
  { code: 'hi', name: 'Hindi', greeting: 'QC specs ke baare mein kuch bhi poochein...' },
  { code: 'mr', name: 'Marathi', greeting: 'QC specs baddal kahihi vichara...' },
  { code: 'gu', name: 'Gujarati', greeting: 'QC specs vishe kaipu puchho...' },
  { code: 'bn', name: 'Bengali', greeting: 'QC specs somporke jiggyasa korun...' },
  { code: 'ta', name: 'Tamil', greeting: 'QC specs patri ethaiyum kelung...' },
  { code: 'te', name: 'Telugu', greeting: 'QC specs gurinchi emaina adagandi...' },
  { code: 'kn', name: 'Kannada', greeting: 'QC specs bagge yenaadaruu keli...' },
  { code: 'ml', name: 'Malayalam', greeting: 'QC specs nekkurich enthenkilum chodichu...' },
  { code: 'pa', name: 'Punjabi', greeting: 'QC specs baare kujh vi puchho...' },
  { code: 'or', name: 'Odia', greeting: 'QC specs bisayare kichhi bi puchhantu...' },
  { code: 'ur', name: 'Urdu', greeting: 'QC specs ke baare mein kuch bhi poochein...' },
];

const QUICK_QUESTIONS = {
  en: [
    { q: "What post type is required for 9KT earrings?", icon: "💎" },
    { q: "What is the minimum shank thickness for non-solitaire rings?", icon: "💍" },
    { q: "What alloys are approved for 18KT yellow gold?", icon: "🥇" },
    { q: "What are the weight tolerance limits?", icon: "⚖️" },
    { q: "What rhodium plating thickness is required?", icon: "✨" },
    { q: "What findings are required for a pendant?", icon: "📿" },
    { q: "What defects cause rejection at third party QC?", icon: "🔍" },
    { q: "What is the hallmark placement requirement?", icon: "🏷️" },
  ],
  hi: [
    { q: "9KT earrings ke liye kaun sa post chahiye?", icon: "💎" },
    { q: "Ring ki minimum shank thickness kya hai?", icon: "💍" },
    { q: "18KT yellow gold ke liye approved alloys kaunse hain?", icon: "🥇" },
    { q: "Weight tolerance limits kya hain?", icon: "⚖️" },
    { q: "Rhodium plating ki thickness kitni honi chahiye?", icon: "✨" },
    { q: "Pendant ke liye kaun se findings chahiye?", icon: "📿" },
    { q: "Third party QC mein rejection kab hota hai?", icon: "🔍" },
    { q: "Hallmark kahan lagana chahiye?", icon: "🏷️" },
  ],
};

function formatMessage(text) {
  // Convert markdown-like formatting to styled spans
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-navy">$1</strong>')
    .replace(/⚠️?\s*(.*?)(?=\n|$)/g, '<span class="text-red-600 font-semibold">⚠ $1</span>')
    .replace(/✅\s*(.*?)(?=\n|$)/g, '<span class="text-green-600">✅ $1</span>')
    .replace(/📋\s*(.*?)(?=\n|$)/g, '<span class="text-accent">📋 $1</span>')
    .replace(/🔍\s*(.*?)(?=\n|$)/g, '<span class="text-purple-600">🔍 $1</span>')
    .replace(/\n/g, '<br/>');
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('en');
  const [detectedLang, setDetectedLang] = useState(null);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers').then(r => r.data)
  });

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  const sendMessage = async (overrideMsg) => {
    const msg = overrideMsg || input.trim();
    if (!msg) return;

    const userMsg = { role: 'user', content: msg, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setDetectedLang(null);

    try {
      const token = localStorage.getItem('token');
      // Send conversation history for context continuity
      const recentHistory = [...messages.slice(-10), userMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: msg,
          customer_id: customerId || undefined,
          history: recentHistory
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', time: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.replace('data: ', '');
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.meta?.language) {
              setDetectedLang(parsed.meta.language);
            }
            if (parsed.text) {
              aiContent += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: aiContent };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        time: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setDetectedLang(null);
  };

  const questions = QUICK_QUESTIONS[lang] || QUICK_QUESTIONS.en;
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center">
            <span className="text-white text-lg">🔍</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy">QualityLens AI</h1>
            <p className="text-xs text-gray-400">Jewelry QC Expert &bull; Manual Master &bull; Audit Mentor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {detectedLang && (
            <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full">
              Responding in {detectedLang}
            </span>
          )}
          <select
            className="input w-36 text-sm"
            value={lang}
            onChange={e => setLang(e.target.value)}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
          <select
            className="input w-44 text-sm"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
          >
            <option value="">All Manuals</option>
            {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {messages.length > 0 && (
            <button onClick={clearChat} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white mb-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            {/* Hero */}
            <div className="w-20 h-20 bg-gradient-to-br from-navy to-accent rounded-2xl flex items-center justify-center mb-5 shadow-lg">
              <span className="text-4xl">🔍</span>
            </div>
            <h2 className="text-2xl font-bold text-navy mb-2">QualityLens AI</h2>
            <p className="text-gray-500 text-sm mb-1 text-center max-w-md">
              Your strict QC auditor, expert mentor, and manual master — all in one.
            </p>
            <p className="text-gray-400 text-xs mb-6 text-center max-w-md">
              I've studied every page of the customer's QA manual. Ask me anything in any Indian language.
            </p>

            {/* Language pills */}
            <div className="flex flex-wrap gap-1.5 justify-center mb-6 max-w-lg">
              {LANGUAGES.map(l => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`text-xs px-2.5 py-1 rounded-full transition ${
                    lang === l.code
                      ? 'bg-navy text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-accent/10 hover:text-accent'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>

            {/* Quick questions */}
            <div className="grid grid-cols-2 gap-2 max-w-xl w-full">
              {questions.map(({ q, icon }) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="flex items-start gap-2 text-left text-xs bg-gray-50 hover:bg-accent/5 hover:border-accent/30 border border-gray-100 text-gray-600 px-3 py-2.5 rounded-lg transition group"
                >
                  <span className="text-base mt-0.5 group-hover:scale-110 transition">{icon}</span>
                  <span className="leading-relaxed">{q}</span>
                </button>
              ))}
            </div>

            {/* Capabilities */}
            <div className="flex gap-6 mt-8 text-center">
              <div className="text-xs text-gray-400">
                <div className="text-lg mb-1">📋</div>
                <div>Cites exact<br/>manual pages</div>
              </div>
              <div className="text-xs text-gray-400">
                <div className="text-lg mb-1">⚠️</div>
                <div>Flags rejection<br/>risks</div>
              </div>
              <div className="text-xs text-gray-400">
                <div className="text-lg mb-1">🌐</div>
                <div>22 Indian<br/>languages</div>
              </div>
              <div className="text-xs text-gray-400">
                <div className="text-lg mb-1">🔍</div>
                <div>Cross-references<br/>specs</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-sm">QL</span>
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-navy text-white rounded-tr-md'
                    : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-tl-md'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div
                      className="text-sm leading-relaxed prose-sm"
                      dangerouslySetInnerHTML={{ __html: formatMessage(msg.content || (loading && i === messages.length - 1 ? '<span class="animate-pulse text-gray-400">Analyzing manual...</span>' : '')) }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-white/40' : 'text-gray-300'}`}>
                    {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-white text-sm">You</span>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEnd} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition text-sm bg-white"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={currentLang.greeting}
            disabled={loading}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-navy text-white px-5 py-3 rounded-xl hover:bg-opacity-90 transition font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
