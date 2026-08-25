import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnvFile() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile();

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('Thieu TURSO_DATABASE_URL (dat bien moi truong hoac tao file .env.local)');
  process.exit(1);
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined
});

const DOC_KEY = 'qlclass_doc';

async function main() {
  await client.execute('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
  await client.execute(`CREATE TABLE IF NOT EXISTS files (
    name TEXT PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL,
    data BLOB NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`);

  // 1. Push document chinh
  const docPath = path.join(ROOT, 'data', 'db.json');
  if (!fs.existsSync(docPath)) {
    console.error('Khong thay data/db.json - chay app local truoc de tao du lieu.');
    process.exit(1);
  }
  const doc = fs.readFileSync(docPath, 'utf8');
  JSON.parse(doc); // kiem tra hop le
  await client.execute({
    sql: 'INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v',
    args: [DOC_KEY, doc]
  });
  console.log(`[ok] Da push db.json (${(doc.length / 1024).toFixed(1)} KB)`);

  // 2. Push anh cu trong public/uploads
  const upDir = path.join(ROOT, 'public', 'uploads');
  let n = 0;
  if (fs.existsSync(upDir)) {
    for (const f of fs.readdirSync(upDir)) {
      if (!/^[a-z0-9]+\.(png|jpg|gif|webp)$/i.test(f)) continue;
      const buf = fs.readFileSync(path.join(upDir, f));
      const ext = f.split('.').pop().toLowerCase();
      const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext];
      await client.execute({
        sql: `INSERT INTO files (name, mime, size, data) VALUES (?, ?, ?, ?)
              ON CONFLICT(name) DO UPDATE SET mime = excluded.mime, size = excluded.size, data = excluded.data`,
        args: [f, mime, buf.length, buf]
      });
      n++;
    }
  }
  console.log(`[ok] Da push ${n} anh tu public/uploads`);

  const chk = await client.execute({ sql: 'SELECT length(v) AS len FROM kv WHERE k = ?', args: [DOC_KEY] });
  console.log(`[kiem tra] Doc tren DB: ${Number(chk.rows[0].len)} ky tu`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
