'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBotStatus } from '@/app/hooks/useBotStatus';
import { 
  MessageSquare, 
  FileText, 
  Globe, 
  Globe2, 
  Activity,
  TrendingUp,
  Settings,
  Play,
  Pause
} from 'lucide-react';
import Link from 'next/link';
// Removed server-side import - using API instead

interface Stats {
  totalTweets: number;
  totalAccounts: number;
  articlesGenerated: number;
  publishedEnglish: number;
  publishedFrench: number;
  ignoredTweets: number;
}

async function fetchStats(): Promise<Stats> {
  const response = await fetch('/api/stats');
  if (!response.ok) throw new Error('Failed to fetch stats');
  const data = await response.json();
  return data;
}

export default function Dashboard() {
  const [isToggling, setIsToggling] = useState(false);
  const { isRunning: isBotRunning, toggleBot } = useBotStatus();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const handleToggleBot = async () => {
    setIsToggling(true);
    try {
      await toggleBot();
    } catch (error) {
      console.error('Error toggling bot:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const statCards = [
    {
      title: 'Total Tweets',
      value: stats?.totalTweets || 0,
      icon: MessageSquare,
      color: 'blue',
      href: '/tweets',
    },
    {
      title: 'Watched Accounts',
      value: stats?.totalAccounts || 0,
      icon: Activity,
      color: 'purple',
      href: '/settings',
    },
    {
      title: 'Articles Generated',
      value: stats?.articlesGenerated || 0,
      icon: FileText,
      color: 'green',
      href: '/articles',
    },
    {
      title: 'Published (EN)',
      value: stats?.publishedEnglish || 0,
      icon: Globe,
      color: 'indigo',
    },
    {
      title: 'Published (FR)',
      value: stats?.publishedFrench || 0,
      icon: Globe2,
      color: 'pink',
    },
    {
      title: 'Ignored Tweets',
      value: stats?.ignoredTweets || 0,
      icon: TrendingUp,
      color: 'gray',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor Twitter accounts and manage article generation
          </p>
        </div>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>

      {/* Bot Control */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${
              isBotRunning ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {isBotRunning ? (
                <Activity className={`h-6 w-6 ${
                  isBotRunning ? 'text-green-600' : 'text-gray-600'
                }`} />
              ) : (
                <Pause className="h-6 w-6 text-gray-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Twitter Monitor
              </h3>
              <p className="text-sm text-gray-600">
                {isBotRunning
                  ? 'Bot is running and checking for new tweets every minute'
                  : 'Bot is stopped. Start it to begin monitoring accounts'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleBot}
            disabled={isToggling}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              isBotRunning
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isBotRunning ? (
              <>
                <Pause className="h-5 w-5" />
                Stop Bot
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Start Bot
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-600',
            purple: 'bg-purple-100 text-purple-600',
            green: 'bg-green-100 text-green-600',
            indigo: 'bg-indigo-100 text-indigo-600',
            pink: 'bg-pink-100 text-pink-600',
            gray: 'bg-gray-100 text-gray-600',
          };

          const content = (
            <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                  <Icon className="h-6 w-6" />
                </div>
                {stat.href && (
                  <Link
                    href={stat.href}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    View →
                  </Link>
                )}
              </div>
              <h3 className="text-sm font-medium text-gray-600 mb-1">
                {stat.title}
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {statsLoading ? '...' : stat.value.toLocaleString()}
              </p>
            </div>
          );

          return stat.href ? (
            <Link key={stat.title} href={stat.href}>
              {content}
            </Link>
          ) : (
            <div key={stat.title}>{content}</div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/tweets"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                View All Tweets
              </h3>
              <p className="text-sm text-gray-600">
                Browse, filter, and manage collected tweets
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/articles"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Generated Articles
              </h3>
              <p className="text-sm text-gray-600">
                View and manage generated articles
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
