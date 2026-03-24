/**
 * JSON file persistence layer for deduplication and data storage
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { createLogger } from '../utils/logger';
import { ContentItem } from '../types';

const logger = createLogger('Storage');

interface StoredItem {
  id: string;
  url: string;
  hash: string;
  title: string;
  source: string;
  storedAt: string;
}

interface DatabaseSchema {
  version: number;
  lastUpdated: string;
  items: StoredItem[];
}

export class JsonDatabase {
  private dbPath: string;
  private retentionDays: number;
  private cache: Map<string, StoredItem> = new Map();
  private initialized = false;

  constructor(dataDir: string, retentionDays: number = 30) {
    this.dbPath = resolve(dataDir, 'sent-articles.json');
    this.retentionDays = retentionDays;
  }

  private ensureDirectory(): void {
    const dir = resolve(this.dbPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private initialize(): void {
    if (this.initialized) return;

    this.ensureDirectory();

    if (existsSync(this.dbPath)) {
      try {
        const data: DatabaseSchema = JSON.parse(readFileSync(this.dbPath, 'utf-8'));
        this.cache.clear();
        data.items.forEach(item => {
          this.cache.set(item.hash, item);
        });
        logger.info(`📦 Loaded ${this.cache.size} items from database`);
      } catch (error) {
        logger.warn('⚠️ Failed to load database, creating new one', { error });
        this.createNewDb();
      }
    } else {
      this.createNewDb();
    }

    this.initialized = true;
  }

  private createNewDb(): void {
    const newDb: DatabaseSchema = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      items: [],
    };
    this.save(newDb);
  }

  private save(data: DatabaseSchema): void {
    this.ensureDirectory();
    writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
  }

  private hashUrl(url: string): string {
    return createHash('sha256').update(url.toLowerCase().trim()).digest('hex');
  }

  isDuplicate(url: string): boolean {
    this.initialize();
    const hash = this.hashUrl(url);
    return this.cache.has(hash);
  }

  add(item: ContentItem): void {
    this.initialize();
    const hash = this.hashUrl(item.url);

    if (this.cache.has(hash)) {
      return;
    }

    const storedItem: StoredItem = {
      id: item.id,
      url: item.url,
      hash,
      title: item.title,
      source: item.source,
      storedAt: new Date().toISOString(),
    };

    this.cache.set(hash, storedItem);
  }

  addBatch(items: ContentItem[]): void {
    items.forEach(item => this.add(item));
  }

  persist(): void {
    this.initialize();

    // Clean old items
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const items: StoredItem[] = [];
    this.cache.forEach(item => {
      if (new Date(item.storedAt) >= cutoffDate) {
        items.push(item);
      }
    });

    const data: DatabaseSchema = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      items,
    };

    this.save(data);
    logger.info(`💾 Database saved with ${items.length} items (${this.cache.size - items.length} expired removed)`);
  }

  getStats(): { total: number; oldest: Date | null } {
    this.initialize();
    let oldest: Date | null = null;

    this.cache.forEach(item => {
      const date = new Date(item.storedAt);
      if (!oldest || date < oldest) {
        oldest = date;
      }
    });

    return {
      total: this.cache.size,
      oldest,
    };
  }

  clear(): void {
    this.cache.clear();
    this.createNewDb();
    logger.info('🗑️ Database cleared');
  }
}

// Helper to save daily digest archive
export function saveDigest(digest: any, dataDir: string): void {
  const digestsDir = resolve(dataDir, 'digests');
  if (!existsSync(digestsDir)) {
    mkdirSync(digestsDir, { recursive: true });
  }

  const filename = `${digest.date}.json`;
  const filepath = resolve(digestsDir, filename);

  writeFileSync(filepath, JSON.stringify(digest, null, 2));
  logger.info(`📄 Digest saved: ${filepath}`);
}
