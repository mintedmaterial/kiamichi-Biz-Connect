# Branch 1: Facebook Automation Fix
# Updates posting schedule and timing for CST times

## Changes Made:
# 1. Fixed posting schedule to match CST times (9 AM, 4 PM, 9 PM)
# 2. Expanded time window from ±5 minutes to ±30 minutes
# 3. Updated queue processing logic

-- Fix posting schedule for CST times
-- 9 AM CST = 3 PM UTC (15:00)
-- 4 PM CST = 10 PM UTC (22:00)  
-- 9 PM CST = 3 AM UTC (03:00) next day

-- Delete existing schedule
DELETE FROM facebook_posting_schedule;

-- Insert corrected schedule for CST times
INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both'),
('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both');

-- Verify the fix
SELECT 'Posting schedule fixed for CST times' as status;
SELECT time_slot, hour_utc, minute,
   CASE 
     WHEN hour_utc = 15 THEN '9 AM CST'
     WHEN hour_utc = 22 THEN '4 PM CST' 
     WHEN hour_utc = 3 THEN '9 PM CST'
   END as cst_time
FROM facebook_posting_schedule 
ORDER BY hour_utc;