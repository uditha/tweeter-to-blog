import { NextRequest, NextResponse } from 'next/server';
import { tweets } from '@/lib/db';
import { generateArticle } from '@/app/actions/generateArticle';

export async function POST(request: NextRequest) {
  try {
    const { tweetIds, language } = await request.json();

    if (!Array.isArray(tweetIds) || tweetIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid tweet IDs. Must be a non-empty array' },
        { status: 400 }
      );
    }

    if (tweetIds.length > 50) {
      return NextResponse.json(
        { error: 'Too many tweets. Maximum 50 at a time' },
        { status: 400 }
      );
    }

    const selectedLanguage = language || 'both';
    const results: Array<{ id: number; success: boolean; error?: string }> = [];

    // Process tweets sequentially to avoid overwhelming the API
    for (const tweetId of tweetIds) {
      try {
        const id = parseInt(tweetId.toString());
        if (isNaN(id)) {
          results.push({ id: tweetId, success: false, error: 'Invalid tweet ID' });
          continue;
        }

        // Get tweet data
        const allTweets = tweets.getAll(10000, 0);
        const tweet = allTweets.find((t: any) => t.id === id);

        if (!tweet) {
          results.push({ id, success: false, error: 'Tweet not found' });
          continue;
        }

        // Skip if already generated
        if (tweet.article_generated === 1) {
          results.push({ id, success: true, error: 'Article already generated' });
          continue;
        }

        // Parse media URLs
        let mediaUrls = '';
        try {
          const media = tweet.media_urls ? JSON.parse(tweet.media_urls) : [];
          if (Array.isArray(media)) {
            mediaUrls = media.map((m: any) => typeof m === 'string' ? m : m.mediaUrl || m.url).join(', ');
          }
        } catch {
          mediaUrls = tweet.media_urls || '';
        }

        // Generate articles
        const articles = await generateArticle(
          tweet.text,
          mediaUrls,
          selectedLanguage as 'english' | 'french' | 'both'
        );

        // Update database
        const articleEnglish = articles.en ? JSON.stringify(articles.en) : null;
        const articleFrench = articles.fr ? JSON.stringify(articles.fr) : null;

        const success = tweets.updateArticle(id, articleEnglish, articleFrench);
        
        if (success) {
          results.push({ id, success: true });
        } else {
          results.push({ id, success: false, error: 'Failed to update database' });
        }
      } catch (error: any) {
        results.push({ id: tweetId, success: false, error: error.message || 'Unknown error' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      total: tweetIds.length,
      successCount,
      failureCount,
      results,
    });
  } catch (error: any) {
    console.error('[Bulk Article Generation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate articles', message: error.message },
      { status: 500 }
    );
  }
}




