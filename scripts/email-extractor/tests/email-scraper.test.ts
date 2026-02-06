import { describe, test, expect } from 'vitest';
import { extractEmailsFromHTML, scrapeWebsiteForEmails } from '../src/email-scraper';

describe('Email Scraper', () => {
  describe('extractEmailsFromHTML', () => {
    test('extracts emails from HTML content', () => {
      const html = '<html><body>Contact: info@example.com</body></html>';
      
      const emails = extractEmailsFromHTML(html);
      
      expect(emails).toContain('info@example.com');
    });

    test('extracts multiple emails', () => {
      const html = `
        <html>
          <body>
            <p>Contact: info@example.com</p>
            <p>Support: support@example.com</p>
            <a href="mailto:sales@example.com">Sales</a>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHTML(html);
      
      expect(emails).toHaveLength(3);
      expect(emails).toContain('info@example.com');
      expect(emails).toContain('support@example.com');
      expect(emails).toContain('sales@example.com');
    });

    test('extracts emails from mailto links', () => {
      const html = '<a href="mailto:contact@example.com">Email Us</a>';
      
      const emails = extractEmailsFromHTML(html);
      
      expect(emails).toContain('contact@example.com');
    });

    test('deduplicates emails in same HTML', () => {
      const html = `
        <p>info@example.com</p>
        <p>info@example.com</p>
        <p>support@example.com</p>
      `;
      
      const emails = extractEmailsFromHTML(html);
      
      expect(emails).toHaveLength(2);
    });

    test('filters out invalid emails', () => {
      const html = `
        <p>valid@example.com</p>
        <p>invalid-email</p>
        <p>test@test.com</p>
        <p>another@valid.com</p>
      `;
      
      const emails = extractEmailsFromHTML(html);
      
      expect(emails).toContain('valid@example.com');
      expect(emails).toContain('another@valid.com');
      expect(emails).not.toContain('invalid-email');
      expect(emails).not.toContain('test@test.com');
    });

    test('handles HTML with no emails', () => {
      const html = '<html><body><p>No emails here</p></body></html>';
      
      const emails = extractEmailsFromHTML(html);
      
      expect(emails).toEqual([]);
    });
  });

  describe('scrapeWebsiteForEmails', () => {
    test('returns empty array for invalid URL', async () => {
      const emails = await scrapeWebsiteForEmails('not-a-url');
      
      expect(emails).toEqual([]);
    });

    test('handles network errors gracefully', async () => {
      const emails = await scrapeWebsiteForEmails('https://this-domain-does-not-exist-12345.com');
      
      expect(emails).toEqual([]);
    });

    test('returns empty array for timeout', async () => {
      // This will timeout quickly
      const emails = await scrapeWebsiteForEmails('https://httpstat.us/200?sleep=10000', 100);
      
      expect(emails).toEqual([]);
    });
  });
});
