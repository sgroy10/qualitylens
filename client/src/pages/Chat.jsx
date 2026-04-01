import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers').then(r => r.data) });

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: input, customer_id: customerId || undefined })
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', time: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "What post is required for 9KT earrings?",
    "What is the shank thickness spec for non-solitaire rings?",
    "What alloys are approved for 18KT yellow gold?",
    "What are the tolerance limits for gross weight?",
    "What findings are required for pendant?"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-navy">AI QC Assistant</h1>
        <select className="input w-48" value={customerId} onChange={e => setCustomerId(e.target.value)}>
          <option value="">All Manuals</option>
          {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto card mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">💬</div>
            <h2 className="text-lg font-semibold text-navy mb-2">Ask QualityLens AI</h2>
            <p className="text-gray-500 text-sm mb-6">Ask questions about QC specs, tolerances, and requirements from customer manuals.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickQuestions.map(q => (
                <button key={q} onClick={() => { setInput(q); }} className="text-xs bg-gray-100 hover:bg-accent hover:text-white text-gray-600 px-3 py-2 rounded-full transition">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-navy text-white' : 'bg-gray-100 text-gray-800'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}{msg.role === 'assistant' && !msg.content && loading ? '...' : ''}</p>
                <p className="text-xs mt-1 opacity-50">{new Date(msg.time).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEnd} />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask about QC specs, tolerances, findings..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary">
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
