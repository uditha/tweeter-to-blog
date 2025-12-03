'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search } from 'lucide-react';
import TweetCard from '@/app/components/TweetCard';
import ArticleViewer from '@/app/components/ArticleViewer';

interface Tweet {
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
  published_english_at: string | null;
  published_french_at: string | null;
}

async function fetchArticles() {
  const response = await fetch('/api/tweets?articleGenerated=true&limit=100');
  if (!response.ok) throw new Error('Failed to fetch articles');
  return response.json();
}

export default function ArticlesPage() {
  const [selectedTweet, setSelectedTweet] = useState<Tweet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['articles'],
    queryFn: fetchArticles,
    refetchInterval: 30000,
  });

  const tweets: Tweet[] = data?.tweets || [];
  const filteredTweets = tweets.filter((tweet) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tweet.text.toLowerCase().includes(query) ||
      tweet.account_name?.toLowerCase().includes(query) ||
      tweet.account_username?.toLowerCase().includes(query) ||
      tweet.article_english?.toLowerCase().includes(query) ||
      tweet.article_french?.toLowerCase().includes(query)
    );
  });

  const handleIgnore = async (id: number, ignored: boolean) => {
    try {
      const response = await fetch(`/api/tweets/${id}/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignored }),
      });
      if (response.ok) {
        refetch();
      }
    } catch (error) {
      console.error('Error ignoring tweet:', error);
    }
  };

  const handleGenerateArticle = async (id: number) => {
    try {
      const response = await fetch(`/api/tweets/${id}/article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'both' }),
      });
      if (response.ok) {
        refetch();
      } else {
        const errorData = await response.json();
        console.error('Error generating article:', errorData.error);
        alert(`Failed to generate article: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating article:', error);
      alert('Failed to generate article. Please try again.');
    }
  };

  const handlePublish = async (id: number, language: 'english' | 'french') => {
    try {
      const response = await fetch(`/api/tweets/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, published: true }),
      });
      if (response.ok) {
        const data = await response.json();
        refetch();
        if (data.link) {
          if (window.confirm(`Article published successfully!\n\nView it at: ${data.link}\n\nClick OK to open in new tab.`)) {
            window.open(data.link, '_blank');
          }
        }
        return data;
      } else {
        const errorData = await response.json();
        alert(`Failed to publish: ${errorData.error || 'Unknown error'}`);
        throw new Error(errorData.error || 'Failed to publish');
      }
    } catch (error: any) {
      console.error('Error publishing article:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Generated Articles</h1>
        <p className="text-gray-600 mt-1">
          View and manage articles generated from tweets
        </p>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search articles by content, account, or article text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Articles List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Articles ({filteredTweets.length})
          </h2>
          {isLoading ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <p className="text-gray-500">Loading articles...</p>
            </div>
          ) : filteredTweets.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No articles found</p>
              <p className="text-sm text-gray-400">
                {searchQuery
                  ? 'Try a different search query'
                  : 'Generate articles from tweets to see them here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {filteredTweets.map((tweet) => (
                <div
                  key={tweet.id}
                  onClick={() => setSelectedTweet(tweet)}
                  className={`bg-white border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTweet?.id === tweet.id
                      ? 'border-blue-500 shadow-md'
                      : 'border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">
                        {tweet.account_name || tweet.username}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {tweet.text}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {tweet.article_english && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        EN
                      </span>
                    )}
                    {tweet.article_french && (
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        FR
                      </span>
                    )}
                    {tweet.published_english === 1 && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                        Published (EN)
                      </span>
                    )}
                    {tweet.published_french === 1 && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                        Published (FR)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Article Viewer */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Article Preview</h2>
          {selectedTweet ? (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Original Tweet</h3>
                <p className="text-sm text-gray-700">{selectedTweet.text}</p>
              </div>
              <ArticleViewer
                articleEnglish={selectedTweet.article_english}
                articleFrench={selectedTweet.article_french}
                publishedEnglish={selectedTweet.published_english === 1}
                publishedFrench={selectedTweet.published_french === 1}
                publishedEnglishAt={selectedTweet.published_english_at}
                publishedFrenchAt={selectedTweet.published_french_at}
              />
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <TweetCard
                  tweet={selectedTweet}
                  onIgnore={handleIgnore}
                  onGenerateArticle={handleGenerateArticle}
                  onPublish={handlePublish}
                />
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select an article to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

