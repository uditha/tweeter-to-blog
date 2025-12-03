import { accounts, tweets } from './db';
import { parseTweetsFromResponse } from '@/app/utils/tweetParser';
import type { ParsedTweet } from '@/app/utils/tweetParser';
import { setBotStatus } from './botStatus';

let botInterval: NodeJS.Timeout | null = null;
const BOT_INTERVAL_MS = 60 * 1000; // 1 minute

// Default auth tokens (from settings)
const DEFAULT_AUTH_TOKEN = '3eaf164a56a22e1f33ae5560f83df4eb355aeec7';
const DEFAULT_CSRF_TOKEN = 'b049d0e4ea56f8f60ca37bbf978fbc97dd9f9f173facfcbd378022e9114af371ffad7e145b8f8f55ad8129dd018b99372993c4ffb77c9ee102f0e7e06641bcbc5430a13e4b842dc69580131c2efe6229';
const DEFAULT_COOKIES = 'kdt=cDjir38fPM277DknWO2kpOim9qOFDivSlDhrIy2d; d_prefs=MToxLGNvbnNlbnRfdmVyc2lvbjoyLHRleHRfdmVyc2lvbjoxMDAw; guest_id_ads=v1%3A175036801936953321; guest_id_marketing=v1%3A175036801936953321; personalization_id="v1_jODERn73KysYuUcUu35ucA=="; __cuid=83408cbcd9384ba59189f88b7f1987d6; lang=en; dnt=1; guest_id=v1%3A176478854200341650; gt=1996293951452569882; g_state={"i_l":0,"i_ll":1764788557387}; auth_token=3eaf164a56a22e1f33ae5560f83df4eb355aeec7; ct0=b049d0e4ea56f8f60ca37bbf978fbc97dd9f9f173facfcbd378022e9114af371ffad7e145b8f8f55ad8129dd018b99372993c4ffb77c9ee102f0e7e06641bcbc5430a13e4b842dc69580131c2efe6229; twid=u%3D2558142012; __cf_bm=eCFZJuaadt4zqJc9J1rA_7BGcJ3Fgb72MBp2BglMu1E-1764788618.978228-1.0.1.1-ZNNlFS15CG37EBzcwPO_xnx.VDVprxhspXXpQREUDvqWnE7yazmKDX1UBd2.hAsO3FsCuQqo9qDTuT6p.UvzatcdVBTyeomgsbOmUrxICTIYPtXI.EJaDNrVq7omA53s';

async function fetchTweetsForAccount(accountId: number, username: string, userId: string): Promise<ParsedTweet[]> {
  try {
    const graphqlEndpoint = 'https://x.com/i/api/graphql/lZRf8IC-GTuGxDwcsHW8aw/UserTweets';
    
    const variables = {
      userId: userId,
      count: 20,
      includePromotedContent: true,
      withQuickPromoteEligibilityTweetFields: true,
      withVoice: true,
    };

    const features = {
      rweb_video_screen_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_profile_redirect_enabled: false,
      rweb_tipjar_consumption_enabled: true,
      verified_phone_label_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      premium_content_api_read_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: true,
      responsive_web_jetfuel_frame: true,
      responsive_web_grok_share_attachment_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_grok_analysis_button_from_backend: true,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_grok_image_annotation_enabled: true,
      responsive_web_grok_imagine_annotation_enabled: true,
      responsive_web_grok_community_note_auto_translation_is_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    };

    const fieldToggles = {
      withArticlePlainText: false,
    };

    const queryParams = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(features),
      fieldToggles: JSON.stringify(fieldToggles),
    });

    const url = `${graphqlEndpoint}?${queryParams.toString()}`;

    const headers: HeadersInit = {
      'accept': '*/*',
      'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
      'content-type': 'application/json',
      'referer': `https://x.com/${username}`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': 'en',
      'x-csrf-token': DEFAULT_CSRF_TOKEN,
      'cookie': DEFAULT_COOKIES,
    };

    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      console.error(`Failed to fetch tweets for ${username}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const parsedTweets = parseTweetsFromResponse(data);
    return parsedTweets;
  } catch (error) {
    console.error(`Error fetching tweets for ${username}:`, error);
    return [];
  }
}

async function processAccount(account: { id: number; username: string; user_id: string }) {
  try {
    console.log(`Processing account: @${account.username} (${account.user_id})`);
    
    const fetchedTweets = await fetchTweetsForAccount(account.id, account.username, account.user_id);
    
    // Get the newest tweet we already have for this account
    const newestTweet = tweets.getNewestByAccount(account.id);
    const newestTweetId = newestTweet?.tweet_id;
    
    let newTweetsCount = 0;
    
    // Only add tweets that are newer than what we have
    for (const tweet of fetchedTweets) {
      // Skip if we already have this tweet
      if (newestTweetId && tweet.id === newestTweetId) {
        break; // We've reached tweets we already have
      }
      
      // Add the tweet to database
      tweets.add({
        tweet_id: tweet.id,
        account_id: account.id,
        user_id: tweet.userId,
        username: tweet.userScreenName,
        text: tweet.text,
        created_at: tweet.createdAt,
        like_count: tweet.likeCount,
        retweet_count: tweet.retweetCount,
        reply_count: tweet.replyCount,
        quote_count: tweet.quoteCount,
        view_count: tweet.viewCount || null,
        is_retweet: tweet.isRetweet ? 1 : 0,
        is_reply: tweet.isReply ? 1 : 0,
        media_urls: tweet.media ? JSON.stringify(tweet.media.map(m => m.mediaUrl)) : null,
        urls: tweet.urls ? JSON.stringify(tweet.urls) : null,
        hashtags: tweet.hashtags ? JSON.stringify(tweet.hashtags) : null,
        mentions: tweet.mentions ? JSON.stringify(tweet.mentions) : null,
        raw_data: JSON.stringify(tweet.raw),
      });
      
      newTweetsCount++;
    }
    
    if (newTweetsCount > 0) {
      console.log(`Added ${newTweetsCount} new tweets for @${account.username}`);
    }
  } catch (error) {
    console.error(`Error processing account ${account.id}:`, error);
  }
}

async function runBotCycle() {
  try {
    const allAccounts = accounts.getAll();
    
    if (allAccounts.length === 0) {
      console.log('No accounts to watch');
      return;
    }
    
    console.log(`Running bot cycle for ${allAccounts.length} account(s)...`);
    
    // Process all accounts in parallel
    await Promise.all(allAccounts.map(account => processAccount(account)));
    
    console.log('Bot cycle completed');
  } catch (error) {
    console.error('Error in bot cycle:', error);
  }
}

export function startBot() {
  if (botInterval) {
    console.log('Bot is already running');
    return;
  }
  
  console.log('Starting bot...');
  setBotStatus(true);
  
  // Run immediately
  runBotCycle();
  
  // Then run every minute
  botInterval = setInterval(runBotCycle, BOT_INTERVAL_MS);
  
  console.log('Bot started. Will check for new tweets every minute.');
}

export function stopBot() {
  if (botInterval) {
    clearInterval(botInterval);
    botInterval = null;
  }
  setBotStatus(false);
  console.log('Bot stopped');
}

// Function to restore bot state from database
// Call this on server startup to restore bot if it was running
export function restoreBotState() {
  if (typeof window !== 'undefined') {
    // Don't run on client side
    return;
  }
  
  try {
    const { getBotStatus } = require('./botStatus');
    if (getBotStatus() && !botInterval) {
      console.log('Restoring bot state from database - bot was running before restart');
      startBot();
    }
  } catch (error) {
    console.log('Bot restoration check skipped:', error);
  }
}

