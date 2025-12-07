'use client';

import { useQuery } from '@tanstack/react-query';
import ArticleViewer from '@/app/components/ArticleViewer';
import TweetCard from '@/app/components/TweetCard';
import { FileText, RefreshCw } from 'lucide-react';
import { useState } from 'react';

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
  published_english_link: string | null;
  published_french_link: string | null;
}

async function fetchArticles() {
  const response = await fetch('/api/tweets?articleGenerated=true&limit=100');
  if (!response.ok) throw new Error('Failed to fetch articles');
  return response.json();
}

export default function ArticlesPage() {
  const [selectedTweet, setSelectedTweet] = useState<Tweet | null>(null);

  const { data: tweets, isLoading, refetch } = useQuery({
    queryKey: ['articles'],
    queryFn: fetchArticles,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const articles = tweets?.filter((tweet: Tweet) => tweet.article_generated === 1) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
          <p className="mt-2 text-sm text-gray-600">
            View generated articles from tweets
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading articles...</p>
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Articles List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Generated Articles ({articles.length})
              </h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {articles.map((tweet: Tweet) => (
                  <button
                    key={tweet.id}
                    onClick={() => setSelectedTweet(tweet)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTweet?.id === tweet.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      <FileText className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tweet.account_name || tweet.username}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {tweet.text.substring(0, 60)}...
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {tweet.article_english && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              EN
                            </span>
                          )}
                          {tweet.article_french && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              FR
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Article Viewer */}
          <div className="lg:col-span-2 space-y-6">
            {selectedTweet ? (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Original Tweet</h2>
                  <TweetCard
                    tweet={selectedTweet}
                    onIgnore={async () => {}}
                    onGenerateArticle={async () => {}}
                  />
                </div>
                <ArticleViewer
                  articleEnglish={selectedTweet.article_english}
                  articleFrench={selectedTweet.article_french}
                  publishedEnglish={selectedTweet.published_english === 1}
                  publishedFrench={selectedTweet.published_french === 1}
                  publishedEnglishAt={selectedTweet.published_english_at}
                  publishedFrenchAt={selectedTweet.published_french_at}
                />
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select an article from the list to view it</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No articles generated yet. Generate articles from tweets first.</p>
        </div>
      )}
    </div>
  );
}
