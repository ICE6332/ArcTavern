import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../db/drizzle.service';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.SECRET_KEY ?? 'arctravern-default-secret-key!!';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

@Injectable()
export class SecretService {
  constructor(private readonly db: DrizzleService) {}

  async get(key: string): Promise<string | null> {
    const row = this.db.get<{ value: string }>('SELECT value FROM secrets WHERE key = ?', [key]);
    if (!row) return null;
    try {
      return decrypt(row.value);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string) {
    const encrypted = encrypt(value);
    const existing = this.db.get('SELECT id FROM secrets WHERE key = ?', [key]);
    if (existing) {
      this.db.run("UPDATE secrets SET value = ?, updated_at = datetime('now') WHERE key = ?", [
        encrypted,
        key,
      ]);
    } else {
      this.db.run('INSERT INTO secrets (key, value) VALUES (?, ?)', [key, encrypted]);
    }
  }

  async remove(key: string) {
    this.db.run('DELETE FROM secrets WHERE key = ?', [key]);
  }

  async listKeys(): Promise<string[]> {
    const rows = this.db.query<{ key: string }>('SELECT key FROM secrets');
    return rows.map((r) => r.key);
  }
}
