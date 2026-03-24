import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface DefaultPresetFile {
  name: string;
  apiType: string;
  data: string;
  hash: string;
}

/**
 * Scan the defaults/ directory and return all preset files
 * with their names, types, raw JSON content, and SHA-256 hashes.
 */
export function loadDefaultPresets(): DefaultPresetFile[] {
  const defaultsDir = path.join(__dirname, 'defaults');
  if (!fs.existsSync(defaultsDir)) return [];

  const results: DefaultPresetFile[] = [];

  for (const typeDir of fs.readdirSync(defaultsDir)) {
    const typePath = path.join(defaultsDir, typeDir);
    if (!fs.statSync(typePath).isDirectory()) continue;

    for (const file of fs.readdirSync(typePath)) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(typePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      results.push({
        name: path.parse(file).name,
        apiType: typeDir,
        data: content,
        hash,
      });
    }
  }

  return results;
}
