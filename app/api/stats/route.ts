import { NextResponse } from 'next/server';
import { tweets, accounts } from '@/lib/db';

export async function GET() {
  try {
    // Get all tweets for calculations
    const allTweets = await tweets.getAll(10000, 0);
    
    // Calculate statistics
    const totalTweets = allTweets.length;
    const tweetsWithArticles = allTweets.filter((t: any) => t.article_generated === 1).length;
    const ignoredTweets = allTweets.filter((t: any) => t.ignored === 1).length;
    const publishedEnglish = allTweets.filter((t: any) => t.published_english === 1).length;
    const publishedFrench = allTweets.filter((t: any) => t.published_french === 1).length;
    const activeTweets = allTweets.filter((t: any) => t.ignored === 0 && t.article_generated === 0).length;
    
    // Get account count
    const allAccounts = await accounts.getAll();
    const totalAccounts = allAccounts.length;
    
    // Calculate engagement metrics
    const totalLikes = allTweets.reduce((sum: number, t: any) => sum + (t.like_count || 0), 0);
    const totalRetweets = allTweets.reduce((sum: number, t: any) => sum + (t.retweet_count || 0), 0);
    const totalReplies = allTweets.reduce((sum: number, t: any) => sum + (t.reply_count || 0), 0);
    const totalViews = allTweets.reduce((sum: number, t: any) => sum + (t.view_count || 0), 0);
    const totalQuotes = allTweets.reduce((sum: number, t: any) => sum + (t.quote_count || 0), 0);
    
    // Calculate averages (only for non-zero tweets)
    const tweetsWithLikes = allTweets.filter((t: any) => (t.like_count || 0) > 0);
    const tweetsWithViews = allTweets.filter((t: any) => (t.view_count || 0) > 0);
    
    const avgLikes = tweetsWithLikes.length > 0 
      ? Math.round(totalLikes / tweetsWithLikes.length) 
      : 0;
    const avgRetweets = totalTweets > 0 
      ? (totalRetweets / totalTweets).toFixed(1) 
      : '0.0';
    const avgReplies = totalTweets > 0 
      ? (totalReplies / totalTweets).toFixed(1) 
      : '0.0';
    const avgViews = tweetsWithViews.length > 0 
      ? Math.round(totalViews / tweetsWithViews.length) 
      : 0;
    
    // Calculate engagement rate (likes + retweets + replies) / views
    const totalEngagements = totalLikes + totalRetweets + totalReplies;
    const engagementRate = totalViews > 0 
      ? ((totalEngagements / totalViews) * 100).toFixed(2) 
      : '0.00';
    
    // Calculate conversion rates
    const articleConversionRate = totalTweets > 0 
      ? ((tweetsWithArticles / totalTweets) * 100).toFixed(1) 
      : '0.0';
    const publishConversionRate = tweetsWithArticles > 0
      ? (((publishedEnglish + publishedFrench) / tweetsWithArticles) * 100).toFixed(1)
      : '0.0';

    return NextResponse.json({
      tweets: {
        total: totalTweets,
        active: activeTweets,
        withArticles: tweetsWithArticles,
        ignored: ignoredTweets,
        publishedEnglish,
        publishedFrench,
        publishedTotal: publishedEnglish + publishedFrench,
      },
      accounts: {
        total: totalAccounts,
      },
      engagement: {
        totalLikes,
        totalRetweets,
        totalReplies,
        totalViews,
        totalQuotes,
        avgLikes,
        avgRetweets: parseFloat(avgRetweets),
        avgReplies: parseFloat(avgReplies),
        avgViews,
        totalEngagements: totalLikes + totalRetweets + totalReplies,
        engagementRate: parseFloat(engagementRate),
      },
      conversion: {
        articleRate: parseFloat(articleConversionRate),
        publishRate: parseFloat(publishConversionRate),
      },
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}
