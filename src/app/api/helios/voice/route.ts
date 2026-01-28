/**
 * HELIOS Voice API Route
 * Handles voice transcription with Deepgram + Hume
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { audio, language } = await request.json();

    // Call Supabase edge function for voice processing
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/helios-voice`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ audio, language }),
      }
    );

    if (!response.ok) {
      throw new Error('Voice processing failed');
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      { error: 'Voice processing failed' },
      { status: 500 }
    );
  }
}
