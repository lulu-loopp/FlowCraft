import { NextResponse } from 'next/server';
import { readSettings, writeSettings } from '@/lib/settings-storage';

export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error('[settings GET]', err);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const settings = await writeSettings(body);
    return NextResponse.json(settings);
  } catch (err) {
    console.error('[settings POST]', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
