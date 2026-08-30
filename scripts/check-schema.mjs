import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const wranglerPath = resolve(rootDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const stateRoot = resolve(rootDir, '.wrangler', 'kbc-schema-check');
const schemaState = resolve(stateRoot, 'schema');
const migrationState = resolve(stateRoot, 'migrations');
const databaseName = 'kiamichi-biz-connect-db';

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: rootDir,
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 'no status'}): node ${script} ${args.join(' ')}`);
  }
}

function execute(statePath, args) {
  runNode(wranglerPath, ['d1', 'execute', databaseName, '--local', '--persist-to', statePath, ...args]);
}

function assertContract(statePath) {
  execute(statePath, ['--command', [
    'SELECT',
    '(SELECT COUNT(*) FROM categories) AS categories_count,',
    '(SELECT COUNT(*) FROM businesses) AS businesses_count,',
    '(SELECT COUNT(*) FROM facebook_posts) AS facebook_posts_count,',
    '(SELECT COUNT(*) FROM featured_slots) AS featured_slots_count,',
    '(SELECT COUNT(*) FROM vip_businesses) AS vip_businesses_count,',
    '(SELECT COUNT(*) FROM listing_pages) AS listing_pages_count,',
    '(SELECT COUNT(*) FROM published_pages_r2) AS published_pages_count,',
    '(SELECT COUNT(*) FROM sponsored_auction_tiers) AS sponsored_tiers_count,',
    '(SELECT COUNT(*) FROM square_webhook_events) AS webhook_events_count;'
  ].join(' ')]);
  execute(statePath, ['--command', [
    'SELECT facebook_page_id, facebook_enrichment_status FROM businesses LIMIT 0;',
    'SELECT auction_tier_id FROM ad_placements LIMIT 0;',
    'SELECT layout_version, is_published FROM listing_pages LIMIT 0;'
  ].join(' ')]);
}

function assertFeaturedBootstrap(statePath) {
  execute(statePath, ['--command', [
    "INSERT OR IGNORE INTO businesses (name, slug, category_id, city, state)",
    "VALUES ('Velvet Fringe', 'velvet-fringe-salon',",
    "(SELECT id FROM categories WHERE slug = 'beauty-personal-care' LIMIT 1), 'Idabel', 'OK');"
  ].join(' ')]);
  execute(statePath, ['--file', './seeds/featured-pool.sql']);
  execute(statePath, ['--command', [
    'CREATE TABLE featured_slot_before_rerun AS',
    'SELECT id FROM featured_slots WHERE slot_position = 5;',
    'UPDATE featured_slots SET last_rotated = 12345 WHERE slot_position = 5;'
  ].join(' ')]);
  execute(statePath, ['--file', './seeds/featured-pool.sql']);
  execute(statePath, ['--command', [
    'CREATE TABLE featured_bootstrap_assertion (ok INTEGER CHECK (ok = 1));',
    'INSERT INTO featured_bootstrap_assertion (ok) SELECT CASE WHEN',
    "(SELECT COUNT(*) FROM featured_tier_members ft JOIN businesses b ON b.id = ft.business_id WHERE b.slug = 'velvet-fringe-salon') = 1",
    "AND (SELECT is_featured FROM businesses WHERE slug = 'velvet-fringe-salon') = 1",
    "AND (SELECT COUNT(*) FROM featured_slots fs JOIN businesses b ON b.id = fs.business_id WHERE fs.slot_position = 5 AND b.slug = 'velvet-fringe-salon') = 1",
    'AND (SELECT id FROM featured_slots WHERE slot_position = 5) = (SELECT id FROM featured_slot_before_rerun)',
    'AND (SELECT last_rotated FROM featured_slots WHERE slot_position = 5) = 12345',
    'THEN 1 ELSE 0 END;',
    'DROP TABLE featured_bootstrap_assertion;',
    'DROP TABLE featured_slot_before_rerun;'
  ].join(' ')]);
}

rmSync(stateRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
mkdirSync(schemaState, { recursive: true });
mkdirSync(migrationState, { recursive: true });

try {
  runNode(resolve(scriptDir, 'build-schema.mjs'), ['--check']);
  execute(schemaState, ['--file', './schema.sql']);
  assertContract(schemaState);
  assertFeaturedBootstrap(schemaState);

  const migrations = readdirSync(resolve(rootDir, 'migrations'))
    .filter((file) => /^\d{3}_.+\.sql$/u.test(file))
    .sort((left, right) => left.localeCompare(right, 'en'));
  for (const migration of migrations) {
    execute(migrationState, ['--file', `./migrations/${migration}`]);
  }
  assertContract(migrationState);
  assertFeaturedBootstrap(migrationState);
  console.log(`Validated schema snapshot and ${migrations.length}-migration replay.`);
} finally {
  rmSync(stateRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
