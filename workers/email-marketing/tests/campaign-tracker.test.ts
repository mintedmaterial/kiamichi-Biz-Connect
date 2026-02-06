import { describe, test, expect } from 'vitest';
import { trackEmailSent, trackEmailOpened, trackEmailClicked, getCampaignStats } from '../src/campaign-tracker';

describe('Campaign Tracker', () => {
  test('tracks email sent event', async () => {
    const campaignId = 'campaign-001';
    const email = 'test@example.com';

    await trackEmailSent(campaignId, email);

    const stats = await getCampaignStats(campaignId);
    expect(stats.sent).toBe(1);
  });

  test('tracks email opened event', async () => {
    const campaignId = 'campaign-002';
    const email = 'test@example.com';

    await trackEmailSent(campaignId, email);
    await trackEmailOpened(campaignId, email);

    const stats = await getCampaignStats(campaignId);
    expect(stats.sent).toBe(1);
    expect(stats.opened).toBe(1);
    expect(stats.openRate).toBe(1.0);
  });

  test('tracks email clicked event', async () => {
    const campaignId = 'campaign-003';
    const email = 'test@example.com';

    await trackEmailSent(campaignId, email);
    await trackEmailClicked(campaignId, email);

    const stats = await getCampaignStats(campaignId);
    expect(stats.clicked).toBe(1);
    expect(stats.clickRate).toBe(1.0);
  });

  test('calculates correct rates with multiple emails', async () => {
    const campaignId = 'campaign-004';

    await trackEmailSent(campaignId, 'user1@example.com');
    await trackEmailSent(campaignId, 'user2@example.com');
    await trackEmailSent(campaignId, 'user3@example.com');
    
    await trackEmailOpened(campaignId, 'user1@example.com');
    await trackEmailOpened(campaignId, 'user2@example.com');
    
    await trackEmailClicked(campaignId, 'user1@example.com');

    const stats = await getCampaignStats(campaignId);
    expect(stats.sent).toBe(3);
    expect(stats.opened).toBe(2);
    expect(stats.clicked).toBe(1);
    expect(stats.openRate).toBeCloseTo(0.67, 2);
    expect(stats.clickRate).toBeCloseTo(0.33, 2);
  });
});
