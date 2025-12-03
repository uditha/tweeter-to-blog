'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBotStatus } from '@/app/hooks/useBotStatus';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

interface Account {
  id: number;
  name: string;
  username: string;
  user_id: string;
  created_at: string;
}

const accountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  username: z.string().min(1, 'Username is required'),
  user_id: z.string().min(1, 'User ID is required'),
});

const settingsSchema = z.object({
  autoMode: z.boolean(),
  wordpressEnglishUrl: z.string().url().optional().or(z.literal('')),
  wordpressFrenchUrl: z.string().url().optional().or(z.literal('')),
  wordpressEnglishUsername: z.string().optional(),
  wordpressFrenchUsername: z.string().optional(),
  wordpressEnglishPassword: z.string().optional(),
  wordpressFrenchPassword: z.string().optional(),
  openaiApiKey: z.string().optional(),
});

async function fetchAccounts() {
  const response = await fetch('/api/accounts');
  if (!response.ok) throw new Error('Failed to fetch accounts');
  return response.json();
}

async function fetchSettings() {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error('Failed to fetch settings');
  return response.json();
}

export default function SettingsPage() {
  const { isRunning: isBotRunning, toggleBot } = useBotStatus();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { data: accountsData, refetch: refetchAccounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const accountForm = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', username: '', user_id: '' },
  });

  const settingsForm = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      autoMode: false,
      wordpressEnglishUrl: '',
      wordpressFrenchUrl: '',
      wordpressEnglishUsername: '',
      wordpressFrenchUsername: '',
      wordpressEnglishPassword: '',
      wordpressFrenchPassword: '',
      openaiApiKey: '',
    },
  });

  useEffect(() => {
    if (settingsData) {
      settingsForm.reset({
        autoMode: settingsData.autoMode || false,
        wordpressEnglishUrl: settingsData.wordpressEnglishUrl || '',
        wordpressFrenchUrl: settingsData.wordpressFrenchUrl || '',
        wordpressEnglishUsername: settingsData.wordpressEnglishUsername || '',
        wordpressFrenchUsername: settingsData.wordpressFrenchUsername || '',
        wordpressEnglishPassword: settingsData.wordpressEnglishPassword || '',
        wordpressFrenchPassword: settingsData.wordpressFrenchPassword || '',
        openaiApiKey: settingsData.openaiApiKey || '',
      });
    }
  }, [settingsData, settingsForm]);

  const handleAddAccount = async (data: z.infer<typeof accountSchema>) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSuccess('Account added successfully!');
        accountForm.reset();
        setShowAddAccount(false);
        refetchAccounts();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add account');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Account deleted successfully!');
        refetchAccounts();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete account');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  const handleSaveSettings = async (data: z.infer<typeof settingsSchema>) => {
    try {
      const updates = Object.entries(data).map(([key, value]) =>
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: String(value) }),
        })
      );

      await Promise.all(updates);
      setSuccess('Settings saved successfully!');
      refetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    }
  };

  const handleToggleBot = async () => {
    try {
      const result = await toggleBot();
      if (result?.success) {
        setSuccess(result.running ? 'Bot started!' : 'Bot stopped!');
        setError('');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to toggle bot');
      setSuccess('');
    }
  };

  const accounts: Account[] = accountsData?.accounts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage accounts, bot settings, and integrations
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      {/* Bot Control */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bot Control</h2>
            <p className="text-sm text-gray-600 mt-1">
              {isBotRunning
                ? 'Bot is running and checking for new tweets every minute'
                : 'Bot is stopped. Start it to begin monitoring accounts'}
            </p>
          </div>
          <button
            onClick={handleToggleBot}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              isBotRunning
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isBotRunning ? (
              <>
                <ToggleRight className="h-5 w-5" />
                Stop Bot
              </>
            ) : (
              <>
                <ToggleLeft className="h-5 w-5" />
                Start Bot
              </>
            )}
          </button>
        </div>
      </div>

      {/* Accounts */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Watched Accounts ({accounts.length})
          </h2>
          <button
            onClick={() => {
              setShowAddAccount(!showAddAccount);
              setError('');
              setSuccess('');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Account
          </button>
        </div>

        {showAddAccount && (
          <form
            onSubmit={accountForm.handleSubmit(handleAddAccount)}
            className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Name
              </label>
              <input
                {...accountForm.register('name')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tesla"
              />
              {accountForm.formState.errors.name && (
                <p className="text-red-600 text-xs mt-1">
                  {accountForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username (without @)
              </label>
              <input
                {...accountForm.register('username')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tesla"
              />
              {accountForm.formState.errors.username && (
                <p className="text-red-600 text-xs mt-1">
                  {accountForm.formState.errors.username.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User ID
              </label>
              <input
                {...accountForm.register('user_id')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="13298072"
              />
              {accountForm.formState.errors.user_id && (
                <p className="text-red-600 text-xs mt-1">
                  {accountForm.formState.errors.user_id.message}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddAccount(false);
                  accountForm.reset();
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {accounts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No accounts added yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{account.name}</h3>
                  <p className="text-sm text-gray-600">@{account.username}</p>
                  <p className="text-xs text-gray-500">ID: {account.user_id}</p>
                </div>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <form
        onSubmit={settingsForm.handleSubmit(handleSaveSettings)}
        className="bg-white border border-gray-200 rounded-lg p-6 space-y-6"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h2>
        </div>

        <div>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              {...settingsForm.register('autoMode')}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">Auto Mode</span>
          </label>
          <p className="text-xs text-gray-500 ml-6">
            Automatically process tweets with sufficient text and images
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">WordPress English</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site URL
                </label>
                <input
                  {...settingsForm.register('wordpressEnglishUrl')}
                  type="url"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  {...settingsForm.register('wordpressEnglishUsername')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password / App Password
                </label>
                <input
                  {...settingsForm.register('wordpressEnglishPassword')}
                  type="password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">WordPress French</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site URL
                </label>
                <input
                  {...settingsForm.register('wordpressFrenchUrl')}
                  type="url"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.fr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  {...settingsForm.register('wordpressFrenchUsername')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password / App Password
                </label>
                <input
                  {...settingsForm.register('wordpressFrenchPassword')}
                  type="password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">OpenAI</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              {...settingsForm.register('openaiApiKey')}
              type="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="sk-..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Required for article generation using OpenAI Assistants API
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Save className="h-5 w-5" />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
