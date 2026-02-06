import type { Business } from './csv-parser';
import { scrapeWebsiteForEmails } from './email-scraper';

export interface BusinessWithEmails extends Business {
  emails: string[];
}

export interface ExtractionStats {
  totalBusinesses: number;
  withWebsites: number;
  emailsExtracted: number;
  successRate: string;
}

export interface ExtractionResult {
  businesses: BusinessWithEmails[];
  stats: ExtractionStats;
}

/**
 * Extract emails from multiple businesses
 */
export async function extractBusinessEmails(
  businesses: Business[]
): Promise<ExtractionResult> {
  const results: BusinessWithEmails[] = [];
  let totalEmails = 0;

  for (const business of businesses) {
    const emails = await scrapeWebsiteForEmails(business.website);
    
    results.push({
      ...business,
      emails,
    });

    totalEmails += emails.length;
  }

  const successRate = businesses.length > 0
    ? `${Math.round((totalEmails / businesses.length) * 100)}%`
    : '0%';

  return {
    businesses: results,
    stats: {
      totalBusinesses: businesses.length,
      withWebsites: businesses.length,
      emailsExtracted: totalEmails,
      successRate,
    },
  };
}
