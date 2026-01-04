-- Fix posting schedule to match cron times
-- Current cron: 3, 15, 22 UTC (3 AM, 3 PM, 10 PM)
-- We need posts scheduled for these exact times

-- Delete existing schedule
DELETE FROM facebook_posting_schedule;

-- Insert corrected schedule matching cron times
INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
  -- 3 AM UTC = 9 PM CST (evening post)
  ('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both'),
  -- 3 PM UTC = 9 AM CST (morning post)  
  ('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
  -- 10 PM UTC = 4 PM CST (afternoon post)
  ('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both');

-- Verify the fix
SELECT 'Fixed posting schedule to match cron times' as status;
SELECT time_slot, hour_utc, minute, target_type FROM facebook_posting_schedule ORDER BY hour_utc;