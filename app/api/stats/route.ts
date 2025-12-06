import { NextResponse } from 'next/server';
import { tweets, accounts } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allTweets = tweets.getAll(10000, 0); // Get all tweets for stats
    const allAccounts = accounts.getAll();

    const stats = {
      totalTweets: allTweets.length,
      totalAccounts: allAccounts.length,
      articlesGenerated: allTweets.filter(t => t.article_generated === 1).length,
      publishedEnglish: allTweets.filter(t => t.published_english === 1).length,
      publishedFrench: allTweets.filter(t => t.published_french === 1).length,
      ignoredTweets: allTweets.filter(t => t.ignored === 1).length,
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}




