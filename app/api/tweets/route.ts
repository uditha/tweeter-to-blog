import { NextRequest, NextResponse } from 'next/server';
import { tweets } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Parse filters
    const filters: any = {};
    if (searchParams.has('ignored')) {
      filters.ignored = searchParams.get('ignored') === 'true';
    }
    if (searchParams.has('articleGenerated')) {
      filters.articleGenerated = searchParams.get('articleGenerated') === 'true';
    }
    if (searchParams.has('publishedEnglish')) {
      filters.publishedEnglish = searchParams.get('publishedEnglish') === 'true';
    }
    if (searchParams.has('publishedFrench')) {
      filters.publishedFrench = searchParams.get('publishedFrench') === 'true';
    }
    if (searchParams.has('accountId')) {
      filters.accountId = parseInt(searchParams.get('accountId') || '0');
    }

    // Use filtered query if filters are provided, otherwise use getAll
    const allTweets = Object.keys(filters).length > 0
      ? tweets.getFiltered(filters, limit, offset)
      : tweets.getAll(limit, offset);
    
    return NextResponse.json({ tweets: allTweets });
  } catch (error: any) {
    console.error('Error fetching tweets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tweets', message: error.message },
      { status: 500 }
    );
  }
}
