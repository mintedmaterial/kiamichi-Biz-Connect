interface CampaignStats {
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

interface CampaignData {
  sent: Set<string>;
  opened: Set<string>;
  clicked: Set<string>;
}

// In-memory store for tests (will be replaced with D1)
const campaignStore = new Map<string, CampaignData>();

function getCampaignData(campaignId: string): CampaignData {
  if (!campaignStore.has(campaignId)) {
    campaignStore.set(campaignId, {
      sent: new Set(),
      opened: new Set(),
      clicked: new Set()
    });
  }
  return campaignStore.get(campaignId)!;
}

export async function trackEmailSent(campaignId: string, email: string): Promise<void> {
  const campaign = getCampaignData(campaignId);
  campaign.sent.add(email);
}

export async function trackEmailOpened(campaignId: string, email: string): Promise<void> {
  const campaign = getCampaignData(campaignId);
  campaign.opened.add(email);
}

export async function trackEmailClicked(campaignId: string, email: string): Promise<void> {
  const campaign = getCampaignData(campaignId);
  campaign.clicked.add(email);
}

export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const campaign = getCampaignData(campaignId);
  
  const sent = campaign.sent.size;
  const opened = campaign.opened.size;
  const clicked = campaign.clicked.size;
  
  return {
    sent,
    opened,
    clicked,
    openRate: sent > 0 ? opened / sent : 0,
    clickRate: sent > 0 ? clicked / sent : 0
  };
}
