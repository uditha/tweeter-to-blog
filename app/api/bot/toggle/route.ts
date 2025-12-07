import { NextResponse } from 'next/server';
import { getBotStatus } from '@/lib/botStatus';
import { startBot, stopBot, restoreBotState } from '@/lib/bot';

export async function POST() {
  try {
    // Restore bot state first to ensure we have the latest status
    await restoreBotState();
    
    const isRunning = await getBotStatus();
    
    if (isRunning) {
      await stopBot();
    } else {
      await startBot();
    }
    
    const newStatus = await getBotStatus();
    return NextResponse.json({ running: newStatus });
  } catch (error: any) {
    console.error('Error toggling bot:', error);
    return NextResponse.json(
      { error: 'Failed to toggle bot', message: error.message },
      { status: 500 }
    );
  }
}
