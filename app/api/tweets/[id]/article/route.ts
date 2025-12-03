import { NextRequest, NextResponse } from 'next/server';
import { tweets } from '@/lib/db';
import { generateArticle } from '@/app/actions/generateArticle';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const { language } = await request.json();

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid tweet ID' },
        { status: 400 }
      );
    }

    // Get tweet data
    const allTweets = tweets.getAll(10000, 0);
    const tweet = allTweets.find((t: any) => t.id === id);

    if (!tweet) {
      return NextResponse.json(
        { error: 'Tweet not found' },
        { status: 404 }
      );
    }

    // Parse media URLs
    let mediaUrls = '';
    try {
      const media = tweet.media_urls ? JSON.parse(tweet.media_urls) : [];
      if (Array.isArray(media)) {
        mediaUrls = media.map((m: any) => typeof m === 'string' ? m : m.mediaUrl || m.url).join(', ');
      }
    } catch {
      // If parsing fails, try to use as string
      mediaUrls = tweet.media_urls || '';
    }

    // Generate articles
    const selectedLanguage = language || 'both';
    console.log(`[Article Generation] Starting for tweet ${id}, language: ${selectedLanguage}`);
    console.log(`[Article Generation] Tweet text: ${tweet.text.substring(0, 100)}...`);
    console.log(`[Article Generation] Media URLs: ${mediaUrls}`);
    
    const articles = await generateArticle(
      tweet.text,
      mediaUrls,
      selectedLanguage as 'english' | 'french' | 'both'
    );

    console.log(`[Article Generation] Articles generated:`, {
      hasEnglish: !!articles.en,
      hasFrench: !!articles.fr
    });

    // Update database with generated articles
    const articleEnglish = articles.en ? JSON.stringify(articles.en) : null;
    const articleFrench = articles.fr ? JSON.stringify(articles.fr) : null;

    const success = tweets.updateArticle(id, articleEnglish, articleFrench);
    
    if (!success) {
      console.error(`[Article Generation] Failed to update database for tweet ${id}`);
      return NextResponse.json(
        { error: 'Failed to update tweet with articles' },
        { status: 500 }
      );
    }

    console.log(`[Article Generation] Successfully generated and saved articles for tweet ${id}`);
    return NextResponse.json({ 
      success: true,
      articles: {
        en: articles.en || null,
        fr: articles.fr || null,
      }
    });
  } catch (error: any) {
    console.error('[Article Generation] Error:', error);
    console.error('[Article Generation] Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to generate article', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

