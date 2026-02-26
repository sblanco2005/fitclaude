'use client';

import { useState, useRef, useEffect } from 'react';
import { useFitClaude } from '@/context/FitClaudeContext';
import type { ChatTopic } from '@/context/FitClaudeContext';

export default function ChatPage() {
  const { messages, chatLoading, sendMessage, chatTopic, setChatTopic } = useFitClaude();
  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mediaType: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const mediaType = file.type;
      setImagePreview(result);
      setImageData({ base64, mediaType });
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!input.trim() && !imageData) return;
    const text = input;
    setInput('');
    clearImage();
    await sendMessage(text, imageData?.base64, imageData?.mediaType);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const topics: { key: ChatTopic; label: string }[] = [
    { key: 'workout', label: 'Workouts' },
    { key: 'nutrition', label: 'Nutrition' },
  ];

  const placeholders: Record<ChatTopic, string> = {
    workout: 'Ask about workouts, routines, exercises...',
    nutrition: 'Log food, ask about macros, meal ideas...',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Topic toggle */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
          {topics.map((t) => (
            <button
              key={t.key}
              onClick={() => setChatTopic(t.key)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                chatTopic === t.key
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted px-6">
              <p className="text-lg font-bold tracking-wide">Coach Fit</p>
              <p className="text-sm mt-1">
                {chatTopic === 'workout'
                  ? 'Ask me to create a workout, suggest exercises, or track your training.'
                  : 'Tell me what you ate, ask about macros, or get meal suggestions.'}
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'glass text-slate-200 rounded-bl-md'
              }`}
            >
              {msg.imageUrl && !msg.imageUrl.includes('...') && (
                <img
                  src={msg.imageUrl}
                  alt="Uploaded"
                  className="max-w-full rounded-lg mb-2 max-h-48 object-cover"
                />
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
              {msg.role === 'assistant' && msg.modelUsed && (
                <span className={`mt-1.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  msg.modelUsed.includes('MiniMax')
                    ? 'bg-amber-900/40 text-amber-400'
                    : 'bg-slate-800/60 text-slate-500'
                }`}>
                  {msg.modelUsed.includes('MiniMax') ? 'MiniMax (fallback)' : 'Haiku'}
                </span>
              )}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 py-2 border-t border-border-dark">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-16 rounded-lg" />
            <button
              onClick={clearImage}
              className="absolute -top-2 -right-2 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-white text-xs"
            >
              x
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border-dark">
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-muted hover:text-white transition-colors flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholders[chatTopic]}
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || (!input.trim() && !imageData)}
            className="p-2 bg-primary rounded-xl text-white disabled:opacity-50 transition-colors hover:bg-primary-dark flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
