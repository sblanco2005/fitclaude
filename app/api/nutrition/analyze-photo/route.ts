import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

export const maxDuration = 60;

export const POST = withAuth(async (request, user) => {
  let body: {
    imageBase64?: string;
    mediaType?: string;
    note?: string;
    weightUnit?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.imageBase64) {
    return NextResponse.json({ error: 'Photo is required' }, { status: 400 });
  }

  const backendUrl = process.env.FITCLAUDE_BACKEND_URL || 'http://localhost:8000';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(
      `${backendUrl}/api/users/${encodeURIComponent(user.id)}/nutrition/analyze-photo`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: body.imageBase64,
          media_type: body.mediaType || 'image/jpeg',
          note: body.note || '',
          weight_unit: body.weightUnit || 'lb',
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.error || 'Photo analysis failed' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    clearTimeout(timeout);
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return NextResponse.json(
      { error: isAbort ? 'Photo analysis timed out. Try a smaller image.' : 'Photo analysis failed' },
      { status: isAbort ? 504 : 502 },
    );
  }
});
