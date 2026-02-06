import { describe, test, expect, beforeEach } from 'vitest';
import { unsubscribeEmail, getSubscriptionStatus } from '../src/unsubscribe';

describe('Unsubscribe Manager', () => {
  test('marks email as unsubscribed', async () => {
    const email = 'test@example.com';

    await unsubscribeEmail(email);

    const status = await getSubscriptionStatus(email);
    expect(status.subscribed).toBe(false);
    expect(status.unsubscribedAt).toBeDefined();
  });

  test('returns subscribed status for new email', async () => {
    const email = 'new@example.com';

    const status = await getSubscriptionStatus(email);

    expect(status.subscribed).toBe(true);
    expect(status.unsubscribedAt).toBeNull();
  });
});
