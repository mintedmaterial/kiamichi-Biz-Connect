#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parseBusinessCSV } from './csv-parser';
import { extractBusinessEmails } from './extractor';

const execAsync = promisify(exec);

const SSH_HOST = 'Minte@100.84.133.97';
const REMOTE_CSV_DIR = 'C:\\Users\\Minte\\Desktop\\dev-code\\kiamichi-biz-connect\\Businessdata';
const OUTPUT_DIR = './output';
const OUTPUT_FILE = join(OUTPUT_DIR, 'business-emails.json');
const REPORT_FILE = join(OUTPUT_DIR, 'extraction-report.txt');

interface CSVFile {
  name: string;
  path: string;
}

/**
 * List CSV files on remote machine
 */
async function listRemoteCSVFiles(): Promise<CSVFile[]> {
  console.log('📂 Listing CSV files on remote machine...');
  
  try {
    const { stdout } = await execAsync(
      `ssh ${SSH_HOST} "dir /b ${REMOTE_CSV_DIR}\\*.csv"`
    );

    const files = stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.endsWith('.csv'))
      .map(name => ({
        name,
        path: `${REMOTE_CSV_DIR}\\${name}`,
      }));

    console.log(`✅ Found ${files.length} CSV files`);
    return files;
  } catch (error) {
    console.error('❌ Failed to list remote CSV files:', error);
    return [];
  }
}

/**
 * Download and read CSV file from remote machine
 */
async function downloadCSVFile(file: CSVFile): Promise<string | null> {
  console.log(`📥 Downloading ${file.name}...`);
  
  try {
    const { stdout } = await execAsync(
      `ssh ${SSH_HOST} "type ${file.path}"`
    );
    return stdout;
  } catch (error) {
    console.error(`❌ Failed to download ${file.name}:`, error);
    return null;
  }
}

/**
 * Main extraction process
 */
async function main() {
  console.log('🚀 KBC Email Extraction Tool\n');

  // Create output directory
  await mkdir(OUTPUT_DIR, { recursive: true });

  // List remote CSV files
  const csvFiles = await listRemoteCSVFiles();
  if (csvFiles.length === 0) {
    console.error('❌ No CSV files found. Exiting.');
    process.exit(1);
  }

  // Download and process each CSV file
  const allBusinesses = [];
  let filesProcessed = 0;

  for (const file of csvFiles) {
    const csvContent = await downloadCSVFile(file);
    if (!csvContent) continue;

    try {
      const businesses = await parseBusinessCSV(csvContent);
      console.log(`✅ Parsed ${businesses.length} businesses from ${file.name}`);

      // Add source file to each business
      businesses.forEach(b => b.source = file.name);
      allBusinesses.push(...businesses);
      filesProcessed++;
    } catch (error) {
      console.error(`❌ Failed to parse ${file.name}:`, error);
    }
  }

  console.log(`\n📊 Total businesses loaded: ${allBusinesses.length}`);
  console.log(`📁 Files processed: ${filesProcessed}/${csvFiles.length}\n`);

  // Extract emails from websites
  console.log('🌐 Scraping websites for email addresses...');
  console.log('⏳ This may take several minutes...\n');

  const result = await extractBusinessEmails(allBusinesses);

  // Generate report
  const report = generateReport(result, filesProcessed, csvFiles.length);
  console.log('\n' + report);

  // Save results
  await writeFile(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n💾 Results saved to ${OUTPUT_FILE}`);

  await writeFile(REPORT_FILE, report);
  console.log(`📄 Report saved to ${REPORT_FILE}`);

  // Upload to R2
  console.log('\n☁️  Uploading to R2...');
  try {
    await execAsync(
      `wrangler r2 object put atlas-collab-pub/kbc-data/business-emails.json --file=${OUTPUT_FILE} --remote`
    );
    console.log('✅ Uploaded to R2: atlas-collab-pub/kbc-data/business-emails.json');
    
    await execAsync(
      `wrangler r2 object put atlas-collab-pub/kbc-data/extraction-report.txt --file=${REPORT_FILE} --remote`
    );
    console.log('✅ Uploaded report to R2');
  } catch (error) {
    console.error('❌ Failed to upload to R2:', error);
  }

  console.log('\n🎉 Email extraction complete!\n');
}

/**
 * Generate extraction report
 */
function generateReport(result: any, filesProcessed: number, totalFiles: number): string {
  const businessesWithEmails = result.businesses.filter((b: any) => b.emails.length > 0);
  
  return `
==============================================
KBC EMAIL EXTRACTION REPORT
==============================================
Date: ${new Date().toISOString()}

CSV FILES PROCESSED:
  - Files processed: ${filesProcessed}/${totalFiles}

BUSINESS DATA:
  - Total businesses: ${result.stats.totalBusinesses}
  - Businesses with websites: ${result.stats.withWebsites}
  - Businesses with emails found: ${businessesWithEmails.length}

EMAIL EXTRACTION:
  - Total emails extracted: ${result.stats.emailsExtracted}
  - Success rate: ${result.stats.successRate}
  - Average emails per business: ${(result.stats.emailsExtracted / result.stats.totalBusinesses).toFixed(2)}

TOP 10 BUSINESSES BY EMAIL COUNT:
${result.businesses
  .sort((a: any, b: any) => b.emails.length - a.emails.length)
  .slice(0, 10)
  .map((b: any, i: number) => 
    `  ${i + 1}. ${b.name} - ${b.emails.length} email(s)\n     ${b.emails.join(', ')}`
  )
  .join('\n')}

==============================================
`;
}

// Run main process
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
