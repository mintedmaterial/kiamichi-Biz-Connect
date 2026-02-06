import Papa from 'papaparse';

export interface Business {
  name: string;
  address: string;
  phone: string;
  website: string;
  source?: string;
}

/**
 * Parse CSV content and extract business data
 */
export async function parseBusinessCSV(csvContent: string): Promise<Business[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const businesses: Business[] = [];

        for (const row of results.data as any[]) {
          // Skip if no website
          if (!row.Website || row.Website.trim() === '') {
            continue;
          }

          businesses.push({
            name: row.Name || '',
            address: row.Address || '',
            phone: row.Phone || '',
            website: normalizeURL(row.Website),
          });
        }

        resolve(businesses);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

/**
 * Normalize website URLs to ensure they have https:// protocol
 */
function normalizeURL(url: string): string {
  if (!url) return '';
  
  url = url.trim();
  
  // Already has protocol
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Add https://
  return `https://${url}`;
}
