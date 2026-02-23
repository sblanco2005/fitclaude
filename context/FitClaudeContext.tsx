'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { UserProfile, Workout, DailyNutrition, ChatMessage } from '@/types';
import { useSession } from 'next-auth/react';

export type ChatTopic = 'workout' | 'nutrition';

interface FitClaudeState {
  profile: UserProfile | null;
  todayWorkout: Workout | null;
  todayNutrition: DailyNutrition | null;
  messages: ChatMessage[];
  chatLoading: boolean;
  chatOpen: boolean;
  chatTopic: ChatTopic;
  loading: boolean;
  /** Increments after every successful chat response — pages can watch this to re-fetch */
  dataVersion: number;

  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  fetchTodayNutrition: () => Promise<void>;
  fetchWorkouts: (daysBack?: number) => Promise<Workout[]>;
  sendMessage: (text: string, imageBase64?: string, imageMediaType?: string) => Promise<string>;
  loadChatHistory: (topic?: ChatTopic) => Promise<void>;
  setChatOpen: (open: boolean) => void;
  setChatTopic: (topic: ChatTopic) => void;
  toggleChat: () => void;
}

const FitClaudeContext = createContext<FitClaudeState | null>(null);

export function FitClaudeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<Workout | null>(null);
  const [todayNutrition, setTodayNutrition] = useState<DailyNutrition | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTopic, setChatTopicState] = useState<ChatTopic>('workout');
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  // Separate message arrays per topic
  const [workoutMessages, setWorkoutMessages] = useState<ChatMessage[]>([]);
  const [nutritionMessages, setNutritionMessages] = useState<ChatMessage[]>([]);
  const historyLoadedTopics = useRef<Set<string>>(new Set());

  // Active messages based on current topic
  const messages = chatTopic === 'workout' ? workoutMessages : nutritionMessages;
  const setMessages = chatTopic === 'workout' ? setWorkoutMessages : setNutritionMessages;

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
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/nutrition/today?tz=${encodeURIComponent(tz)}`);
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

  // Load chat history for a specific topic
  const loadChatHistory = useCallback(async (topic?: ChatTopic) => {
    const t = topic || chatTopic;
    try {
      const res = await fetch(`/api/chat/history?topic=${t}`);
      if (res.ok) {
        const data = await res.json();
        const loaded: ChatMessage[] = data.map((m: { id: string; role: string; content: string; imageUrl?: string; createdAt: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          imageUrl: m.imageUrl,
          createdAt: m.createdAt,
        }));
        if (t === 'workout') setWorkoutMessages(loaded);
        else setNutritionMessages(loaded);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  }, [chatTopic]);

  // Auto-load history when authenticated
  useEffect(() => {
    if (status === 'authenticated' && !historyLoadedTopics.current.has('workout')) {
      historyLoadedTopics.current.add('workout');
      loadChatHistory('workout');
    }
  }, [status, loadChatHistory]);

  // Load history when switching topics
  const setChatTopic = useCallback((topic: ChatTopic) => {
    setChatTopicState(topic);
    if (!historyLoadedTopics.current.has(topic)) {
      historyLoadedTopics.current.add(topic);
      loadChatHistory(topic);
    }
  }, [loadChatHistory]);

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

    const setter = chatTopic === 'workout' ? setWorkoutMessages : setNutritionMessages;
    setter((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          topic: chatTopic,
          image_base64: imageBase64,
          image_media_type: imageMediaType,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      const data = await res.json();
      const response = data.response || data.message || 'No response';
      const modelUsed = data.model_used || null;

      setter((prev) => {
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
            modelUsed,
          },
        ];
      });

      // Signal pages to re-fetch their data
      setDataVersion((v) => v + 1);

      return response;
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setter((prev) => [...prev, errorMsg]);
      return errorMsg.content;
    } finally {
      setChatLoading(false);
    }
  }, [chatTopic]);

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
        chatTopic,
        loading,
        dataVersion,
        fetchProfile,
        updateProfile,
        fetchTodayNutrition,
        fetchWorkouts,
        sendMessage,
        loadChatHistory,
        setChatOpen,
        setChatTopic,
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
