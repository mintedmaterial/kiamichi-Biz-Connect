import { ratio } from 'fuzzball';

/**
 * Calculate match score between database business and extracted business
 * @param {Object} dbBusiness - Business from database
 * @param {Object} extractedBusiness - Business from extraction
 * @returns {number} Match score between 0 and 1
 */
export function calculateMatchScore(dbBusiness, extractedBusiness) {
  // Normalize strings for comparison
  const normalizeName = (name) => name?.toLowerCase().trim() || '';
  const normalizeAddress = (addr) => addr?.toLowerCase().trim() || '';

  const dbName = normalizeName(dbBusiness.name);
  const extractedName = normalizeName(extractedBusiness.name);
  const dbAddress = normalizeAddress(dbBusiness.address);
  const extractedAddress = normalizeAddress(extractedBusiness.address);

  // Calculate fuzzy match scores
  const nameScore = ratio(dbName, extractedName) / 100;
  
  // Handle missing addresses
  let addressScore = 0;
  if (dbAddress && extractedAddress) {
    addressScore = ratio(dbAddress, extractedAddress) / 100;
  } else if (!dbAddress && !extractedAddress) {
    addressScore = 0.5; // Neutral score if both missing
  } else {
    addressScore = 0.3; // Penalty if one missing
  }

  // Weighted average: 60% name, 40% address
  const combinedScore = (nameScore * 0.6) + (addressScore * 0.4);

  return combinedScore;
}

/**
 * Match a database business with an extracted business
 * @param {Object} dbBusiness - Business from database
 * @param {Object} extractedBusiness - Business from extraction
 * @param {number} threshold - Minimum score to consider a match (default 0.8)
 * @returns {Object} Match result
 */
export function matchBusinesses(dbBusiness, extractedBusiness, threshold = 0.8) {
  const score = calculateMatchScore(dbBusiness, extractedBusiness);
  const isMatch = score >= threshold;

  return {
    isMatch,
    score,
    dbBusinessId: isMatch ? dbBusiness.id : null,
    emails: isMatch ? extractedBusiness.emails : [],
    dbBusinessName: isMatch ? dbBusiness.name : null,
    extractedBusinessName: extractedBusiness.name
  };
}
