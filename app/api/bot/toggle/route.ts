import { NextResponse } from 'next/server';
import { setBotStatus, getBotStatus } from '@/lib/botStatus';
import { startBot, stopBot, restoreBotState } from '@/lib/bot';

export const dynamic = 'force-dynamic';

// Restore bot state on first API call (ensures bot continues after server restart)
let botRestored = false;
if (!botRestored) {
  botRestored = true;
  restoreBotState();
}

export async function POST() {
  try {
    const currentlyRunning = getBotStatus();
    
    if (currentlyRunning) {
      stopBot();
      return NextResponse.json({ running: false, message: 'Bot stopped' });
    } else {
      startBot();
      return NextResponse.json({ running: true, message: 'Bot started' });
    }
  } catch (error: any) {
    console.error('Error toggling bot:', error);
    return NextResponse.json(
      { error: 'Failed to toggle bot', message: error.message },
      { status: 500 }
    );
  }
}

