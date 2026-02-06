-- Unsubscribe tracking table
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  unsubscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON email_unsubscribes(email);

-- Campaign tracking table
CREATE TABLE IF NOT EXISTS campaign_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'sent', 'opened', 'clicked'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_id ON campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_email ON campaign_events(campaign_id, email);
CREATE INDEX IF NOT EXISTS idx_event_type ON campaign_events(event_type);
