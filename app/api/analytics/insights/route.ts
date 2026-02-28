import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';

export const maxDuration = 30;

export const GET = withAuth(async (request, user) => {
  const backendUrl = process.env.FITCLAUDE_BACKEND_URL || 'http://localhost:8000';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 28000);

    const response = await fetch(
      `${backendUrl}/api/analytics/insights?user_id=${encodeURIComponent(user.id)}`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[analytics/insights] Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to generate insights', details: errorText.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    console.error('[analytics/insights] Error:', isAbort ? 'Timeout (28s)' : err);
    return NextResponse.json(
      { error: isAbort ? 'Insights generation timed out' : 'Failed to generate insights' },
      { status: isAbort ? 504 : 502 }
    );
  }
});
