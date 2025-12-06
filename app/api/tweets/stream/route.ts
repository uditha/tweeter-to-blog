import { NextRequest } from 'next/server';
import { tweets } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      let lastTweetId: number | null = null;
      const articleStatusMap = new Map<number, { generated: number; english: string | null; french: string | null }>();
      
      const sendUpdate = () => {
        try {
          // Get latest tweets
          const latestTweets = tweets.getAll(50, 0);
          
          if (latestTweets.length > 0) {
            const newestId = latestTweets[0].id;
            
            // Check for new tweets
            if (lastTweetId === null || newestId !== lastTweetId) {
              const data = JSON.stringify({
                type: 'tweet_update',
                timestamp: new Date().toISOString(),
                tweetCount: latestTweets.length,
                latestTweetId: newestId,
              });
              
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              lastTweetId = newestId;
            }

            // Check for article generation status changes
            for (const tweet of latestTweets) {
              const tweetId = tweet.id;
              const currentStatus = {
                generated: tweet.article_generated || 0,
                english: tweet.article_english,
                french: tweet.article_french,
              };
              
              const previousStatus = articleStatusMap.get(tweetId);
              
              // If status changed (especially from 0 to 1), send update
              if (!previousStatus || 
                  previousStatus.generated !== currentStatus.generated ||
                  previousStatus.english !== currentStatus.english ||
                  previousStatus.french !== currentStatus.french) {
                
                if (currentStatus.generated === 1 && (!previousStatus || previousStatus.generated === 0)) {
                  // Article was just generated
                  const data = JSON.stringify({
                    type: 'article_update',
                    tweetId: tweetId,
                    timestamp: new Date().toISOString(),
                    hasEnglish: !!currentStatus.english,
                    hasFrench: !!currentStatus.french,
                  });
                  
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                
                articleStatusMap.set(tweetId, currentStatus);
              }
            }
          }
        } catch (error) {
          console.error('Error in SSE stream:', error);
        }
      };

      // Send initial update
      sendUpdate();

      // Send updates every 2 seconds for faster updates
      const interval = setInterval(sendUpdate, 2000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

