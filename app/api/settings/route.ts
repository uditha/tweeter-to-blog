import { NextRequest, NextResponse } from 'next/server';
import { settings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (key) {
      const value = settings.get(key);
      return NextResponse.json({ key, value });
    }

    // Return all settings
    return NextResponse.json({
      autoMode: settings.getBoolean('autoMode', false),
      wordpressEnglishUrl: settings.get('wordpressEnglishUrl') || '',
      wordpressFrenchUrl: settings.get('wordpressFrenchUrl') || '',
      wordpressEnglishUsername: settings.get('wordpressEnglishUsername') || '',
      wordpressFrenchUsername: settings.get('wordpressFrenchUsername') || '',
      wordpressEnglishPassword: settings.get('wordpressEnglishPassword') || '',
      wordpressFrenchPassword: settings.get('wordpressFrenchPassword') || '',
      openaiApiKey: settings.get('openaiApiKey') || '',
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    settings.set(key, value);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', message: error.message },
      { status: 500 }
    );
  }
}




