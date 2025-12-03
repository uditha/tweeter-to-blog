import { NextRequest, NextResponse } from 'next/server';
import { settings, tweets } from '@/lib/db';

async function uploadImageToWordPress(
  imageUrl: string,
  wpUrl: string,
  wpUsername: string,
  wpPassword: string
): Promise<{ url: string; media_id: number } | null> {
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
      const uploadedUrl = mediaData.source_url || mediaData.guid?.rendered || mediaData.link;
      const mediaId = mediaData.id;

      if (uploadedUrl && mediaId) {
        console.log(`Successfully uploaded image to WordPress: ${uploadedUrl} (Media ID: ${mediaId})`);
        return {
          url: uploadedUrl,
          media_id: mediaId,
        };
      }
    }

    console.error(`Failed to upload image: ${uploadResponse.status} - ${await uploadResponse.text()}`);
    return null;
  } catch (error: any) {
    console.error(`Error uploading image to WordPress: ${error.message}`);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, imageUrl } = await request.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Get WordPress configuration
    const wpUrl = settings.get('wordpressEnglishUrl');
    const wpUsername = settings.get('wordpressEnglishUsername');
    const wpPassword = settings.get('wordpressEnglishPassword');

    if (!wpUrl || !wpUsername || !wpPassword) {
      return NextResponse.json(
        { error: 'WordPress English credentials not configured' },
        { status: 500 }
      );
    }

    const wpApiUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;

    // Upload featured image if provided
    let featuredMediaId: number | undefined;
    if (imageUrl) {
      const uploadResult = await uploadImageToWordPress(imageUrl, wpUrl, wpUsername, wpPassword);
      if (uploadResult) {
        featuredMediaId = uploadResult.media_id;
      }
    }

    // Build post data
    const postData: any = {
      title,
      content,
      status: 'publish',
    };

    if (featuredMediaId) {
      postData.featured_media = featuredMediaId;
    }

    // Try to get categories (optional)
    try {
      const wpCategoriesUrl = `${wpUrl.replace(/\/$/, '')}/wp-json/wp/v2/categories`;
      const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64');
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
      console.warn('Could not fetch categories, publishing without category');
    }

    // Publish to WordPress
    const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64');
    const response = await fetch(wpApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(postData),
    });

    if (response.status === 201) {
      const postData = await response.json();
      return NextResponse.json({
        success: true,
        post_id: postData.id,
        link: postData.link,
      });
    } else {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: await response.text() };
      }
      return NextResponse.json(
        {
          error: `WordPress API error: ${response.status}`,
          details: errorData,
        },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error('Error posting to WordPress:', error);
    return NextResponse.json(
      { error: 'Failed to post to WordPress', message: error.message },
      { status: 500 }
    );
  }
}

