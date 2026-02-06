import { describe, test, expect } from 'vitest';
import {
  findBestMatches,
  processEnrichment
} from '../src/orchestrator.js';

describe('Enrichment Orchestrator', () => {
  describe('findBestMatches', () => {
    test('finds best match for each extracted business', () => {
      const dbBusinesses = [
        { id: 1, name: 'Test Business', address: '123 Main St, City, OK' },
        { id: 2, name: 'Another Business', address: '456 Oak Ave, Town, OK' }
      ];
      
      const extractedBusinesses = [
        {
          name: 'Test Business LLC',
          address: '123 Main St, City, OK',
          emails: ['test@example.com']
        }
      ];

      const matches = findBestMatches(dbBusinesses, extractedBusinesses);

      expect(matches).toHaveLength(1);
      expect(matches[0].isMatch).toBe(true);
      expect(matches[0].dbBusinessId).toBe(1);
    });

    test('filters out matches below threshold', () => {
      const dbBusinesses = [
        { id: 1, name: 'Acme Corp', address: '123 Main St' }
      ];
      
      const extractedBusinesses = [
        {
          name: 'Zenith Inc',
          address: '456 Oak Ave',
          emails: ['test@example.com']
        }
      ];

      const matches = findBestMatches(dbBusinesses, extractedBusinesses);

      expect(matches.filter(m => m.isMatch)).toHaveLength(0);
    });

    test('returns unmatched entries', () => {
      const dbBusinesses = [
        { id: 1, name: 'Test Business', address: '123 Main St' }
      ];
      
      const extractedBusinesses = [
        {
          name: 'Test Business',
          address: '123 Main St',
          emails: ['test@example.com']
        },
        {
          name: 'Completely Different',
          address: '789 Pine Rd',
          emails: ['other@example.com']
        }
      ];

      const matches = findBestMatches(dbBusinesses, extractedBusinesses);

      const matched = matches.filter(m => m.isMatch);
      const unmatched = matches.filter(m => !m.isMatch);

      expect(matched).toHaveLength(1);
      expect(unmatched).toHaveLength(1);
    });

    test('selects best match when multiple DB entries are similar', () => {
      const dbBusinesses = [
        { id: 1, name: 'Test Business', address: '123 Main St, City, OK' },
        { id: 2, name: 'Test Business Inc', address: '123 Main Street, City, OK' }
      ];
      
      const extractedBusinesses = [
        {
          name: 'Test Business',
          address: '123 Main St, City, OK',
          emails: ['test@example.com']
        }
      ];

      const matches = findBestMatches(dbBusinesses, extractedBusinesses);

      expect(matches).toHaveLength(1);
      // Should pick ID 1 as it's an exact match
      expect(matches[0].dbBusinessId).toBe(1);
    });
  });

  describe('processEnrichment', () => {
    test('returns summary with statistics', () => {
      const extractedData = {
        businesses: [
          {
            name: 'Test Business',
            address: '123 Main St',
            emails: ['test@example.com']
          }
        ]
      };

      const dbBusinesses = [
        { id: 1, name: 'Test Business', address: '123 Main St' }
      ];

      const result = processEnrichment(extractedData, dbBusinesses);

      expect(result).toHaveProperty('totalExtracted', 1);
      expect(result).toHaveProperty('matched');
      expect(result).toHaveProperty('unmatched');
      expect(result).toHaveProperty('matches');
      expect(result.matches).toBeInstanceOf(Array);
    });

    test('handles empty extracted data', () => {
      const extractedData = { businesses: [] };
      const dbBusinesses = [];

      const result = processEnrichment(extractedData, dbBusinesses);

      expect(result.totalExtracted).toBe(0);
      expect(result.matched).toBe(0);
      expect(result.unmatched).toBe(0);
    });

    test('counts matched and unmatched correctly', () => {
      const extractedData = {
        businesses: [
          { name: 'Matched Business', address: '123 Main St', emails: ['m@ex.com'] },
          { name: 'Unmatched Business', address: '789 Pine', emails: ['u@ex.com'] }
        ]
      };

      const dbBusinesses = [
        { id: 1, name: 'Matched Business', address: '123 Main St' }
      ];

      const result = processEnrichment(extractedData, dbBusinesses);

      expect(result.totalExtracted).toBe(2);
      expect(result.matched).toBeGreaterThan(0);
      expect(result.unmatched).toBeGreaterThan(0);
    });
  });
});
