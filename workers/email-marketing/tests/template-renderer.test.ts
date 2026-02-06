import { describe, test, expect } from 'vitest';
import { renderEmailTemplate } from '../src/template-renderer';

describe('Template Renderer', () => {
  test('renders restaurant email template with business data', () => {
    const business = {
      name: 'The Cozy Café',
      category: 'Food-dining',
      address: '123 Main St, Durant, OK'
    };

    const email = renderEmailTemplate(business, 'restaurant-intro');

    expect(email.subject).toContain('The Cozy Café');
    expect(email.body).toContain('restaurant operations');
    expect(email.body).toContain('The Cozy Café');
  });
});
