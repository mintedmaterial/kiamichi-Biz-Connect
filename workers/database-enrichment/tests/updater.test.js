import { describe, test, expect, beforeEach } from 'vitest';
import { updateBusinessEmail, batchUpdateEmails } from '../src/updater.js';

describe('Database Updater', () => {
  describe('updateBusinessEmail', () => {
    test('returns update SQL with business ID and email', () => {
      const businessId = 1;
      const email = 'test@example.com';

      const sql = updateBusinessEmail(businessId, email);

      expect(sql).toContain('UPDATE businesses');
      expect(sql).toContain('SET email =');
      expect(sql).toContain('WHERE id =');
      expect(sql).toContain('1');
      expect(sql).toContain('test@example.com');
    });

    test('escapes special characters in email', () => {
      const businessId = 1;
      const email = "test'email@example.com";

      const sql = updateBusinessEmail(businessId, email);

      // Should not contain unescaped single quote
      expect(sql).not.toContain("test'email");
    });

    test('handles null email gracefully', () => {
      const businessId = 1;
      const email = null;

      const sql = updateBusinessEmail(businessId, email);

      expect(sql).toContain('NULL');
    });
  });

  describe('batchUpdateEmails', () => {
    test('generates batch update object for multiple businesses', () => {
      const matches = [
        { dbBusinessId: 1, emails: ['test1@example.com'] },
        { dbBusinessId: 2, emails: ['test2@example.com'] },
        { dbBusinessId: 3, emails: ['test3@example.com'] }
      ];

      const batch = batchUpdateEmails(matches);

      expect(batch).toHaveLength(3);
      expect(batch[0]).toHaveProperty('businessId', 1);
      expect(batch[0]).toHaveProperty('email', 'test1@example.com');
      expect(batch[2]).toHaveProperty('businessId', 3);
      expect(batch[2]).toHaveProperty('email', 'test3@example.com');
    });

    test('uses first email when multiple emails exist', () => {
      const matches = [
        {
          dbBusinessId: 1,
          emails: ['primary@example.com', 'secondary@example.com']
        }
      ];

      const batch = batchUpdateEmails(matches);

      expect(batch[0].email).toBe('primary@example.com');
    });

    test('filters out matches without emails', () => {
      const matches = [
        { dbBusinessId: 1, emails: ['test1@example.com'] },
        { dbBusinessId: 2, emails: [] },
        { dbBusinessId: 3, emails: ['test3@example.com'] }
      ];

      const batch = batchUpdateEmails(matches);

      expect(batch).toHaveLength(2);
      expect(batch.map(b => b.businessId)).toEqual([1, 3]);
    });

    test('handles empty match array', () => {
      const matches = [];

      const batch = batchUpdateEmails(matches);

      expect(batch).toHaveLength(0);
    });
  });
});
