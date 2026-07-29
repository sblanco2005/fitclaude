import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

// Just a Meta extraction (no transcript fetch), but reasoning takes time.
export const maxDuration = 60;

export const POST = withAuth(async (request, user) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { text, timezone } = body;
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const backendUrl = process.env.FITCLAUDE_BACKEND_URL || 'http://localhost:8000';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(`${backendUrl}/api/workouts/from-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, text, timezone: timezone || null }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Backend error: ${errorText.slice(0, 200)}` }, { status: 502 });
    }

    return NextResponse.json(await response.json());
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    return NextResponse.json(
      { error: isAbort ? 'That took too long — try again.' : 'Failed to build the routine.' },
      { status: isAbort ? 504 : 502 },
    );
  }
});
