import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

export const maxDuration = 15;

export const POST = withAuth(async (request) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 413 }
    );
  }

  const { image_base64, image_media_type } = body;

  if (!image_base64 || !image_media_type) {
    return NextResponse.json(
      { error: 'image_base64 and image_media_type are required' },
      { status: 400 }
    );
  }

  const backendUrl = process.env.FITCLAUDE_BACKEND_URL || 'http://localhost:8000';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(`${backendUrl}/api/exercises/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64, image_media_type }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Backend error: ${errorText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    return NextResponse.json(await response.json());
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    return NextResponse.json(
      { error: isAbort ? 'Request timed out' : 'Failed to identify exercise' },
      { status: isAbort ? 504 : 502 }
    );
  }
});
