import { NextResponse } from 'next/server';
import { VoiceMatchSchema } from '@/lib/validation/contacts';
import { matchTranscript } from '@/lib/services/voice-match';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'BAD_JSON', message: 'Invalid JSON' } }, { status: 400 });
  }
  const parsed = VoiceMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Invalid input', details: parsed.error.flatten() } },
      { status: 400 },
    );
  }
  const candidates = matchTranscript(parsed.data.transcript);
  return NextResponse.json({ candidates });
}
