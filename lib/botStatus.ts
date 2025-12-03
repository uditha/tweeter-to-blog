import { settings } from './db';

// Get bot status from database (persists across restarts)
export function setBotStatus(running: boolean) {
  settings.setBoolean('botRunning', running);
}

export function getBotStatus(): boolean {
  return settings.getBoolean('botRunning', false);
}

