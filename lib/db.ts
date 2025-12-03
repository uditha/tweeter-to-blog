import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use /tmp directory in serverless environments (Vercel), otherwise use local data directory
// Note: /tmp is ephemeral in Vercel - data will be lost between deployments
// For production, consider using a proper database (PostgreSQL, MySQL, etc.)
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';
const dbDir = (isVercel || isProduction) ? '/tmp' : path.join(process.cwd(), 'data');
const dbPath = path.join(dbDir, 'tweets.db');

// Ensure data directory exists
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating database directory:', error);
}

// Initialize database with error handling for serverless environments
let db: Database.Database;
try {
  db = new Database(dbPath, {
    // Options for better compatibility with serverless
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });
  // Enable WAL mode for better concurrency in serverless
  try {
    db.pragma('journal_mode = WAL');
  } catch (e) {
    // WAL might not be supported in some environments, continue anyway
    console.warn('WAL mode not available, using default journal mode');
  }
  console.log(`Database initialized at: ${dbPath}`);
} catch (error: any) {
  console.error('Error initializing database:', error);
  console.error('Database path attempted:', dbPath);
  console.error('Error details:', error.message);
  
  // In case of error, try in-memory database as fallback (data won't persist)
  console.warn('⚠️ Falling back to in-memory database (data will NOT persist)');
  console.warn('⚠️ For production on Vercel, consider using Vercel Postgres or another database service');
  try {
    db = new Database(':memory:');
    console.log('In-memory database initialized');
  } catch (fallbackError: any) {
    console.error('Failed to initialize in-memory database:', fallbackError);
    throw new Error('Database initialization failed completely');
  }
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    user_id TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ignored INTEGER DEFAULT 0,
    article_generated INTEGER DEFAULT 0,
    article_english TEXT,
    article_french TEXT,
    published_english INTEGER DEFAULT 0,
    published_french INTEGER DEFAULT 0,
    published_english_at DATETIME,
    published_french_at DATETIME,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tweets_account_id ON tweets(account_id);
  CREATE INDEX IF NOT EXISTS idx_tweets_tweet_id ON tweets(tweet_id);
  CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);
`);

// Migrate existing databases - add new columns if they don't exist
// This must run BEFORE creating indexes on these columns
try {
  db.exec(`ALTER TABLE tweets ADD COLUMN ignored INTEGER DEFAULT 0;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN article_generated INTEGER DEFAULT 0;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN article_english TEXT;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN article_french TEXT;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN published_english INTEGER DEFAULT 0;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN published_french INTEGER DEFAULT 0;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN published_english_at DATETIME;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN published_french_at DATETIME;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN published_english_link TEXT;`);
} catch (e: any) {
  // Column might already exist, ignore
}

try {
  db.exec(`ALTER TABLE tweets ADD COLUMN published_french_link TEXT;`);
} catch (e: any) {
  // Column might already exist, ignore
}

// Create indexes on new columns AFTER migrations
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tweets_ignored ON tweets(ignored);`);
} catch (e: any) {
  // Index might already exist, ignore
}

try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tweets_article_generated ON tweets(article_generated);`);
} catch (e: any) {
  // Index might already exist, ignore
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
  getAll: (): Account[] => {
    return db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as Account[];
  },

  getById: (id: number): Account | null => {
    return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | null;
  },

  add: (name: string, username: string, user_id: string): Account => {
    const result = db.prepare('INSERT INTO accounts (name, username, user_id) VALUES (?, ?, ?)').run(name, username, user_id);
    return accounts.getById(result.lastInsertRowid as number)!;
  },

  delete: (id: number): boolean => {
    const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    return result.changes > 0;
  },

  update: (id: number, name: string, username: string, user_id: string): Account | null => {
    db.prepare('UPDATE accounts SET name = ?, username = ?, user_id = ? WHERE id = ?').run(name, username, user_id, id);
    return accounts.getById(id);
  },
};

// Tweet operations
export const tweets = {
  getAll: (limit: number = 100, offset: number = 0): Tweet[] => {
    return db.prepare(`
      SELECT t.*, a.name as account_name, a.username as account_username
      FROM tweets t
      JOIN accounts a ON t.account_id = a.id
      ORDER BY t.fetched_at DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];
  },

  getByAccount: (accountId: number, limit: number = 100): Tweet[] => {
    return db.prepare(`
      SELECT * FROM tweets 
      WHERE account_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(accountId, limit) as Tweet[];
  },

  getNewestByAccount: (accountId: number): Tweet | null => {
    return db.prepare(`
      SELECT * FROM tweets 
      WHERE account_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(accountId) as Tweet | null;
  },

  add: (tweet: {
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
  }): Tweet | null => {
    try {
      const result = db.prepare(`
        INSERT INTO tweets (
          tweet_id, account_id, user_id, username, text, created_at,
          like_count, retweet_count, reply_count, quote_count, view_count,
          is_retweet, is_reply, media_urls, urls, hashtags, mentions, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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
      );
      return db.prepare('SELECT * FROM tweets WHERE id = ?').get(result.lastInsertRowid) as Tweet;
    } catch (error: any) {
      // Ignore duplicate tweet_id errors
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return null;
      }
      throw error;
    }
  },

  getCount: (): number => {
    return (db.prepare('SELECT COUNT(*) as count FROM tweets').get() as any).count;
  },

  getCountByAccount: (accountId: number): number => {
    return (db.prepare('SELECT COUNT(*) as count FROM tweets WHERE account_id = ?').get(accountId) as any).count;
  },

  updateIgnored: (id: number, ignored: boolean): boolean => {
    const result = db.prepare('UPDATE tweets SET ignored = ? WHERE id = ?').run(ignored ? 1 : 0, id);
    return result.changes > 0;
  },

  updateArticle: (id: number, articleEnglish: string | null, articleFrench: string | null): boolean => {
    const result = db.prepare('UPDATE tweets SET article_generated = 1, article_english = ?, article_french = ? WHERE id = ?').run(articleEnglish, articleFrench, id);
    return result.changes > 0;
  },

  updatePublished: (id: number, language: 'english' | 'french', published: boolean, link?: string | null): boolean => {
    const column = language === 'english' ? 'published_english' : 'published_french';
    const dateColumn = language === 'english' ? 'published_english_at' : 'published_french_at';
    const linkColumn = language === 'english' ? 'published_english_link' : 'published_french_link';
    const dateValue = published ? new Date().toISOString() : null;
    const linkValue = published ? (link || null) : null;
    const result = db.prepare(`UPDATE tweets SET ${column} = ?, ${dateColumn} = ?, ${linkColumn} = ? WHERE id = ?`).run(published ? 1 : 0, dateValue, linkValue, id);
    return result.changes > 0;
  },

  getFiltered: (filters: {
    ignored?: boolean;
    articleGenerated?: boolean;
    publishedEnglish?: boolean;
    publishedFrench?: boolean;
    accountId?: number;
  }, limit: number = 100, offset: number = 0): Tweet[] => {
    let query = `
      SELECT t.*, a.name as account_name, a.username as account_username
      FROM tweets t
      JOIN accounts a ON t.account_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.ignored !== undefined) {
      query += ' AND t.ignored = ?';
      params.push(filters.ignored ? 1 : 0);
    }
    if (filters.articleGenerated !== undefined) {
      query += ' AND t.article_generated = ?';
      params.push(filters.articleGenerated ? 1 : 0);
    }
    if (filters.publishedEnglish !== undefined) {
      query += ' AND t.published_english = ?';
      params.push(filters.publishedEnglish ? 1 : 0);
    }
    if (filters.publishedFrench !== undefined) {
      query += ' AND t.published_french = ?';
      params.push(filters.publishedFrench ? 1 : 0);
    }
    if (filters.accountId !== undefined) {
      query += ' AND t.account_id = ?';
      params.push(filters.accountId);
    }

    query += ' ORDER BY t.fetched_at DESC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params) as any[];
  },
};

// Settings operations
export const settings = {
  get: (key: string): string | null => {
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return result?.value || null;
  },

  set: (key: string, value: string): void => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  },

  getBoolean: (key: string, defaultValue: boolean = false): boolean => {
    const value = settings.get(key);
    if (value === null) return defaultValue;
    return value === 'true' || value === '1';
  },

  setBoolean: (key: string, value: boolean): void => {
    settings.set(key, value ? 'true' : 'false');
  },
};

// Initialize default settings if they don't exist
const defaultSettings = {
  openaiApiKey: 'process.env.OPENAI_API_KEY || ""',
  wordpressEnglishUrl: 'https://udimaxweb.com/blog',
  wordpressEnglishUsername: 'udimax',
  wordpressEnglishPassword: 'process.env.WORDPRESS_ENGLISH_PASSWORD || ""',
  autoMode: 'false',
};

// Only set defaults if settings don't already exist
for (const [key, value] of Object.entries(defaultSettings)) {
  const existing = settings.get(key);
  if (existing === null) {
    settings.set(key, value);
  }
}

export default db;

