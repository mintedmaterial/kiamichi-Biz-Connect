import { processEnrichment } from './orchestrator.js';
import { batchUpdateEmails } from './updater.js';
import { generateEnrichmentReport } from './reporter.js';

/**
 * Main enrichment handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/enrich' && request.method === 'POST') {
      return handleEnrichment(env);
    }

    return new Response('KBC Database Enrichment Worker\n\nPOST /enrich - Run enrichment', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

/**
 * Handle enrichment process
 */
async function handleEnrichment(env) {
  const startTime = new Date();

  try {
    // Step 1: Download extracted emails from R2
    console.log('Downloading business-emails.json from R2...');
    const r2Object = await env.R2.get('kbc-data/business-emails.json');
    
    if (!r2Object) {
      return new Response(
        JSON.stringify({ error: 'business-emails.json not found in R2' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const extractedData = await r2Object.json();
    console.log(`Loaded ${extractedData.businesses?.length || 0} extracted businesses`);

    // Step 2: Fetch businesses from D1
    console.log('Fetching businesses from D1...');
    const dbResult = await env.DB.prepare(
      'SELECT id, name, address FROM businesses ORDER BY id'
    ).all();
    
    const dbBusinesses = dbResult.results;
    console.log(`Loaded ${dbBusinesses.length} businesses from database`);

    // Step 3: Process enrichment (matching)
    console.log('Processing matches...');
    const enrichmentResults = processEnrichment(extractedData, dbBusinesses);
    console.log(`Matched: ${enrichmentResults.matched}, Unmatched: ${enrichmentResults.unmatched}`);

    // Step 4: Update D1 database
    console.log('Updating database...');
    const updates = batchUpdateEmails(enrichmentResults.matches.filter(m => m.isMatch));
    
    let updateCount = 0;
    for (const update of updates) {
      await env.DB.prepare(
        'UPDATE businesses SET email = ? WHERE id = ?'
      ).bind(update.email, update.businessId).run();
      updateCount++;
    }
    
    console.log(`Updated ${updateCount} businesses with emails`);

    // Step 5: Generate report
    const endTime = new Date();
    const report = generateEnrichmentReport({
      totalExtracted: enrichmentResults.totalExtracted,
      matched: enrichmentResults.matched,
      unmatched: enrichmentResults.unmatched,
      emailsAdded: updateCount,
      startTime,
      endTime
    }, 'text');

    const jsonReport = generateEnrichmentReport({
      totalExtracted: enrichmentResults.totalExtracted,
      matched: enrichmentResults.matched,
      unmatched: enrichmentResults.unmatched,
      emailsAdded: updateCount,
      startTime,
      endTime
    }, 'json');

    // Step 6: Upload report to R2
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await env.R2.put(
      `kbc-data/enrichment-report-${timestamp}.txt`,
      report,
      { httpMetadata: { contentType: 'text/plain' } }
    );
    
    await env.R2.put(
      `kbc-data/enrichment-report-${timestamp}.json`,
      jsonReport,
      { httpMetadata: { contentType: 'application/json' } }
    );

    console.log('Reports uploaded to R2');
    console.log(report);

    return new Response(
      JSON.stringify({
        success: true,
        ...JSON.parse(jsonReport),
        reportUrl: `https://pub-30a843d7499b4062bd2f2e9cde157bd0.r2.dev/kbc-data/enrichment-report-${timestamp}.json`
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Enrichment failed:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
