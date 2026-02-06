import { describe, test, expect } from 'vitest';
import { generateEnrichmentReport, formatMatchDetails } from '../src/reporter.js';

describe('Report Generator', () => {
  describe('generateEnrichmentReport', () => {
    test('generates summary with match statistics', () => {
      const results = {
        totalExtracted: 165,
        matched: 150,
        unmatched: 15,
        emailsAdded: 165,
        startTime: new Date('2026-02-06T00:00:00Z'),
        endTime: new Date('2026-02-06T00:05:00Z')
      };

      const report = generateEnrichmentReport(results);

      expect(report).toContain('150 businesses matched');
      expect(report).toContain('165 emails added');
      expect(report).toContain('15 unmatched');
      expect(report).toContain('90.91%');
    });

    test('includes execution time', () => {
      const results = {
        totalExtracted: 100,
        matched: 90,
        unmatched: 10,
        emailsAdded: 100,
        startTime: new Date('2026-02-06T00:00:00Z'),
        endTime: new Date('2026-02-06T00:05:00Z')
      };

      const report = generateEnrichmentReport(results);

      expect(report).toContain('5 minutes');
    });

    test('handles zero matches gracefully', () => {
      const results = {
        totalExtracted: 50,
        matched: 0,
        unmatched: 50,
        emailsAdded: 0,
        startTime: new Date('2026-02-06T00:00:00Z'),
        endTime: new Date('2026-02-06T00:01:00Z')
      };

      const report = generateEnrichmentReport(results);

      expect(report).toContain('0 businesses matched');
      expect(report).toContain('0.00%');
    });

    test('returns valid JSON format', () => {
      const results = {
        totalExtracted: 100,
        matched: 90,
        unmatched: 10,
        emailsAdded: 100,
        startTime: new Date('2026-02-06T00:00:00Z'),
        endTime: new Date('2026-02-06T00:05:00Z')
      };

      const report = generateEnrichmentReport(results, 'json');

      expect(() => JSON.parse(report)).not.toThrow();
      const parsed = JSON.parse(report);
      expect(parsed).toHaveProperty('matched', 90);
      expect(parsed).toHaveProperty('successRate');
    });
  });

  describe('formatMatchDetails', () => {
    test('formats match details with business info', () => {
      const match = {
        dbBusinessId: 1,
        dbBusinessName: 'Test Business',
        extractedBusinessName: 'Test Business LLC',
        score: 0.92,
        emails: ['test@example.com'],
        isMatch: true
      };

      const formatted = formatMatchDetails(match);

      expect(formatted).toContain('Test Business');
      expect(formatted).toContain('Test Business LLC');
      expect(formatted).toContain('0.92');
      expect(formatted).toContain('test@example.com');
    });

    test('handles multiple emails', () => {
      const match = {
        dbBusinessId: 1,
        dbBusinessName: 'Test Business',
        extractedBusinessName: 'Test Business',
        score: 0.95,
        emails: ['info@example.com', 'contact@example.com'],
        isMatch: true
      };

      const formatted = formatMatchDetails(match);

      expect(formatted).toContain('info@example.com');
      expect(formatted).toContain('contact@example.com');
    });

    test('marks non-matches appropriately', () => {
      const match = {
        dbBusinessId: null,
        dbBusinessName: null,
        extractedBusinessName: 'Unknown Business',
        score: 0.45,
        emails: ['test@example.com'],
        isMatch: false
      };

      const formatted = formatMatchDetails(match);

      expect(formatted).toContain('NO MATCH');
      expect(formatted).toContain('0.45');
    });
  });
});
