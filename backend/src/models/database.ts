import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { config } from '@/config';
import logger from '@/utils/logger';
import { InternalServerError } from '@/utils/errors';
import { MigrationRunner } from '@/utils/migration';

export class Database {
  private db: sqlite3.Database | null = null;
  private isReady = false;

  constructor() {
    this.initializeDatabase().catch((error) => {
      logger.error('Failed to initialize database:', error);
      this.isReady = false;
    });
  }

  private async initializeDatabase(): Promise<void> {
    await this.init();
  }

  private async init(): Promise<void> {
    try {
      // Debug logging
      logger.info(`Database path: ${config.database.path}`);
      logger.info(`Current working directory: ${process.cwd()}`);
      logger.info(`__dirname: ${__dirname}`);

      // Ensure data directory exists
      const dataDir = path.dirname(config.database.path);
      logger.info(`Data directory: ${dataDir}`);

      if (!fs.existsSync(dataDir)) {
        logger.info(`Creating data directory: ${dataDir}`);
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Check directory permissions
      try {
        const stats = fs.statSync(dataDir);
        logger.info(`Data directory permissions: ${stats.mode.toString(8)}`);
        logger.info(`Data directory owner: uid=${stats.uid}, gid=${stats.gid}`);

        // Test write permissions
        const testFile = path.join(dataDir, 'test-write.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        logger.info('Write test successful');
      } catch (permError) {
        logger.error('Permission check failed:', permError);
      }

      this.db = new sqlite3.Database(config.database.path, (err) => {
        if (err) {
          logger.error('Error opening database:', err);
          logger.error('Database path attempted:', config.database.path);
          this.isReady = false;
        } else {
          logger.info('Connected to SQLite database');
          this.isReady = true;
          this.initializeDatabaseSchema();
        }
      });
    } catch (error) {
      logger.error('Failed to create database connection:', error);
      this.isReady = false;
    }
  }

  private async initializeDatabaseSchema(): Promise<void> {
    if (!this.db) return;

    try {
      // Create modern tables directly (migrations were for development only)
      await this.createModernTables();

      logger.info('Database schema initialized successfully');
    } catch (error) {
      logger.error('Error initializing database schema:', error);
      throw new InternalServerError('Failed to initialize database schema');
    }
  }

  private async createModernTables(): Promise<void> {
    if (!this.db) return;

    const runAsync = promisify(this.db.run.bind(this.db));

    try {
      // Create events table
      await runAsync(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_name TEXT NOT NULL,
          event_date TEXT NOT NULL,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create modern contests table with UUID and expanded contest types
      await runAsync(`
        CREATE TABLE IF NOT EXISTS contests (
          id TEXT PRIMARY KEY,
          event_id INTEGER NOT NULL,
          contest_name TEXT NOT NULL,
          contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer', 'other')),
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        )
      `);

      // Create modern entries table with contest_id as UUID
      await runAsync(`
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_name TEXT NOT NULL,
          contestant_name TEXT NOT NULL,
          contest_id TEXT NOT NULL,
          contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer', 'other')),
          photo_path TEXT NOT NULL,
          allergens TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
        )
      `);

      // Create votes table
      await runAsync(`
        CREATE TABLE IF NOT EXISTS votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voter_name TEXT NOT NULL,
          entry_id INTEGER NOT NULL,
          appearance_rating INTEGER NOT NULL CHECK(appearance_rating >= 1 AND appearance_rating <= 5),
          texture_rating INTEGER NOT NULL CHECK(texture_rating >= 1 AND texture_rating <= 5),
          flavor_rating INTEGER NOT NULL CHECK(flavor_rating >= 1 AND flavor_rating <= 5),
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
          UNIQUE(voter_name, entry_id)
        )
      `);

      logger.info('Modern database tables created/verified successfully');
    } catch (error) {
      logger.error('Error creating modern database tables:', error);
      throw error;
    }
  }

  private async createLegacyTables(): Promise<void> {
    if (!this.db) return;

    const runAsync = promisify(this.db.run.bind(this.db));

    try {
      // Create events table (unchanged)
      await runAsync(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_name TEXT NOT NULL,
          event_date TEXT NOT NULL,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create legacy contests table (will be updated by migration)
      await runAsync(`
        CREATE TABLE IF NOT EXISTS contests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          contest_name TEXT NOT NULL,
          contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer')),
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        )
      `);

      // Create legacy entries table (will be updated by migration)
      await runAsync(`
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_name TEXT NOT NULL,
          contestant_name TEXT NOT NULL,
          contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer')),
          photo_path TEXT NOT NULL,
          allergens TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create votes table (unchanged)
      await runAsync(`
        CREATE TABLE IF NOT EXISTS votes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voter_name TEXT NOT NULL,
          entry_id INTEGER NOT NULL,
          appearance_rating INTEGER NOT NULL CHECK(appearance_rating >= 1 AND appearance_rating <= 5),
          texture_rating INTEGER NOT NULL CHECK(texture_rating >= 1 AND texture_rating <= 5),
          flavor_rating INTEGER NOT NULL CHECK(flavor_rating >= 1 AND flavor_rating <= 5),
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
          UNIQUE(voter_name, entry_id)
        )
      `);

      logger.info('Legacy database tables created/verified successfully');
    } catch (error) {
      logger.error('Error creating legacy database tables:', error);
      throw error;
    }
  }

  public getDb(): sqlite3.Database {
    if (!this.db || !this.isReady) {
      throw new InternalServerError('Database not available');
    }
    return this.db;
  }

  public isDbReady(): boolean {
    return this.isReady;
  }

  public async run(sql: string, params: unknown[] = []): Promise<sqlite3.RunResult> {
    const db = this.getDb();
    return new Promise<sqlite3.RunResult>((resolve, reject) => {
      db.run(sql, params, function (this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  public async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const db = this.getDb();
    const getAsync = promisify(db.get.bind(db)) as (sql: string, params?: unknown[]) => Promise<T | undefined>;
    return getAsync(sql, params);
  }

  public async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this.getDb();
    const allAsync = promisify(db.all.bind(db)) as (sql: string, params?: unknown[]) => Promise<T[]>;
    return allAsync(sql, params);
  }

  public async close(): Promise<void> {
    if (this.db) {
      const closeAsync = promisify(this.db.close.bind(this.db));
      await closeAsync();
      logger.info('Database connection closed');
    }
  }
}

// Singleton instance
export const database = new Database();
export default database;
