import { NextResponse } from 'next/server';
import { getBotStatus } from '@/lib/botStatus';
import { startBot, stopBot } from '@/lib/bot';

export async function POST() {
  try {
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
