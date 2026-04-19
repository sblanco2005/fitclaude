import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { prisma } from '@/lib/prisma';

// Allow up to 60 seconds for image analysis + tool-use loop
export const maxDuration = 60;

export const POST = withAuth(async (request, user) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body — may be too large' },
      { status: 413 }
    );
  }

  const { message, image_base64, image_media_type, topic = 'workout', timezone, use_vision, session_type } = body;

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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000); // 55s timeout

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
        use_vision: use_vision || false,
        session_type: session_type || null,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Chat Proxy] Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error (${response.status}): ${errorText.slice(0, 200)}` },
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
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    console.error('[Chat Proxy] Error:', isAbort ? 'Request timed out (55s)' : err);
    return NextResponse.json(
      { error: isAbort ? 'Request timed out — try a smaller image or simpler message' : 'Failed to get response from AI coach' },
      { status: isAbort ? 504 : 502 }
    );
  }
});
