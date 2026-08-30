import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const migrationsDir = resolve(rootDir, 'migrations');
const schemaPath = resolve(rootDir, 'schema.sql');

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => /^\d{3}_.+\.sql$/u.test(file))
  .sort((left, right) => left.localeCompare(right, 'en'));

if (migrationFiles.length === 0) throw new Error('No numbered migrations were found');

const generated = [
  '-- GENERATED FILE. Numbered migrations are the source of truth.',
  '-- Run `npm run schema:generate` after adding a migration.',
  '',
  ...migrationFiles.flatMap((file) => [
    `-- BEGIN ${relative(rootDir, resolve(migrationsDir, file)).replaceAll('\\', '/')}`,
    readFileSync(resolve(migrationsDir, file), 'utf8').replaceAll('\r\n', '\n').trimEnd(),
    `-- END ${relative(rootDir, resolve(migrationsDir, file)).replaceAll('\\', '/')}`,
    ''
  ])
].join('\n');

if (process.argv.includes('--check')) {
  const current = readFileSync(schemaPath, 'utf8').replaceAll('\r\n', '\n');
  if (current !== generated) {
    console.error('schema.sql is stale. Run `npm run schema:generate`.');
    process.exit(1);
  }
  console.log(`schema.sql matches ${migrationFiles.length} numbered migrations.`);
} else {
  writeFileSync(schemaPath, generated, 'utf8');
  console.log(`Generated schema.sql from ${migrationFiles.length} numbered migrations.`);
}
