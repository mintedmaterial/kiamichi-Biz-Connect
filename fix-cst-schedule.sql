-- Fix posting schedule to match desired CST times
-- 9 AM CST = 3 PM UTC (15:00)
-- 4 PM CST = 10 PM UTC (22:00)  
-- 9 PM CST = 3 AM UTC (03:00) next day

-- Delete existing schedule
DELETE FROM facebook_posting_schedule;

-- Insert corrected schedule for desired CST times
INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
  -- 9 AM CST = 3 PM UTC - Morning post
  ('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
  -- 4 PM CST = 10 PM UTC - Afternoon post
  ('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both'),
  -- 9 PM CST = 3 AM UTC (next day) - Evening post  
  ('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both');

-- Verify the fix
SELECT 'Fixed posting schedule for CST times:' as status;
SELECT time_slot, hour_utc, minute, 
       CASE 
         WHEN hour_utc = 15 THEN '9 AM CST'
         WHEN hour_utc = 22 THEN '4 PM CST' 
         WHEN hour_utc = 3 THEN '9 PM CST'
       END as cst_time
FROM facebook_posting_schedule 
ORDER BY hour_utc;