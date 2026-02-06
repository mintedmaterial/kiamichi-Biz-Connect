import { describe, test, expect } from 'vitest';
import { renderEmailTemplate } from '../src/template-renderer';

describe('Multiple Email Templates', () => {
  test('renders professional services template', () => {
    const business = {
      name: 'Smith Law Firm',
      category: 'Professional',
      address: '456 Oak St, Durant, OK'
    };

    const email = renderEmailTemplate(business, 'professional-services-intro');

    expect(email.subject).toContain('Smith Law Firm');
    expect(email.body).toContain('client scheduling');
    expect(email.body).toContain('Smith Law Firm');
  });

  test('renders retail template', () => {
    const business = {
      name: 'Main Street Boutique',
      category: 'Retail',
      address: '789 Main St, Durant, OK'
    };

    const email = renderEmailTemplate(business, 'retail-intro');

    expect(email.subject).toContain('Main Street Boutique');
    expect(email.body).toContain('inventory management');
    expect(email.body).toContain('customer engagement');
  });

  test('renders health/fitness template', () => {
    const business = {
      name: 'FitLife Gym',
      category: 'Health',
      address: '101 Fitness Way, Durant, OK'
    };

    const email = renderEmailTemplate(business, 'health-fitness-intro');

    expect(email.subject).toContain('FitLife Gym');
    expect(email.body).toContain('member management');
    expect(email.body).toContain('scheduling');
  });

  test('renders home services template', () => {
    const business = {
      name: 'QuickFix Plumbing',
      category: 'Services',
      address: '202 Service Rd, Durant, OK'
    };

    const email = renderEmailTemplate(business, 'home-services-intro');

    expect(email.subject).toContain('QuickFix Plumbing');
    expect(email.body).toContain('job tracking');
    expect(email.body).toContain('customer follow-ups');
  });

  test('throws error for unknown template', () => {
    const business = {
      name: 'Test Business',
      category: 'Unknown',
      address: '123 Test St'
    };

    expect(() => {
      renderEmailTemplate(business, 'unknown-template');
    }).toThrow('Unknown template: unknown-template');
  });
});
