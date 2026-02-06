import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { isValidEmail, deduplicateEmails } from './email-validator';

/**
 * Extract email addresses from HTML content
 */
export function extractEmailsFromHTML(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails: string[] = [];

  // Extract from plain text
  const textMatches = html.match(emailRegex) || [];
  emails.push(...textMatches);

  // Extract from mailto links
  const $ = cheerio.load(html);
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const email = href.replace('mailto:', '').split('?')[0];
      emails.push(email);
    }
  });

  // Filter valid emails and deduplicate
  const validEmails = emails.filter(email => isValidEmail(email));
  return deduplicateEmails(validEmails);
}

/**
 * Scrape a website for email addresses
 */
export async function scrapeWebsiteForEmails(
  url: string,
  timeoutMs: number = 5000
): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal as any,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KBC-EmailExtractor/1.0)',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return extractEmailsFromHTML(html);
  } catch (error) {
    // Handle network errors, timeouts, etc.
    return [];
  }
}
