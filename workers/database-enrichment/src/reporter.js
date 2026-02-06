/**
 * Generate enrichment report
 * @param {Object} results - Enrichment results
 * @param {string} format - Output format ('text' or 'json')
 * @returns {string} Formatted report
 */
export function generateEnrichmentReport(results, format = 'text') {
  const {
    totalExtracted,
    matched,
    unmatched,
    emailsAdded,
    startTime,
    endTime
  } = results;

  const successRate = totalExtracted > 0 
    ? ((matched / totalExtracted) * 100).toFixed(2)
    : '0.00';

  const durationMs = endTime - startTime;
  const durationMin = Math.round(durationMs / 60000);
  const durationText = durationMin === 1 ? '1 minute' : `${durationMin} minutes`;

  if (format === 'json') {
    return JSON.stringify({
      totalExtracted,
      matched,
      unmatched,
      emailsAdded,
      successRate: parseFloat(successRate),
      durationMs,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    }, null, 2);
  }

  // Text format
  return `
KBC Database Enrichment Report
===============================

Execution Time: ${durationText}

Results:
- Total extracted businesses: ${totalExtracted}
- ${matched} businesses matched
- ${unmatched} unmatched entries
- ${emailsAdded} emails added
- Success rate: ${successRate}%

Timestamp: ${endTime.toISOString()}
`.trim();
}

/**
 * Format match details for logging/reporting
 * @param {Object} match - Match object
 * @returns {string} Formatted match details
 */
export function formatMatchDetails(match) {
  const {
    dbBusinessId,
    dbBusinessName,
    extractedBusinessName,
    score,
    emails,
    isMatch
  } = match;

  if (!isMatch) {
    return `NO MATCH: ${extractedBusinessName} (score: ${score.toFixed(2)})`;
  }

  const emailList = emails.join(', ');
  
  return `
Match (score: ${score.toFixed(2)}):
  DB: ${dbBusinessName} (ID: ${dbBusinessId})
  Extracted: ${extractedBusinessName}
  Emails: ${emailList}
`.trim();
}
