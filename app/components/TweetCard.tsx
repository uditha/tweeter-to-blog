'use client';

import { formatTweetDate, formatCount } from '@/app/utils/tweetParser';
import { Eye, EyeOff, FileText, Globe, Globe2, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TweetCardProps {
  tweet: {
    id: number;
    tweet_id: string;
    account_name?: string;
    account_username?: string;
    username: string;
    text: string;
    created_at: string;
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
    view_count: number | null;
    is_retweet: number;
    is_reply: number;
    media_urls: string | null;
    urls: string | null;
    hashtags: string | null;
    mentions: string | null;
    ignored: number;
    article_generated: number;
    article_english: string | null;
    article_french: string | null;
    published_english: number;
    published_french: number;
    published_english_link: string | null;
    published_french_link: string | null;
  };
  selected?: boolean;
  onSelect?: (id: number, selected: boolean) => void;
  onIgnore?: (id: number, ignored: boolean) => void;
  onGenerateArticle?: (id: number) => void;
  onPublish?: (id: number, language: 'english' | 'french') => void;
}

export default function TweetCard({
  tweet,
  selected = false,
  onSelect,
  onIgnore,
  onGenerateArticle,
  onPublish,
}: TweetCardProps) {
  const [isIgnoring, setIsIgnoring] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState<{ english?: boolean; french?: boolean }>({});
  
  // Track if article generation is in progress
  const isArticleGenerating = isGenerating;

  const parseJson = (str: string | null): any[] => {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  };

  const mediaUrls = parseJson(tweet.media_urls);
  const urls = parseJson(tweet.urls);
  const hashtags = parseJson(tweet.hashtags);
  const mentions = parseJson(tweet.mentions);

  const handleIgnore = async () => {
    if (!onIgnore) return;
    setIsIgnoring(true);
    try {
      await onIgnore(tweet.id, !tweet.ignored);
    } finally {
      setIsIgnoring(false);
    }
  };

  const handleGenerateArticle = async () => {
    if (!onGenerateArticle) return;
    setIsGenerating(true);
    try {
      await onGenerateArticle(tweet.id);
      // Keep isGenerating true - it will be reset when the tweet data updates
      // The parent component's polling will detect the article_generated change
    } catch (error) {
      console.error('Error generating article:', error);
      setIsGenerating(false); // Only reset on error
    }
    // Don't reset isGenerating on success - let it stay until data updates
  };

  // Reset generating state when article is actually generated
  useEffect(() => {
    if (tweet.article_generated === 1 && isGenerating) {
      setIsGenerating(false);
    }
  }, [tweet.article_generated, isGenerating]);

  const handlePublish = async (language: 'english' | 'french') => {
    if (!onPublish) return;
    setIsPublishing({ ...isPublishing, [language]: true });
    try {
      const response = await onPublish(tweet.id, language);
      if (response && typeof response === 'object' && response !== null && 'link' in response && response.link) {
        // Show success message with link
        if (window.confirm(`Article published successfully!\n\nView it at: ${response.link}\n\nClick OK to open in new tab.`)) {
          window.open(response.link, '_blank');
        }
      }
    } catch (error) {
      console.error('Error publishing article:', error);
      alert('Failed to publish article. Please try again.');
    } finally {
      setIsPublishing({ ...isPublishing, [language]: false });
    }
  };

  if (tweet.ignored) {
    return (
      <div className={`bg-gray-100 border rounded-lg p-4 opacity-60 ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 gap-3">
            {onSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelect(tweet.id, e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
            )}
            <EyeOff className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-500">Tweet ignored</span>
          </div>
          {onIgnore && (
            <button
              onClick={handleIgnore}
              disabled={isIgnoring}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isIgnoring ? 'Unignoring...' : 'Unignore'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded-lg p-6 hover:shadow-md transition-shadow ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
      <div className="flex gap-4">
        {/* Checkbox */}
        {onSelect && (
          <div className="flex-shrink-0 pt-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(tweet.id, e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}
        {/* Media - Left side */}
        {mediaUrls.length > 0 && (
          <div className="flex-shrink-0">
            <div className="flex flex-col gap-2">
              {mediaUrls.slice(0, 3).map((url, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={url}
                    alt={`Media ${idx + 1}`}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                </div>
              ))}
              {mediaUrls.length > 3 && (
                <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                  +{mediaUrls.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content - Right side */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">
                  {tweet.account_name || tweet.username}
                </h3>
                <p className="text-sm text-gray-500">
                  @{tweet.account_username || tweet.username}
                </p>
                {tweet.is_retweet === 1 && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    Retweet
                  </span>
                )}
                {tweet.is_reply === 1 && (
                  <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                    Reply
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {formatTweetDate(tweet.created_at)}
              </p>
            </div>
            {onIgnore && (
              <button
                onClick={handleIgnore}
                disabled={isIgnoring}
                className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 flex-shrink-0"
                title="Ignore tweet"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Tweet content */}
          <p className="text-gray-800 mb-4 whitespace-pre-wrap">{tweet.text}</p>

          {/* URLs */}
          {urls.length > 0 && (
            <div className="mb-4">
              {urls.map((url: any, idx: number) => (
                <a
                  key={idx}
                  href={url.expandedUrl || url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm block mb-1"
                >
                  {url.displayUrl || url.expandedUrl || url.url}
                </a>
              ))}
            </div>
          )}

          {/* Hashtags and mentions */}
          <div className="flex flex-wrap gap-2 mb-4">
            {hashtags.map((hashtag: string, idx: number) => (
              <span
                key={idx}
                className="text-blue-600 hover:underline text-sm"
              >
                #{hashtag}
              </span>
            ))}
            {mentions.map((mention: any, idx: number) => (
              <span
                key={idx}
                className="text-blue-600 hover:underline text-sm"
              >
                @{mention.screenName || mention.screen_name}
              </span>
            ))}
          </div>

          {/* Engagement metrics */}
          <div className="flex items-center gap-6 text-sm text-gray-600 pt-4 border-t border-gray-100 mb-4">
            <span>❤️ {formatCount(tweet.like_count)}</span>
            <span>🔄 {formatCount(tweet.retweet_count)}</span>
            <span>💬 {formatCount(tweet.reply_count)}</span>
            {tweet.quote_count > 0 && (
              <span>📤 {formatCount(tweet.quote_count)}</span>
            )}
            {tweet.view_count !== null && tweet.view_count !== undefined && (
              <span>👁️ {formatCount(tweet.view_count)}</span>
            )}
          </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                  {onGenerateArticle && (
                    <button
                      onClick={handleGenerateArticle}
                      disabled={isGenerating || tweet.article_generated === 1}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        tweet.article_generated === 1
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : isGenerating
                          ? 'bg-yellow-500 text-white animate-pulse'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <FileText className="h-4 w-4" />
                      {isGenerating
                        ? 'Writing Article...'
                        : tweet.article_generated === 1
                        ? 'Article Generated ✓'
                        : 'Generate Article'}
                    </button>
                  )}

        {tweet.article_generated === 1 && onPublish && (
          <>
            <button
              onClick={() => handlePublish('english')}
              disabled={isPublishing.english || tweet.published_english === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tweet.published_english === 1
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Globe className="h-4 w-4" />
              {isPublishing.english
                ? 'Publishing...'
                : tweet.published_english === 1
                ? 'Published (EN)'
                : 'Publish (EN)'}
            </button>
            <button
              onClick={() => handlePublish('french')}
              disabled={isPublishing.french || tweet.published_french === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tweet.published_french === 1
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Globe2 className="h-4 w-4" />
              {isPublishing.french
                ? 'Publishing...'
                : tweet.published_french === 1
                ? 'Published (FR)'
                : 'Publish (FR)'}
            </button>
          </>
        )}

        {/* Blog Links */}
        {(tweet.published_english_link || tweet.published_french_link) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {tweet.published_english_link && (
              <a
                href={tweet.published_english_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Globe className="h-3 w-3" />
                View Blog (EN)
              </a>
            )}
            {tweet.published_french_link && (
              <a
                href={tweet.published_french_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <Globe2 className="h-3 w-3" />
                View Blog (FR)
              </a>
            )}
          </div>
        )}
                </div>
        </div>
      </div>
    </div>
  );
}

