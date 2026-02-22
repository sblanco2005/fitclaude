import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

export const POST = withAuth(async (request, user) => {
  const body = await request.json();
  const { message, image_base64, image_media_type, topic = 'workout', timezone } = body;

  if (!message && !image_base64) {
    return NextResponse.json(
      { error: 'Message or image is required' },
      { status: 400 }
    );
  }

  // Save user message to DB
  const userMsg = await prisma.conversationHistory.create({
    data: {
      userId: user.id,
      role: 'user',
      content: message || '',
      topic,
      imageUrl: image_base64 ? `data:${image_media_type};base64,${image_base64.slice(0, 100)}...` : null,
    },
  });

  const backendUrl = process.env.FITCLAUDE_BACKEND_URL || 'http://localhost:8000';

  const response = await fetch(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      message: message || '',
      topic,
      image_base64,
      image_media_type,
      timezone: timezone || null,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Chat Proxy] Backend error:', errorText);
    return NextResponse.json(
      { error: 'Failed to get response from AI coach' },
      { status: 502 }
    );
  }

  const data = await response.json();
  const assistantContent = data.response || data.message || 'No response';

  // Save assistant response to DB
  const assistantMsg = await prisma.conversationHistory.create({
    data: {
      userId: user.id,
      role: 'assistant',
      content: assistantContent,
      topic,
    },
  });

  return NextResponse.json({
    ...data,
    userMessageId: userMsg.id,
    assistantMessageId: assistantMsg.id,
  });
});
