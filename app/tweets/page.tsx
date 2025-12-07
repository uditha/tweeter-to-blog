'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import TweetCard from '@/app/components/TweetCard';
import { Filter, RefreshCw, User, FileText, MessageSquare, EyeOff, Sparkles, Loader2, CheckSquare, Square } from 'lucide-react';

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
  published_english_link: string | null;
  published_french_link: string | null;
}

interface Account {
  id: number;
  name: string;
  username: string;
  user_id: string;
  created_at: string;
}

type TabType = 'all' | 'with-articles' | 'ignored';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'all',
    label: 'All Tweets',
    icon: MessageSquare,
    description: 'View all tweets from monitored accounts',
  },
  {
    id: 'with-articles',
    label: 'With Articles',
    icon: FileText,
    description: 'Tweets with generated articles',
  },
  {
    id: 'ignored',
    label: 'Ignored',
    icon: EyeOff,
    description: 'Tweets that have been ignored',
  },
];

async function fetchTweets(filters: {
  ignored?: boolean;
  articleGenerated?: boolean;
  accountId?: number;
}) {
  const params = new URLSearchParams();
  if (filters.ignored !== undefined) params.append('ignored', filters.ignored.toString());
  if (filters.articleGenerated !== undefined) params.append('articleGenerated', filters.articleGenerated.toString());
  if (filters.accountId !== undefined && filters.accountId !== '') params.append('accountId', filters.accountId.toString());
  params.append('limit', '100');

  const response = await fetch(`/api/tweets?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch tweets');
  return response.json();
}

async function fetchAccounts(): Promise<Account[]> {
  const response = await fetch('/api/accounts');
  if (!response.ok) throw new Error('Failed to fetch accounts');
  return response.json();
}

export default function TweetsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedTweets, setSelectedTweets] = useState<Set<number>>(new Set());
  const [accountFilter, setAccountFilter] = useState<number | undefined>(undefined);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Build filters based on active tab
  const filters = useMemo(() => {
    const baseFilters: {
      ignored?: boolean;
      articleGenerated?: boolean;
      accountId?: number;
    } = {};

    switch (activeTab) {
      case 'with-articles':
        baseFilters.articleGenerated = true;
        baseFilters.ignored = false;
        break;
      case 'ignored':
        baseFilters.ignored = true;
        break;
      case 'all':
      default:
        // Exclude ignored tweets and tweets with articles from "All Tweets"
        baseFilters.ignored = false;
        baseFilters.articleGenerated = false; // Only show tweets without articles
        break;
    }

    if (accountFilter) {
      baseFilters.accountId = accountFilter;
    }

    return baseFilters;
  }, [activeTab, accountFilter]);

  const { data: tweets, isLoading: tweetsLoading, refetch } = useQuery({
    queryKey: ['tweets', filters, activeTab],
    queryFn: () => fetchTweets(filters),
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 0, // Always consider stale for real-time updates
  });

  const handleSelect = (id: number, selected: boolean) => {
    setSelectedTweets((prev) => {
      const newSelected = new Set(prev);
      if (selected) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      return newSelected;
    });
  };

  const handleIgnore = async (id: number, ignored: boolean) => {
    try {
      const response = await fetch(`/api/tweets/${id}/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignored }),
      });

      if (!response.ok) {
        throw new Error('Failed to update tweet');
      }

      await queryClient.invalidateQueries({ queryKey: ['tweets'] });
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleGenerateArticle = async (id: number) => {
    try {
      const response = await fetch(`/api/tweets/${id}/article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'both' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate article');
      }

      await queryClient.invalidateQueries({ queryKey: ['tweets'] });
      alert('Article generation started! This may take a few moments.');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handlePublish = async (id: number, language: 'english' | 'french') => {
    try {
      const response = await fetch(`/api/tweets/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, published: true }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to publish article');
      }

      const data = await response.json();
      await queryClient.invalidateQueries({ queryKey: ['tweets'] });
      return { link: data.link };
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      throw error;
    }
  };

  const handleBulkGenerateArticles = async () => {
    if (selectedTweets.size === 0) {
      alert('Please select at least one tweet to generate articles for.');
      return;
    }

    if (!confirm(`Generate articles for ${selectedTweets.size} selected tweet(s)? This may take several minutes.`)) {
      return;
    }

    setIsBulkGenerating(true);
    try {
      const response = await fetch('/api/tweets/bulk/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweetIds: Array.from(selectedTweets),
          language: 'both',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate articles');
      }

      const data = await response.json();
      await queryClient.invalidateQueries({ queryKey: ['tweets'] });
      setSelectedTweets(new Set()); // Clear selection

      alert(
        `Bulk article generation completed!\n\n` +
        `✅ Successful: ${data.results.successful}\n` +
        `❌ Failed: ${data.results.failed}\n` +
        `📊 Total: ${data.results.total}`
      );
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleSelectAll = () => {
    if (!tweets) return;
    const allIds = new Set(tweets.map((tweet: Tweet) => tweet.id));
    setSelectedTweets(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedTweets(new Set());
  };

  const selectableTweets = tweets?.filter((tweet: Tweet) => 
    tweet.article_generated === 0 && tweet.ignored === 0
  ) || [];
  
  const allSelectableSelected = selectableTweets.length > 0 && 
    selectableTweets.every((tweet: Tweet) => selectedTweets.has(tweet.id));

  const activeTabConfig = TABS.find((tab) => tab.id === activeTab);
  const isLoading = tweetsLoading || accountsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tweets</h1>
          <p className="mt-2 text-sm text-gray-600">
            {activeTabConfig?.description || 'View and manage tweets from monitored accounts'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedTweets.size > 0 && activeTab !== 'with-articles' && (
            <button
              onClick={handleBulkGenerateArticles}
              disabled={isBulkGenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
              aria-label="Generate articles for selected tweets"
            >
              {isBulkGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Articles ({selectedTweets.size})</span>
                </>
              )}
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
            aria-label="Refresh tweets"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px" aria-label="Tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const tabTweets = tweets?.filter((tweet: Tweet) => {
                if (tab.id === 'with-articles') return tweet.article_generated === 1;
                if (tab.id === 'ignored') return tweet.ignored === 1;
                return true;
              });
              const count = tabTweets?.length || 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedTweets(new Set()); // Clear selection on tab change
                  }}
                  className={`
                    flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${
                      isActive
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`
                        ml-2 px-2 py-0.5 text-xs font-semibold rounded-full
                        ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                      `}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Filters and Bulk Actions */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col gap-4">
            {/* Account Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter by Account:</span>
              </div>
              <select
                value={accountFilter || ''}
                onChange={(e) => setAccountFilter(e.target.value ? parseInt(e.target.value) : undefined)}
                className="flex-1 sm:flex-initial px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                aria-label="Filter by account"
              >
                <option value="">All Accounts</option>
                {accounts?.map((account: Account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} (@{account.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Selection Actions - Only show in "All Tweets" tab */}
            {activeTab === 'all' && selectableTweets.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>
                    {selectedTweets.size > 0 
                      ? `${selectedTweets.size} of ${selectableTweets.length} selected`
                      : `${selectableTweets.length} tweets available for article generation`}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={allSelectableSelected ? handleDeselectAll : handleSelectAll}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center space-x-1"
                  >
                    {allSelectableSelected ? (
                      <>
                        <CheckSquare className="h-4 w-4" />
                        <span>Deselect All</span>
                      </>
                    ) : (
                      <>
                        <Square className="h-4 w-4" />
                        <span>Select All</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tweets List */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-sm text-gray-600">Loading tweets...</p>
          </div>
        </div>
      ) : tweets && tweets.length > 0 ? (
        <div className="space-y-4">
          {tweets.map((tweet: Tweet) => (
            <TweetCard
              key={tweet.id}
              tweet={tweet}
              selected={selectedTweets.has(tweet.id)}
              onSelect={handleSelect}
              onIgnore={handleIgnore}
              onGenerateArticle={handleGenerateArticle}
              onPublish={handlePublish}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="flex flex-col items-center">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 font-medium">
              {activeTab === 'with-articles'
                ? 'No tweets with articles found. Generate articles from tweets first.'
                : activeTab === 'ignored'
                ? 'No ignored tweets found.'
                : 'No tweets found. Start the bot to fetch tweets from monitored accounts.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
