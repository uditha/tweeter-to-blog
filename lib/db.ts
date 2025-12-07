import { Pool, QueryResult } from 'pg';

// Initialize PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_APbdO1pNkz4Z@ep-proud-glade-adurvu64-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Initialize tables
async function initializeTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL,
        user_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tweets (
        id SERIAL PRIMARY KEY,
        tweet_id TEXT NOT NULL UNIQUE,
        account_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        like_count INTEGER DEFAULT 0,
        retweet_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        quote_count INTEGER DEFAULT 0,
        view_count INTEGER,
        is_retweet INTEGER DEFAULT 0,
        is_reply INTEGER DEFAULT 0,
        media_urls TEXT,
        urls TEXT,
        hashtags TEXT,
        mentions TEXT,
        raw_data TEXT,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ignored INTEGER DEFAULT 0,
        article_generated INTEGER DEFAULT 0,
        article_english TEXT,
        article_french TEXT,
        published_english INTEGER DEFAULT 0,
        published_french INTEGER DEFAULT 0,
        published_english_at TIMESTAMP,
        published_french_at TIMESTAMP,
        published_english_link TEXT,
        published_french_link TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tweets_account_id ON tweets(account_id);
      CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
      CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tweets_ignored ON tweets(ignored);
      CREATE INDEX IF NOT EXISTS idx_tweets_article_generated ON tweets(article_generated);
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Initialize tables on module load (with error handling for serverless)
let initializationPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = initializeTables().catch((error) => {
      console.error('Database initialization error:', error);
      // Don't throw - allow retry on first use
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

// Try to initialize, but don't block module load
if (typeof window === 'undefined') {
  // Only run on server
  ensureInitialized().catch(() => {
    // Silently fail - will retry on first database operation
  });
}

export interface Account {
  id: number;
  name: string;
  username: string;
  user_id: string;
  created_at: string;
}

export interface Tweet {
  id: number;
  tweet_id: string;
  account_id: number;
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
  raw_data: string | null;
  fetched_at: string;
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

// Account operations
export const accounts = {
  getAll: async (): Promise<Account[]> => {
    const result = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
    return result.rows as Account[];
  },

  getById: async (id: number): Promise<Account | null> => {
    const result = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
    return result.rows[0] as Account | null || null;
  },

  add: async (name: string, username: string, user_id: string): Promise<Account> => {
    const result = await pool.query(
      'INSERT INTO accounts (name, username, user_id) VALUES ($1, $2, $3) RETURNING *',
      [name, username, user_id]
    );
    return result.rows[0] as Account;
  },

  delete: async (id: number): Promise<boolean> => {
    const result = await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  update: async (id: number, name: string, username: string, user_id: string): Promise<Account | null> => {
    const result = await pool.query(
      'UPDATE accounts SET name = $1, username = $2, user_id = $3 WHERE id = $4 RETURNING *',
      [name, username, user_id, id]
    );
    return result.rows[0] as Account | null || null;
  },
};

// Tweet operations
export const tweets = {
  getAll: async (limit: number = 100, offset: number = 0): Promise<Tweet[]> => {
    const result = await pool.query(`
      SELECT t.*, a.name as account_name, a.username as account_username
      FROM tweets t
      JOIN accounts a ON t.account_id = a.id
      ORDER BY t.fetched_at DESC, t.id DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows as any[];
  },

  getByAccount: async (accountId: number, limit: number = 100): Promise<Tweet[]> => {
    const result = await pool.query(`
      SELECT * FROM tweets 
      WHERE account_id = $1 
      ORDER BY fetched_at DESC, id DESC 
      LIMIT $2
    `, [accountId, limit]);
    return result.rows as Tweet[];
  },

  getNewestByAccount: async (accountId: number): Promise<Tweet | null> => {
    const result = await pool.query(`
      SELECT * FROM tweets 
      WHERE account_id = $1 
      ORDER BY fetched_at DESC, id DESC 
      LIMIT 1
    `, [accountId]);
    return result.rows[0] as Tweet | null || null;
  },

  add: async (tweet: {
    tweet_id: string;
    account_id: number;
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
    raw_data: string | null;
  }): Promise<Tweet | null> => {
    try {
      const result = await pool.query(`
        INSERT INTO tweets (
          tweet_id, account_id, user_id, username, text, created_at,
          like_count, retweet_count, reply_count, quote_count, view_count,
          is_retweet, is_reply, media_urls, urls, hashtags, mentions, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        tweet.tweet_id,
        tweet.account_id,
        tweet.user_id,
        tweet.username,
        tweet.text,
        tweet.created_at,
        tweet.like_count,
        tweet.retweet_count,
        tweet.reply_count,
        tweet.quote_count,
        tweet.view_count,
        tweet.is_retweet,
        tweet.is_reply,
        tweet.media_urls,
        tweet.urls,
        tweet.hashtags,
        tweet.mentions,
        tweet.raw_data
      ]);
      return result.rows[0] as Tweet;
    } catch (error: any) {
      // Ignore duplicate tweet_id errors
      if (error.code === '23505') { // PostgreSQL unique violation
        return null;
      }
      throw error;
    }
  },

  getCount: async (): Promise<number> => {
    const result = await pool.query('SELECT COUNT(*) as count FROM tweets');
    return parseInt(result.rows[0].count, 10);
  },

  getCountByAccount: async (accountId: number): Promise<number> => {
    const result = await pool.query('SELECT COUNT(*) as count FROM tweets WHERE account_id = $1', [accountId]);
    return parseInt(result.rows[0].count, 10);
  },

  updateIgnored: async (id: number, ignored: boolean): Promise<boolean> => {
    const result = await pool.query('UPDATE tweets SET ignored = $1 WHERE id = $2', [ignored ? 1 : 0, id]);
    return (result.rowCount ?? 0) > 0;
  },

  updateArticle: async (id: number, articleEnglish: string | null, articleFrench: string | null): Promise<boolean> => {
    const result = await pool.query(
      'UPDATE tweets SET article_generated = 1, article_english = $1, article_french = $2 WHERE id = $3',
      [articleEnglish, articleFrench, id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  updatePublished: async (id: number, language: 'english' | 'french', published: boolean, link?: string | null): Promise<boolean> => {
    const column = language === 'english' ? 'published_english' : 'published_french';
    const dateColumn = language === 'english' ? 'published_english_at' : 'published_french_at';
    const linkColumn = language === 'english' ? 'published_english_link' : 'published_french_link';
    const dateValue = published ? new Date().toISOString() : null;
    const linkValue = published ? (link || null) : null;
    const result = await pool.query(
      `UPDATE tweets SET ${column} = $1, ${dateColumn} = $2, ${linkColumn} = $3 WHERE id = $4`,
      [published ? 1 : 0, dateValue, linkValue, id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  getFiltered: async (filters: {
    ignored?: boolean;
    articleGenerated?: boolean;
    publishedEnglish?: boolean;
    publishedFrench?: boolean;
    accountId?: number;
  }, limit: number = 100, offset: number = 0): Promise<Tweet[]> => {
    let query = `
      SELECT t.*, a.name as account_name, a.username as account_username
      FROM tweets t
      JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.ignored !== undefined) {
      query += ` AND t.ignored = $${paramIndex}`;
      params.push(filters.ignored ? 1 : 0);
      paramIndex++;
    }
    if (filters.articleGenerated !== undefined) {
      query += ` AND t.article_generated = $${paramIndex}`;
      params.push(filters.articleGenerated ? 1 : 0);
      paramIndex++;
    }
    if (filters.publishedEnglish !== undefined) {
      query += ` AND t.published_english = $${paramIndex}`;
      params.push(filters.publishedEnglish ? 1 : 0);
      paramIndex++;
    }
    if (filters.publishedFrench !== undefined) {
      query += ` AND t.published_french = $${paramIndex}`;
      params.push(filters.publishedFrench ? 1 : 0);
      paramIndex++;
    }
    if (filters.accountId !== undefined) {
      query += ` AND t.account_id = $${paramIndex}`;
      params.push(filters.accountId);
      paramIndex++;
    }

    query += ` ORDER BY t.fetched_at DESC, t.id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows as any[];
  },
};

// Settings operations
export const settings = {
  get: async (key: string): Promise<string | null> => {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return result.rows[0]?.value || null;
  },

  set: async (key: string, value: string): Promise<void> => {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
  },

  getBoolean: async (key: string, defaultValue: boolean = false): Promise<boolean> => {
    const value = await settings.get(key);
    if (value === null) return defaultValue;
    return value === 'true' || value === '1';
  },

  setBoolean: async (key: string, value: boolean): Promise<void> => {
    await settings.set(key, value ? 'true' : 'false');
  },
};

// Initialize default settings if they don't exist
async function initializeDefaultSettings() {
  const defaultSettings = {
    openaiApiKey: 'process.env.OPENAI_API_KEY || ""',
    wordpressEnglishUrl: 'https://udimaxweb.com/blog',
    wordpressEnglishUsername: 'udimax',
    wordpressEnglishPassword: 'process.env.WORDPRESS_ENGLISH_PASSWORD || ""',
    autoMode: 'false',
    autoModeMinChars: '100',
    autoModeRequireMedia: 'true',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = await settings.get(key);
    if (existing === null) {
      if (key === 'autoMode' || key === 'autoModeRequireMedia') {
        await settings.setBoolean(key, value === 'true');
      } else {
        await settings.set(key, value);
      }
    }
  }
}

// Initialize default settings
initializeDefaultSettings().catch(console.error);

export default pool;
