import { NextRequest, NextResponse } from 'next/server';
import { tweets, settings } from '@/lib/db';

async function uploadImageToWordPress(
  imageUrl: string,
  wpUrl: string,
  wpUsername: string,
  wpPassword: string
): Promise<number | null> {
  try {
    // Download the image
    const imgResponse = await fetch(imageUrl, { 
      signal: AbortSignal.timeout(30000) 
    });
    
    if (!imgResponse.ok) {
      console.error(`Failed to download image: ${imageUrl} - Status: ${imgResponse.status}`);
      return null;
    }

    // Get filename from URL
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

    // WordPress media upload endpoint
    const wpMediaUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/media`;

    // Create FormData for file upload
    const formData = new FormData();
    const blob = new Blob([imgBuffer], { type: contentType });
    formData.append('file', blob, filename);

    // Upload to WordPress
    const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64');
    const uploadResponse = await fetch(wpMediaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData,
    });

    if (uploadResponse.status === 201) {
      const mediaData = await uploadResponse.json();
      return mediaData.id || null;
    }

    return null;
  } catch (error: any) {
    console.error(`Error uploading image to WordPress: ${error.message}`);
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const { language, published } = await request.json();

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid tweet ID' },
        { status: 400 }
      );
    }

    if (language !== 'english' && language !== 'french') {
      return NextResponse.json(
        { error: 'Invalid language. Must be "english" or "french"' },
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

    if (!published) {
      // Just update the database status and clear the link
      const success = tweets.updatePublished(id, language, false, null);
      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update tweet status' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    // Get article content
    const articleContent = language === 'english' 
      ? tweet.article_english 
      : tweet.article_french;

    if (!articleContent) {
      return NextResponse.json(
        { error: `Article not generated for ${language} language` },
        { status: 400 }
      );
    }

    let articleData: { title: string; article: string };
    try {
      articleData = typeof articleContent === 'string' 
        ? JSON.parse(articleContent) 
        : articleContent;
    } catch {
      return NextResponse.json(
        { error: 'Invalid article data format' },
        { status: 400 }
      );
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
      // Ignore media parsing errors
    }

    // Get WordPress configuration
    const wpUrl = language === 'english' 
      ? settings.get('wordpressEnglishUrl')
      : settings.get('wordpressFrenchUrl');
    const wpUsername = language === 'english'
      ? settings.get('wordpressEnglishUsername')
      : settings.get('wordpressFrenchUsername');
    const wpPassword = language === 'english'
      ? settings.get('wordpressEnglishPassword')
      : settings.get('wordpressFrenchPassword');

    if (!wpUrl || !wpUsername || !wpPassword) {
      return NextResponse.json(
        { error: `WordPress ${language} credentials not configured` },
        { status: 500 }
      );
    }

    // Upload image if available
    let featuredMediaId: number | undefined;
    if (imageUrl) {
      const mediaId = await uploadImageToWordPress(imageUrl, wpUrl, wpUsername, wpPassword);
      if (mediaId) {
        featuredMediaId = mediaId;
      }
    }

    // Publish to WordPress
    const wpApiUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
    const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64');

    const postData: any = {
      title: articleData.title,
      content: articleData.article,
      status: 'publish',
    };

    if (featuredMediaId) {
      postData.featured_media = featuredMediaId;
    }

    // Try to get categories
    try {
      const wpCategoriesUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/categories`;
      const catResponse = await fetch(wpCategoriesUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      if (catResponse.ok) {
        const categories = await catResponse.json();
        if (categories && categories.length > 0) {
          postData.categories = [categories[0].id];
        }
      }
    } catch (error) {
      console.warn('Could not fetch categories');
    }

    const response = await fetch(wpApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(postData),
    });

    if (response.status !== 201) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { error: errorText };
      }
      return NextResponse.json(
        {
          error: `WordPress API error: ${response.status}`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const publishData = await response.json();

    // Update database with publishing status and link
    const postLink = publishData.link;
    const success = tweets.updatePublished(id, language, true, postLink);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update tweet status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      post_id: publishData.id,
      link: postLink,
      message: `Article published successfully to ${language} WordPress site`
    });
  } catch (error: any) {
    console.error('Error publishing article:', error);
    return NextResponse.json(
      { error: 'Failed to publish article', message: error.message },
      { status: 500 }
    );
  }
}
