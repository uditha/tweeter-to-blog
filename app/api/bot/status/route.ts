import { NextResponse } from 'next/server';
import { getBotStatus } from '@/lib/botStatus';
import { restoreBotState } from '@/lib/bot';

export async function GET() {
  try {
    // Lazy initialization: restore bot state if it was running
    // This is important for serverless environments where state doesn't persist
    await restoreBotState();
    
    const running = await getBotStatus();
    return NextResponse.json({ running });
  } catch (error: any) {
    console.error('Error fetching bot status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot status', message: error.message },
      { status: 500 }
    );
  }
}
