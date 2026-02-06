interface SubscriptionStatus {
  subscribed: boolean;
  unsubscribedAt: Date | null;
}

// In-memory store for tests (will be replaced with D1)
const unsubscribeStore = new Map<string, Date>();

export async function unsubscribeEmail(email: string): Promise<void> {
  unsubscribeStore.set(email, new Date());
}

export async function getSubscriptionStatus(email: string): Promise<SubscriptionStatus> {
  const unsubscribedAt = unsubscribeStore.get(email);
  
  if (unsubscribedAt) {
    return {
      subscribed: false,
      unsubscribedAt: unsubscribedAt
    };
  }

  return {
    subscribed: true,
    unsubscribedAt: null
  };
}
