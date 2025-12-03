'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Filter, RefreshCw, FileText, Globe, Globe2, CheckSquare, Square } from 'lucide-react';
import TweetCard from '@/app/components/TweetCard';

// Client-only time display to avoid hydration errors
function TimeDisplay({ date }: { date: Date }) {
  const [timeString, setTimeString] = useState<string>('');
  
  useEffect(() => {
    setTimeString(date.toLocaleTimeString());
  }, [date]);
  
  if (!timeString) return <span>...</span>;
  return <span>{timeString}</span>;
}

interface Tweet {
  id: number;
  tweet_id: string;
  account_id: number;
  account_name?: string;
  account_username?: string;
  user_id: string;
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
  fetched_at: string;
  ignored: number;
  article_generated: number;
  article_english: string | null;
  article_french: string | null;
  published_english: number;
  published_french: number;
  published_english_link: string | null;
  published_french_link: string | null;
}

interface Filters {
  ignored?: boolean;
  articleGenerated?: boolean;
  publishedEnglish?: boolean;
  publishedFrench?: boolean;
  accountId?: number;
}

async function fetchTweets(filters: Filters = {}, page: number = 1, limit: number = 20) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: ((page - 1) * limit).toString(),
  });

  if (filters.ignored !== undefined) params.append('ignored', filters.ignored.toString());
  if (filters.articleGenerated !== undefined) params.append('articleGenerated', filters.articleGenerated.toString());
  if (filters.publishedEnglish !== undefined) params.append('publishedEnglish', filters.publishedEnglish.toString());
  if (filters.publishedFrench !== undefined) params.append('publishedFrench', filters.publishedFrench.toString());
  if (filters.accountId !== undefined) params.append('accountId', filters.accountId.toString());

  const response = await fetch(`/api/tweets?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch tweets');
  return response.json();
}

async function fetchAccounts() {
  const response = await fetch('/api/accounts');
  if (!response.ok) throw new Error('Failed to fetch accounts');
  return response.json();
}

type TabType = 'notGenerated' | 'generated';

export default function TweetsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('notGenerated');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedTweets, setSelectedTweets] = useState<Set<number>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  // Update filters based on active tab
  useEffect(() => {
    // Reset auto-switch flag when manually changing tabs
    setShouldAutoSwitch(false);
    
    if (activeTab === 'generated') {
      // Show only tweets with articles generated
      setFilters({ articleGenerated: true });
      setPage(1);
    } else {
      // Show tweets without articles generated
      setFilters({ articleGenerated: false });
      setPage(1);
    }
    setSelectedTweets(new Set()); // Clear selection when switching tabs
  }, [activeTab]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tweets', filters, page, activeTab],
    queryFn: () => fetchTweets(filters, page, 20),
    refetchInterval: 2000, // Refetch every 2 seconds for faster updates
    staleTime: 0, // Always consider data stale to get fresh results
  });

  // Track if we should auto-switch tabs (only after generating articles)
  const [shouldAutoSwitch, setShouldAutoSwitch] = useState(false);

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/tweets/stream');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'tweet_update' || data.type === 'article_update') {
        setLastUpdate(new Date());
        // Immediately refetch when article is generated
        refetch();
        
        // Only auto-switch if we're expecting it (after generating articles)
        if (data.type === 'article_update' && shouldAutoSwitch && activeTab === 'notGenerated') {
          setTimeout(() => {
            setActiveTab('generated');
            setShouldAutoSwitch(false); // Reset flag
            refetch();
          }, 2000);
        }
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Don't close on error, let it reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [refetch, activeTab, shouldAutoSwitch]);


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
      console.log(`[Frontend] Generating article for tweet ${id}`);
      
      // Set flag to allow auto-switching after generation completes
      setShouldAutoSwitch(true);
      
      const response = await fetch(`/api/tweets/${id}/article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'both' }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log(`[Frontend] Article generation started for tweet ${id}`);
        // Immediately refetch to see the update
        setTimeout(() => {
          refetch();
        }, 1000);
      } else {
        setShouldAutoSwitch(false); // Reset if generation failed
        console.error('[Frontend] Error generating article:', data);
        alert(`Failed to generate article: ${data.error || data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      setShouldAutoSwitch(false); // Reset if generation failed
      console.error('[Frontend] Error generating article:', error);
      alert(`Failed to generate article: ${error.message || 'Please try again.'}`);
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
        return data; // Return the response data including the link
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish');
      }
    } catch (error: any) {
      console.error('Error publishing article:', error);
      throw error;
    }
  };

  const tweets: Tweet[] = data?.tweets || [];
  const hasMore = tweets.length === 20;

  const handleSelectTweet = (id: number, selected: boolean) => {
    setSelectedTweets(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTweets.size === tweets.length) {
      setSelectedTweets(new Set());
    } else {
      setSelectedTweets(new Set(tweets.map(t => t.id)));
    }
  };

  const handleBulkGenerateArticles = async () => {
    if (selectedTweets.size === 0) {
      alert('Please select at least one tweet');
      return;
    }

    setIsBulkProcessing(true);
    // Set flag to allow auto-switching after bulk generation completes
    setShouldAutoSwitch(true);
    
    try {
      const response = await fetch('/api/tweets/bulk/article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tweetIds: Array.from(selectedTweets),
          language: 'both'
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Bulk article generation completed!\n\nSuccess: ${data.successCount}\nFailed: ${data.failureCount}`);
        setSelectedTweets(new Set());
        
        // Invalidate all tweet queries to force refresh
        queryClient.invalidateQueries({ 
          queryKey: ['tweets'],
          exact: false // Invalidate all queries that start with 'tweets'
        });
        
        // Immediate refetch
        await refetch();
        
        // Multiple refetches to ensure UI updates (articles may take time to generate)
        setTimeout(() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['tweets'], exact: false });
        }, 1000);
        setTimeout(() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['tweets'], exact: false });
        }, 2000);
        setTimeout(() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['tweets'], exact: false });
        }, 3000);
        
        // Auto-switch will happen via SSE when articles are detected
      } else {
        setShouldAutoSwitch(false); // Reset if generation failed
        alert(`Error: ${data.error || 'Failed to generate articles'}`);
      }
    } catch (error: any) {
      setShouldAutoSwitch(false); // Reset if generation failed
      alert(`Error: ${error.message || 'Failed to generate articles'}`);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkPublish = async (language: 'english' | 'french') => {
    if (selectedTweets.size === 0) {
      alert('Please select at least one tweet');
      return;
    }

    // Filter to only tweets with articles generated
    const tweetsWithArticles = tweets.filter(t => 
      selectedTweets.has(t.id) && t.article_generated === 1
    );

    if (tweetsWithArticles.length === 0) {
      alert('Selected tweets must have articles generated first');
      return;
    }

    if (!confirm(`Publish ${tweetsWithArticles.length} article(s) to WordPress (${language})?`)) {
      return;
    }

    setIsBulkProcessing(true);
    try {
      const response = await fetch('/api/tweets/bulk/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tweetIds: tweetsWithArticles.map(t => t.id),
          language
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Bulk publishing completed!\n\nSuccess: ${data.successCount}\nFailed: ${data.failureCount}`);
        setSelectedTweets(new Set());
        
        // Invalidate all tweet queries to force refresh
        queryClient.invalidateQueries({ 
          queryKey: ['tweets'],
          exact: false // Invalidate all queries that start with 'tweets'
        });
        
        // Immediate refetch
        await refetch();
        
        // Multiple refetches to ensure UI updates
        setTimeout(() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['tweets'], exact: false });
        }, 1000);
        setTimeout(() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['tweets'], exact: false });
        }, 2000);
        setTimeout(() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['tweets'], exact: false });
        }, 3000);
      } else {
        alert(`Error: ${data.error || 'Failed to publish articles'}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message || 'Failed to publish articles'}`);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tweets</h1>
          <p className="text-gray-600 mt-1">
            Manage and filter collected tweets
            {lastUpdate && (
              <span className="ml-2 text-xs text-gray-500">
                Last update: <TimeDisplay date={lastUpdate} />
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('notGenerated')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'notGenerated'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Not Generated
          </button>
          <button
            onClick={() => setActiveTab('generated')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'generated'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Generated
          </button>
        </nav>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTweets.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-blue-900">
              {selectedTweets.size} tweet{selectedTweets.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {selectedTweets.size === tweets.length ? (
                <>
                  <CheckSquare className="h-4 w-4" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" />
                  Select All
                </>
              )}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkGenerateArticles}
              disabled={isBulkProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileText className="h-4 w-4" />
              {isBulkProcessing ? 'Generating...' : 'Generate Articles'}
            </button>
            <button
              onClick={() => handleBulkPublish('english')}
              disabled={isBulkProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Globe className="h-4 w-4" />
              Publish (EN)
            </button>
            <button
              onClick={() => handleBulkPublish('french')}
              disabled={isBulkProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Globe2 className="h-4 w-4" />
              Publish (FR)
            </button>
            <button
              onClick={() => setSelectedTweets(new Set())}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filter Tweets</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.ignored === true}
                onChange={(e) =>
                  setFilters({ ...filters, ignored: e.target.checked ? true : undefined })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Show Ignored</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.articleGenerated === true}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    articleGenerated: e.target.checked ? true : undefined,
                  })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Articles Generated</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.publishedEnglish === true}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    publishedEnglish: e.target.checked ? true : undefined,
                  })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Published (EN)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.publishedFrench === true}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    publishedFrench: e.target.checked ? true : undefined,
                  })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Published (FR)</span>
            </label>
            {accountsData?.accounts && (
              <div className="md:col-span-2 lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Account
                </label>
                <select
                  value={filters.accountId || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      accountId: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Accounts</option>
                  {accountsData.accounts.map((account: any) => (
                    <option key={account.id} value={account.id}>
                      {account.name} (@{account.username})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setFilters({})}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Tweets List */}
      {isLoading && tweets.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-500">Loading tweets...</p>
        </div>
      ) : tweets.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-500 mb-4">
            {activeTab === 'generated' 
              ? 'No generated tweets found.' 
              : 'No tweets found.'}
          </p>
          <p className="text-sm text-gray-400">
            {activeTab === 'generated'
              ? 'Tweets with generated articles will appear here.'
              : 'Tweets without generated articles will appear here. Select tweets and click "Generate Articles" to create articles.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {tweets.map((tweet) => (
              <TweetCard
                key={tweet.id}
                tweet={tweet}
                selected={selectedTweets.has(tweet.id)}
                onSelect={handleSelectTweet}
                onIgnore={handleIgnore}
                onGenerateArticle={handleGenerateArticle}
                onPublish={handlePublish}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-4 pt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-700">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
