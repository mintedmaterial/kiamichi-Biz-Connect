import { describe, test, expect, vi } from 'vitest';
import { extractBusinessEmails, type ExtractionResult } from '../src/extractor';
import type { Business } from '../src/csv-parser';

describe('Email Extractor Integration', () => {
  test('extracts emails from multiple businesses', async () => {
    // Mock businesses with fake websites
    const businesses: Business[] = [
      {
        name: 'Business A',
        address: '123 Main St',
        phone: '555-1111',
        website: 'https://example.com',
      },
      {
        name: 'Business B',
        address: '456 Oak Ave',
        phone: '555-2222',
        website: 'https://test-site.com',
      },
    ];

    // Since we can't control real websites in tests, we'll use a mock
    // In real execution, this will scrape actual websites
    const result = await extractBusinessEmails(businesses);

    expect(result).toBeDefined();
    expect(result.businesses).toHaveLength(2);
    expect(result.stats).toBeDefined();
    expect(result.stats.totalBusinesses).toBe(2);
  });

  test('generates extraction statistics', async () => {
    const businesses: Business[] = [
      {
        name: 'Business A',
        address: '123 Main St',
        phone: '555-1111',
        website: 'https://example.com',
      },
    ];

    const result = await extractBusinessEmails(businesses);

    expect(result.stats.totalBusinesses).toBe(1);
    expect(result.stats.withWebsites).toBe(1);
    expect(result.stats.emailsExtracted).toBeGreaterThanOrEqual(0);
    expect(result.stats.successRate).toBeDefined();
  });

  test('handles businesses with no emails found', async () => {
    const businesses: Business[] = [
      {
        name: 'No Email Business',
        address: '789 Elm St',
        phone: '555-3333',
        website: 'https://example.com',
      },
    ];

    const result = await extractBusinessEmails(businesses);

    // Should still include business even if no emails found
    expect(result.businesses).toHaveLength(1);
    expect(result.businesses[0].emails).toBeDefined();
    expect(Array.isArray(result.businesses[0].emails)).toBe(true);
  });

  test('includes source information in results', async () => {
    const businesses: Business[] = [
      {
        name: 'Business A',
        address: '123 Main St',
        phone: '555-1111',
        website: 'https://example.com',
        source: 'test.csv',
      },
    ];

    const result = await extractBusinessEmails(businesses);

    expect(result.businesses[0].source).toBe('test.csv');
  });

  test('handles empty business list', async () => {
    const result = await extractBusinessEmails([]);

    expect(result.businesses).toEqual([]);
    expect(result.stats.totalBusinesses).toBe(0);
    expect(result.stats.withWebsites).toBe(0);
    expect(result.stats.emailsExtracted).toBe(0);
  });
});
