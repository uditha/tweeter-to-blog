import { NextRequest, NextResponse } from 'next/server';
import { tweets, settings } from '@/lib/db';
import { Buffer } from 'buffer';

async function uploadImageToWordPress(
  imageUrl: string,
  wpUrl: string,
  wpUsername: string,
  wpPassword: string
): Promise<{ url: string; media_id: number } | null> {
  try {
    const imgResponse = await fetch(imageUrl, { 
      signal: AbortSignal.timeout(30000) 
    });
    
    if (!imgResponse.ok) {
      console.error(`Failed to download image: ${imageUrl} - Status: ${imgResponse.status}`);
      return null;
    }

    const urlPath = new URL(imageUrl).pathname;
    let filename = urlPath.split('/').pop()?.split('?')[0] || 'tweet_image.jpg';
    
    if (!filename || !filename.includes('.')) {
      const contentType = imgResponse.headers.get('Content-Type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : 
                  contentType.includes('gif') ? 'gif' : 
                  contentType.includes('webp') ? 'webp' : 'jpg';
      filename = `tweet_image_${Date.now()}.${ext}`;
    }

    const imgBuffer = await imgResponse.arrayBuffer();
    const contentType = imgResponse.headers.get('Content-Type') || 'image/jpeg';

    const wpMediaUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/media`;

    const formData = new FormData();
    const blob = new Blob([imgBuffer], { type: contentType });
    formData.append('file', blob, filename);

    const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64');
    const uploadResponse = await fetch(wpMediaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData,
      signal: AbortSignal.timeout(60000)
    });
    
    if (uploadResponse.status === 201) {
      const mediaData = await uploadResponse.json();
      const uploadedUrl = mediaData.source_url || mediaData.guid?.rendered || mediaData.link;
      const mediaId = mediaData.id;
      if (uploadedUrl && mediaId) {
        return { url: uploadedUrl, media_id: mediaId };
      }
    }
    return null;
  } catch (e: any) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tweetIds, language } = await request.json();

    if (!Array.isArray(tweetIds) || tweetIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid tweet IDs. Must be a non-empty array' },
        { status: 400 }
      );
    }

    if (language !== 'english' && language !== 'french') {
      return NextResponse.json(
        { error: 'Invalid language. Must be "english" or "french"' },
        { status: 400 }
      );
    }

    if (tweetIds.length > 50) {
      return NextResponse.json(
        { error: 'Too many tweets. Maximum 50 at a time' },
        { status: 400 }
      );
    }

    // Get WordPress credentials
    const wpUrl = settings.get(language === 'english' ? 'wordpressEnglishUrl' : 'wordpressFrenchUrl');
    const wpUsername = settings.get(language === 'english' ? 'wordpressEnglishUsername' : 'wordpressFrenchUsername');
    const wpPassword = settings.get(language === 'english' ? 'wordpressEnglishPassword' : 'wordpressFrenchPassword');

    if (!wpUrl || !wpUsername || !wpPassword) {
      return NextResponse.json(
        { error: `WordPress credentials for ${language} not configured` },
        { status: 500 }
      );
    }

    const wpApiUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
    const results: Array<{ id: number; success: boolean; error?: string; link?: string }> = [];

    // Process tweets sequentially
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

        // Check if already published
        const alreadyPublished = language === 'english' 
          ? tweet.published_english === 1
          : tweet.published_french === 1;

        if (alreadyPublished) {
          results.push({ 
            id, 
            success: true, 
            error: 'Already published',
            link: (language === 'english' ? tweet.published_english_link : tweet.published_french_link) || undefined
          });
          continue;
        }

        // Get article content
        const articleContent = language === 'english' 
          ? tweet.article_english 
          : tweet.article_french;

        if (!articleContent) {
          results.push({ id, success: false, error: 'Article not generated' });
          continue;
        }

        let articleData: { title: string; article?: string; content?: string };
        try {
          articleData = JSON.parse(articleContent);
        } catch {
          results.push({ id, success: false, error: 'Invalid article format' });
          continue;
        }

        if (!articleData.title || (!articleData.article && !articleData.content)) {
          results.push({ id, success: false, error: 'Invalid article format: missing title or content' });
          continue;
        }

        // Get first media URL for featured image
        let imageUrl: string | null = null;
        try {
          const media = tweet.media_urls ? JSON.parse(tweet.media_urls) : [];
          if (Array.isArray(media) && media.length > 0) {
            const firstMedia = media[0];
            imageUrl = typeof firstMedia === 'string' 
              ? firstMedia 
              : firstMedia.mediaUrl || firstMedia.url || null;
          }
        } catch {
          // Ignore
        }

        // Upload image if available
        let featuredMediaId: number | null = null;
        if (imageUrl) {
          const uploadResult = await uploadImageToWordPress(imageUrl, wpUrl, wpUsername, wpPassword);
          if (uploadResult) {
            featuredMediaId = uploadResult.media_id;
          }
        }

        // Create post
        const fullContent = `${articleData.article || articleData.content || ''}
<hr>
<p><em>Source: <a href="https://twitter.com/${tweet.username}/status/${tweet.tweet_id}" target="_blank">Original Tweet</a></em></p>`;

        const postData: any = {
          title: articleData.title,
          content: fullContent,
          status: 'publish',
        };

        if (featuredMediaId) {
          postData.featured_media = featuredMediaId;
        }

        const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64');
        const response = await fetch(wpApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
          body: JSON.stringify(postData),
          signal: AbortSignal.timeout(60000)
        });

        if (response.status === 201) {
          const postResponse = await response.json();
          const postLink = postResponse.link;
          const success = tweets.updatePublished(id, language, true, postLink);
          
          if (success) {
            results.push({ id, success: true, link: postLink });
          } else {
            results.push({ id, success: false, error: 'Failed to update database' });
          }
        } else {
          const errorText = await response.text();
          results.push({ id, success: false, error: `WordPress error: ${response.status}` });
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
    console.error('[Bulk Publish] Error:', error);
    return NextResponse.json(
      { error: 'Failed to publish articles', message: error.message },
      { status: 500 }
    );
  }
}

