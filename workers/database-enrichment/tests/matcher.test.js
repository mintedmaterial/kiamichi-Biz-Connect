import { describe, test, expect } from 'vitest';
import { matchBusinesses, calculateMatchScore } from '../src/matcher.js';

describe('Business Matcher', () => {
  describe('calculateMatchScore', () => {
    test('returns high score for exact name and address match', () => {
      const dbBusiness = {
        name: 'Test Business',
        address: '123 Main St, City, OK 74000'
      };
      const extractedBusiness = {
        name: 'Test Business',
        address: '123 Main St, City, OK 74000'
      };

      const score = calculateMatchScore(dbBusiness, extractedBusiness);

      expect(score).toBeGreaterThan(0.95);
    });

    test('returns high score for slight name variation', () => {
      const dbBusiness = {
        name: 'Test Business LLC',
        address: '123 Main St, City, OK 74000'
      };
      const extractedBusiness = {
        name: 'Test Business',
        address: '123 Main St, City, OK 74000'
      };

      const score = calculateMatchScore(dbBusiness, extractedBusiness);

      expect(score).toBeGreaterThan(0.85);
    });

    test('returns high score for address variations (St vs Street)', () => {
      const dbBusiness = {
        name: 'Test Business',
        address: '123 Main Street, City, OK 74000'
      };
      const extractedBusiness = {
        name: 'Test Business',
        address: '123 Main St, City, OK 74000'
      };

      const score = calculateMatchScore(dbBusiness, extractedBusiness);

      expect(score).toBeGreaterThan(0.85);
    });

    test('returns low score for different businesses', () => {
      const dbBusiness = {
        name: 'Acme Corporation',
        address: '123 Main St, City, OK 74000'
      };
      const extractedBusiness = {
        name: 'Zenith Industries',
        address: '456 Oak Ave, Town, OK 74001'
      };

      const score = calculateMatchScore(dbBusiness, extractedBusiness);

      expect(score).toBeLessThan(0.5);
    });

    test('handles missing addresses gracefully', () => {
      const dbBusiness = {
        name: 'Test Business',
        address: null
      };
      const extractedBusiness = {
        name: 'Test Business',
        address: '123 Main St, City, OK 74000'
      };

      const score = calculateMatchScore(dbBusiness, extractedBusiness);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    test('is case insensitive', () => {
      const dbBusiness = {
        name: 'TEST BUSINESS',
        address: '123 MAIN ST, CITY, OK 74000'
      };
      const extractedBusiness = {
        name: 'test business',
        address: '123 main st, city, ok 74000'
      };

      const score = calculateMatchScore(dbBusiness, extractedBusiness);

      expect(score).toBeGreaterThan(0.95);
    });
  });

  describe('matchBusinesses', () => {
    test('finds match when score exceeds threshold', () => {
      const dbBusiness = {
        id: 1,
        name: 'Test Business',
        address: '123 Main St, City, OK 74000'
      };
      const extractedBusiness = {
        name: 'Test Business LLC',
        address: '123 Main St, City, OK 74000',
        emails: ['test@example.com']
      };

      const match = matchBusinesses(dbBusiness, extractedBusiness);

      expect(match.isMatch).toBe(true);
      expect(match.score).toBeGreaterThan(0.8);
      expect(match.dbBusinessId).toBe(1);
      expect(match.emails).toEqual(['test@example.com']);
    });

    test('rejects match when score below threshold', () => {
      const dbBusiness = {
        id: 1,
        name: 'Business A',
        address: '123 Main St, City, OK 74000'
      };
      const extractedBusiness = {
        name: 'Business B',
        address: '456 Oak Ave, Town, OK 74001',
        emails: ['test@example.com']
      };

      const match = matchBusinesses(dbBusiness, extractedBusiness);

      expect(match.isMatch).toBe(false);
      expect(match.score).toBeLessThan(0.8);
    });

    test('uses configurable threshold', () => {
      const dbBusiness = {
        id: 1,
        name: 'Test Business',
        address: '123 Main St, City, OK 74000'
      };
      const extractedBusiness = {
        name: 'Test Biz',
        address: '123 Main St, City, OK 74000',
        emails: ['test@example.com']
      };

      const strictMatch = matchBusinesses(dbBusiness, extractedBusiness, 0.9);
      const lenientMatch = matchBusinesses(dbBusiness, extractedBusiness, 0.7);

      expect(strictMatch.isMatch).toBe(false);
      expect(lenientMatch.isMatch).toBe(true);
    });
  });
});
