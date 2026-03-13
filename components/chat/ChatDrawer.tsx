'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useFitClaude } from '@/context/FitClaudeContext';

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${listKey++}`} className="list-disc list-inside space-y-1 my-1">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // List items: - text or * text or numbered 1. text
    const listMatch = line.match(/^[\s]*[-*]\s+(.+)/) || line.match(/^[\s]*\d+\.\s+(.+)/);
    if (listMatch) {
      listItems.push(
        <li key={`li-${i}`} className="text-slate-200">
          {renderInline(listMatch[1], i)}
        </li>
      );
      continue;
    }

    flushList();

    // Empty line
    if (line.trim() === '') {
      nodes.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    // Headers: ### text, ## text, # text
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      nodes.push(
        <p key={`h3-${i}`} className="font-semibold text-white text-[15px] mt-3 mb-1">
          {renderInline(h3Match[1], i)}
        </p>
      );
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      nodes.push(
        <p key={`h2-${i}`} className="font-bold text-white text-[16px] mt-3 mb-1">
          {renderInline(h2Match[1], i)}
        </p>
      );
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      nodes.push(
        <p key={`h1-${i}`} className="font-bold text-white text-[17px] mt-3 mb-1">
          {renderInline(h1Match[1], i)}
        </p>
      );
      continue;
    }

    // Regular paragraph line
    nodes.push(
      <span key={`p-${i}`}>
        {i > 0 && lines[i - 1].trim() !== '' && <br />}
        {renderInline(line, i)}
      </span>
    );
  }

  flushList();
  return nodes;
}

function renderInline(text: string, lineIdx: number): React.ReactNode[] {
  // Handle bold and inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${lineIdx}-b-${j}`} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`${lineIdx}-c-${j}`} className="bg-slate-700/60 text-primary-light px-1.5 py-0.5 rounded text-[13px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${lineIdx}-t-${j}`}>{part}</React.Fragment>;
  });
}

export function ChatDrawer() {
  const {
    messages,
    chatLoading,
    chatOpen,
    chatTopic,
    setChatOpen,
    setChatTopic,
    sendMessage,
  } = useFitClaude();
  const pathname = usePathname();

  // Auto-switch chat topic based on current page
  useEffect(() => {
    if (pathname.startsWith('/nutrition')) {
      setChatTopic('nutrition');
    } else if (pathname === '/' || pathname.startsWith('/workouts')) {
      setChatTopic('workout');
    }
  }, [pathname, setChatTopic]);

  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mediaType: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [chatOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress image via canvas to reduce payload size
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1200;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImagePreview(dataUrl);
      setImageData({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => {
      // Fallback: send raw if canvas fails
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setImageData({ base64: result.split(',')[1], mediaType: file.type });
      };
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
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

  const hiddenFileInput = (
    <input
      type="file"
      ref={fileInputRef}
      onChange={handleImageUpload}
      accept="image/*"
      className="hidden"
    />
  );

  // ── Collapsed: Claude-style input bar ──
  if (!chatOpen) {
    return (
      <div className="shrink-0 px-3 py-2 bg-background border-t border-primary/20">
        {hiddenFileInput}
        <div
          className="flex items-center gap-2 bg-slate-800/70 border border-primary/30 rounded-2xl px-3 py-2.5 cursor-text shadow-[0_0_12px_rgba(16,185,129,0.08)] active:scale-[0.98] active:bg-slate-800/90 transition-all"
          onClick={() => setChatOpen(true)}
        >
          {/* Coach avatar */}
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <span className="text-slate-400 text-sm flex-1">
            {chatTopic === 'nutrition' ? 'Log food, snap a label...' : 'Message Coach Fit...'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="w-9 h-9 rounded-full hover:bg-slate-700/60 active:bg-slate-700/80 flex items-center justify-center text-slate-500 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded: Claude.ai-style chat ──
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={() => setChatOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed left-0 right-0 bottom-0 z-50 h-[50vh] flex flex-col bg-background rounded-t-2xl shadow-2xl">
        {/* Drag handle + header */}
        <div className="shrink-0">
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 rounded-full bg-slate-700" />
          </div>
          <div className="flex items-center justify-between px-4 pb-2">
            <div className="flex items-center gap-2.5">
              {/* Coach avatar */}
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">
                Coach Fit
              </span>
              <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full capitalize">
                {chatTopic}
              </span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-8">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-white mb-1">Coach Fit</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Create workouts, log food, track progress,<br />
                  or ask anything fitness-related.
                </p>
              </div>
            </div>
          )}

          <div className="px-4 py-3 space-y-5">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  /* User message — right-aligned subtle bubble */
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-slate-700/50 text-white rounded-2xl rounded-br-md px-4 py-3">
                      {msg.imageUrl && !msg.imageUrl.includes('...') && (
                        <img
                          src={msg.imageUrl}
                          alt="Uploaded"
                          className="max-w-full rounded-lg mb-2 max-h-40 object-cover"
                        />
                      )}
                      <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Assistant message — full-width, no bubble, with avatar */
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] leading-relaxed text-slate-200">
                        {renderMarkdown(msg.content)}
                      </div>
                      {msg.modelUsed && (
                        <span className={`mt-1.5 inline-block text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          msg.modelUsed.includes('MiniMax')
                            ? 'bg-amber-900/40 text-amber-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}>
                          {msg.modelUsed.includes('MiniMax') ? 'MiniMax (fallback)' : 'Haiku'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator — pulsing bar like Claude.ai */}
            {chatLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '100ms', animationDuration: '0.6s' }} />
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '0.6s' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="px-5 py-2 shrink-0">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-16 rounded-xl border border-slate-700" />
              <button
                onClick={clearImage}
                className="absolute -top-3 -right-3 w-8 h-8 bg-slate-600 hover:bg-danger active:bg-danger rounded-full flex items-center justify-center text-white transition-colors active:scale-[0.95]"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Input — Claude.ai style: everything inside one rounded container */}
        <div className="px-3 py-3 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          {hiddenFileInput}
          <div className="flex items-end gap-0 bg-slate-800/60 border border-slate-700/50 rounded-2xl px-2 py-1.5">
            {/* + attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 rounded-full hover:bg-slate-700/60 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0 mb-0.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>

            {/* Textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={chatTopic === 'nutrition' ? 'Log food, snap a label...' : 'Message Coach Fit...'}
              rows={1}
              className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none resize-none text-[15px] leading-relaxed py-1.5 px-2 max-h-[120px]"
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={chatLoading || (!input.trim() && !imageData)}
              className="w-8 h-8 rounded-full bg-primary hover:bg-primary-dark disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors shrink-0 mb-0.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
