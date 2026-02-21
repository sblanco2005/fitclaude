import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth/admin';

const BACKEND_URL =
  process.env.FITCLAUDE_BACKEND_URL || 'http://localhost:8000';

export const POST = withAdmin(async (request: NextRequest) => {
  const { job } = await request.json();

  if (!['video-linking', 'video-discovery'].includes(job)) {
    return NextResponse.json({ error: 'Invalid job name' }, { status: 400 });
  }

  try {
    const resp = await fetch(`${BACKEND_URL}/api/jobs/${job}`, {
      method: 'POST',
      headers: {
        'X-Job-API-Key': process.env.JOB_API_KEY || '',
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `Backend error: ${text}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to reach backend: ${error}` },
      { status: 502 }
    );
  }
});
