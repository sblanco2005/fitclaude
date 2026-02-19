'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { UserProfile, Workout, DailyNutrition, ChatMessage } from '@/types';
import { useSession } from 'next-auth/react';

interface FitClaudeState {
  profile: UserProfile | null;
  todayWorkout: Workout | null;
  todayNutrition: DailyNutrition | null;
  messages: ChatMessage[];
  chatLoading: boolean;
  chatOpen: boolean;
  loading: boolean;

  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  fetchTodayNutrition: () => Promise<void>;
  fetchWorkouts: (daysBack?: number) => Promise<Workout[]>;
  sendMessage: (text: string, imageBase64?: string, imageMediaType?: string) => Promise<string>;
  loadChatHistory: () => Promise<void>;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
}

const FitClaudeContext = createContext<FitClaudeState | null>(null);

export function FitClaudeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [todayNutrition, setTodayNutrition] = useState<DailyNutrition | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const historyLoaded = useRef(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setProfile((prev) => (prev ? { ...prev, ...data } : data));
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  }, []);

  const fetchTodayNutrition = useCallback(async () => {
    try {
      const res = await fetch('/api/nutrition/today');
      if (res.ok) {
        const data = await res.json();
        setTodayNutrition(data);
      }
    } catch (err) {
      console.error('Failed to fetch nutrition:', err);
    }
  }, []);

  const fetchWorkouts = useCallback(async (daysBack = 30): Promise<Workout[]> => {
    try {
      const res = await fetch(`/api/workouts?daysBack=${daysBack}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const today = new Date().toDateString();
          const todayW = data.find((w: Workout) => new Date(w.date).toDateString() === today);
          setTodayWorkout(todayW || null);
        }
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch workouts:', err);
    }
    return [];
  }, []);

  // Load today's chat history from DB
  const loadChatHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/history');
      if (res.ok) {
        const data = await res.json();
        const loaded: ChatMessage[] = data.map((m: { id: string; role: string; content: string; imageUrl?: string; createdAt: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          imageUrl: m.imageUrl,
          createdAt: m.createdAt,
        }));
        setMessages(loaded);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  }, []);

  // Auto-load history when authenticated
  useEffect(() => {
    if (status === 'authenticated' && !historyLoaded.current) {
      historyLoaded.current = true;
      loadChatHistory();
    }
  }, [status, loadChatHistory]);

  const sendMessage = useCallback(async (
    text: string,
    imageBase64?: string,
    imageMediaType?: string
  ): Promise<string> => {
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      imageUrl: imageBase64 ? `data:${imageMediaType};base64,${imageBase64}` : undefined,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          image_base64: imageBase64,
          image_media_type: imageMediaType,
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      const data = await res.json();
      const response = data.response || data.message || 'No response';

      // Replace temp user message ID with real one, add assistant message
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === userMsg.id ? { ...m, id: data.userMessageId || m.id } : m
        );
        return [
          ...updated,
          {
            id: data.assistantMessageId || `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: response,
            createdAt: new Date().toISOString(),
          },
        ];
      });

      return response;
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      return errorMsg.content;
    } finally {
      setChatLoading(false);
    }
  }, []);

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, []);

  return (
    <FitClaudeContext.Provider
      value={{
        profile,
        todayWorkout,
        todayNutrition,
        messages,
        chatLoading,
        chatOpen,
        loading,
        fetchProfile,
        updateProfile,
        fetchTodayNutrition,
        fetchWorkouts,
        sendMessage,
        loadChatHistory,
        setChatOpen,
        toggleChat,
      }}
    >
      {children}
    </FitClaudeContext.Provider>
  );
}

export function useFitClaude() {
  const context = useContext(FitClaudeContext);
  if (!context) {
    throw new Error('useFitClaude must be used within a FitClaudeProvider');
  }
  return context;
}
