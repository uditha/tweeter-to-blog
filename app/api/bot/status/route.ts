import { NextResponse } from 'next/server';
import { getBotStatus } from '@/lib/botStatus';
import { restoreBotState } from '@/lib/bot';

// Restore bot state on first API call (ensures bot continues after server restart)
let botRestored = false;
if (!botRestored) {
  botRestored = true;
  restoreBotState();
}

export async function GET() {
  return NextResponse.json({ running: getBotStatus() });
}

