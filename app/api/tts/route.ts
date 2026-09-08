import { NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/tts';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, noiseScale, lengthScale, noiseW, speakerId, emotion } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text must be 5000 characters or less' },
        { status: 400 }
      );
    }

    const result = await generateSpeech(text, {
      noiseScale,
      lengthScale,
      noiseW,
      speakerId,
      emotion,
    });

    return new NextResponse(new Uint8Array(result.wavBuffer), {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': result.wavBuffer.length.toString(),
        'X-Sample-Rate': result.sampleRate.toString(),
        'X-Duration-Ms': Math.round(result.durationMs).toString(),
        'X-Emotion': result.emotion,
        'X-Emotion-Confidence': result.emotionConfidence.toFixed(3),
        'X-E-Segments': result.segments.length.toString(),
        'X-E-Stats': JSON.stringify(
          result.segments.map((s) => ({
            e: s.emotion,
            c: Number(s.confidence.toFixed(3)),
          }))
        ),
        'X-E-Text': result.segments.map((s) => s.text).join(' '),
      },
    });
  } catch (error) {
    console.error('TTS generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `TTS generation failed: ${message}` },
      { status: 500 }
    );
  }
}
