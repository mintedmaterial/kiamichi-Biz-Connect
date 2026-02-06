import { matchBusinesses } from './matcher.js';

/**
 * Find best matches for extracted businesses against database
 * @param {Array} dbBusinesses - Businesses from database
 * @param {Array} extractedBusinesses - Businesses from extraction
 * @param {number} threshold - Match threshold
 * @returns {Array} Array of match results
 */
export function findBestMatches(dbBusinesses, extractedBusinesses, threshold = 0.8) {
  const matches = [];

  for (const extracted of extractedBusinesses) {
    let bestMatch = null;
    let bestScore = 0;

    // Try matching against all DB businesses
    for (const dbBusiness of dbBusinesses) {
      const match = matchBusinesses(dbBusiness, extracted, threshold);
      
      if (match.isMatch && match.score > bestScore) {
        bestMatch = match;
        bestScore = match.score;
      }
    }

    // If we found a match, add it; otherwise add unmatched entry
    if (bestMatch) {
      matches.push(bestMatch);
    } else {
      matches.push({
        isMatch: false,
        score: 0,
        dbBusinessId: null,
        dbBusinessName: null,
        extractedBusinessName: extracted.name,
        emails: extracted.emails
      });
    }
  }

  return matches;
}

/**
 * Process enrichment for extracted data
 * @param {Object} extractedData - Extracted business data
 * @param {Array} dbBusinesses - Database businesses
 * @returns {Object} Enrichment results
 */
export function processEnrichment(extractedData, dbBusinesses) {
  const businesses = extractedData.businesses || [];
  const matches = findBestMatches(dbBusinesses, businesses);

  const matched = matches.filter(m => m.isMatch).length;
  const unmatched = matches.filter(m => !m.isMatch).length;

  return {
    totalExtracted: businesses.length,
    matched,
    unmatched,
    matches
  };
}
