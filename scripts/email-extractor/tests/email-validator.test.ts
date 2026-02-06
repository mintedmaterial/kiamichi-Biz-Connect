import { describe, test, expect } from 'vitest';
import { isValidEmail, deduplicateEmails } from '../src/email-validator';

describe('Email Validator', () => {
  describe('isValidEmail', () => {
    test('validates correct email format', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('valid_email@test-domain.org')).toBe(true);
    });

    test('rejects invalid email format', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('no-at-sign.com')).toBe(false);
      expect(isValidEmail('@no-local.com')).toBe(false);
      expect(isValidEmail('no-domain@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    test('rejects common placeholder emails', () => {
      expect(isValidEmail('example@example.com')).toBe(false);
      expect(isValidEmail('test@test.com')).toBe(false);
      expect(isValidEmail('noreply@example.com')).toBe(false);
    });
  });

  describe('deduplicateEmails', () => {
    test('removes duplicate emails', () => {
      const emails = ['test@example.com', 'info@example.com', 'test@example.com'];
      const unique = deduplicateEmails(emails);
      
      expect(unique).toHaveLength(2);
      expect(unique).toContain('test@example.com');
      expect(unique).toContain('info@example.com');
    });

    test('preserves order of first occurrence', () => {
      const emails = ['c@test.com', 'a@test.com', 'b@test.com', 'a@test.com'];
      const unique = deduplicateEmails(emails);
      
      expect(unique).toEqual(['c@test.com', 'a@test.com', 'b@test.com']);
    });

    test('handles empty array', () => {
      expect(deduplicateEmails([])).toEqual([]);
    });
  });
});
