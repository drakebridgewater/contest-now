import fs from 'fs';
import path from 'path';
import { Database } from 'sqlite3';
import logger from './logger';

interface Migration {
  id: string;
  filename: string;
  sql: string;
}

export class MigrationRunner {
  private db: Database;
  private migrationsDir: string;

  constructor(db: Database, migrationsDir: string = '../../../migrations') {
    this.db = db;
    this.migrationsDir = path.resolve(__dirname, migrationsDir);
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getAppliedMigrations(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id FROM migrations ORDER BY id', (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.id));
      });
    });
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const appliedMigrations = await this.getAppliedMigrations();
    const migrationFiles = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const pendingMigrations: Migration[] = [];

    for (const filename of migrationFiles) {
      const id = filename.replace('.sql', '');
      if (!appliedMigrations.includes(id)) {
        const filePath = path.join(this.migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf-8');
        pendingMigrations.push({ id, filename, sql });
      }
    }

    return pendingMigrations;
  }

  async runMigration(migration: Migration): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`Running migration: ${migration.filename}`);

      // Split SQL by semicolons and execute each statement
      const statements = migration.sql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      const runStatements = async (index: number = 0): Promise<void> => {
        if (index >= statements.length) {
          // Mark migration as applied
          this.db.run(
            'INSERT INTO migrations (id, filename) VALUES (?, ?)',
            [migration.id, migration.filename],
            (err) => {
              if (err) reject(err);
              else {
                logger.info(`Migration completed: ${migration.filename}`);
                resolve();
              }
            }
          );
          return;
        }

        const statement = statements[index];
        if (statement && statement.trim()) {
          this.db.run(statement, (err: Error | null) => {
            if (err) {
              logger.error(`Migration failed at statement ${index + 1}: ${statement}`);
              logger.error(err);
              reject(err);
            } else {
              runStatements(index + 1);
            }
          });
        } else {
          runStatements(index + 1);
        }
      };

      runStatements();
    });
  }

  async runPendingMigrations(): Promise<void> {
    await this.initialize();
    const pendingMigrations = await this.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }
  }
}

export default MigrationRunner;