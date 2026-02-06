#!/usr/bin/env node

/**
 * Manual enrichment script
 * 
 * Usage: node src/enrich.js
 * 
 * This script:
 * 1. Downloads business-emails.json from R2
 * 2. Fetches businesses from D1
 * 3. Matches and enriches
 * 4. Updates D1 database
 * 5. Generates and uploads report
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🚀 KBC Database Enrichment Script\n');

// Step 1: Check if business-emails.json exists
console.log('📥 Step 1: Checking for business-emails.json in R2...');
try {
  execSync(
    'wrangler r2 object get atlas-collab-pub/kbc-data/business-emails.json --file=/tmp/business-emails.json --remote',
    { stdio: 'inherit' }
  );
  console.log('✅ Downloaded business-emails.json\n');
} catch (error) {
  console.error('❌ Failed to download business-emails.json');
  console.error('   Make sure the email extraction script has completed and uploaded the file.');
  console.error('   Expected location: atlas-collab-pub/kbc-data/business-emails.json\n');
  process.exit(1);
}

// Step 2: Trigger enrichment via worker
console.log('🔄 Step 2: Running enrichment process...');
console.log('   This will:');
console.log('   - Match businesses by name + address');
console.log('   - Update D1 database with emails');
console.log('   - Generate enrichment report\n');

try {
  const result = execSync(
    'curl -X POST https://kbc-database-enrichment.srvcflo.workers.dev/enrich',
    { encoding: 'utf-8' }
  );
  
  const data = JSON.parse(result);
  
  if (data.success) {
    console.log('✅ Enrichment completed successfully!\n');
    console.log('📊 Results:');
    console.log(`   - Total extracted: ${data.totalExtracted}`);
    console.log(`   - Matched: ${data.matched}`);
    console.log(`   - Unmatched: ${data.unmatched}`);
    console.log(`   - Emails added: ${data.emailsAdded}`);
    console.log(`   - Success rate: ${data.successRate}%`);
    console.log(`\n📄 Report: ${data.reportUrl}\n`);
  } else {
    console.error('❌ Enrichment failed:', data.error);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to run enrichment:', error.message);
  process.exit(1);
}

// Step 3: Verify updates in D1
console.log('🔍 Step 3: Verifying database updates...');
try {
  const verifyQuery = `
    SELECT 
      COUNT(*) as total,
      COUNT(email) as with_emails,
      ROUND(COUNT(email) * 100.0 / COUNT(*), 2) as email_percentage
    FROM businesses
  `;
  
  const result = execSync(
    `wrangler d1 execute kiamichi-biz-connect-db --remote --command="${verifyQuery}"`,
    { encoding: 'utf-8' }
  );
  
  console.log(result);
  console.log('✅ Verification complete\n');
} catch (error) {
  console.error('⚠️  Could not verify database (non-critical):', error.message);
}

console.log('🎉 All done!');
