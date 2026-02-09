# AI Business Analyzer - Usage Guide

## ✅ Status: FULLY DEPLOYED AND READY

**Deployment Date:** December 14, 2024
**Version:** 1.0.0

## How to Use the AI Analyzer

### 1. Access the Admin Panel

1. Go to https://kiamichibizconnect.com/admin
2. Log in with your Google account (must be authorized admin)
3. Click on "Manage Businesses" in the navigation

### 2. Analyze a Business

On the Manage Businesses page, you'll see a table of all businesses.

**For each business, you have an "🤖 Analyze" button:**

1. Click the **🤖 Analyze** button next to any business
2. A modal will open showing the analysis progress
3. The analyzer will:
   - Calculate completeness score (0-100)
   - Use AI to identify missing fields
   - Search the web for missing data
   - Generate enrichment suggestions

### 3. Review Suggestions

After analysis completes, you'll see:

**Completeness Score:** Shows how complete the business profile is (0-100)

**Enrichment Suggestions:** A list of suggested improvements, each showing:
- **Field name:** The field being suggested (e.g., "phone", "hours", "description")
- **Current value:** What's currently in the database
- **Suggested value:** What the AI found
- **Confidence score:** How confident the AI is (0-100%)
- **Source:** Where the data was found (website, Facebook, etc.)
- **Status:** pending, approved, rejected, or auto_applied

### 4. Approve or Reject Suggestions

For each **pending** suggestion:

- **✓ Approve** - Applies the suggestion to the business immediately
- **✗ Reject** - Marks the suggestion as rejected

**Tips:**
- High confidence (90%+) suggestions are usually accurate
- Medium confidence (70-89%) should be verified
- Low confidence (<70%) should be checked carefully
- Approved suggestions update the business record immediately
- Rejected suggestions are kept for audit trail

### 5. Understanding Status Colors

**Suggestion Cards:**
- 🟡 Yellow background = Pending review
- 🟢 Green background = Approved
- 🔴 Red background = Rejected
- ⚪ Gray background = Auto-applied (by cron)

**Confidence Scores:**
- 🟢 Green (90%+) = High confidence
- 🟡 Yellow (70-89%) = Medium confidence
- 🔴 Red (<70%) = Low confidence

## Autonomous Mode (Background Processing)

The analyzer runs automatically **3 times per day**:
- 8:00 AM Central
- 2:00 PM Central
- 8:00 PM Central

**What it does:**
1. Selects up to 10 businesses that need updates
2. Analyzes each one
3. **Automatically applies** suggestions with ≥95% confidence
4. Respects daily limit (max 3 auto-updates per business)

**Priority order:**
1. Never analyzed before
2. Completeness score < 80
3. Last analyzed > 7 days ago

## Example Workflow

### Scenario: Analyzing "Bob's Bait Shop"

1. **Click "🤖 Analyze"** next to Bob's Bait Shop

2. **Modal opens** showing:
   ```
   🤖 AI Business Analyzer
   Analyzing: Bob's Bait Shop
   Starting analysis...
   ```

3. **Analysis completes:**
   ```
   ✅ Analysis complete! Completeness Score: 65/100
   ```

4. **View suggestions:**
   ```
   📝 Enrichment Suggestions

   [Suggestion 1]
   phone                      pending       85% confidence
   Current: (empty)
   Suggested: (580) 555-1234
   Source: web_scrape - https://bobsbaitshop.com
   ✓ Approve    ✗ Reject

   [Suggestion 2]
   hours                      pending       92% confidence
   Current: (empty)
   Suggested: Mon-Sat 6am-8pm, Sun 7am-6pm
   Source: web_scrape - https://bobsbaitshop.com
   ✓ Approve    ✗ Reject

   [Suggestion 3]
   email                      pending       78% confidence
   Current: (empty)
   Suggested: info@bobsbaitshop.com
   Source: web_scrape - https://bobsbaitshop.com
   ✓ Approve    ✗ Reject
   ```

5. **Review and approve:**
   - Phone: Click **✓ Approve** (85% is good)
   - Hours: Click **✓ Approve** (92% is very good)
   - Email: Verify on website first, then approve or reject

6. **Result:**
   - Phone and hours are immediately added to the business
   - Completeness score increases
   - Suggestions marked as "approved"
   - Your email is recorded as reviewer

## Tips for Best Results

### ✅ DO:
- Review medium-confidence suggestions carefully
- Check the source URL to verify data
- Approve obvious improvements (phone, hours, etc.)
- Use the analyzer regularly on new businesses
- Monitor the completeness score improvements

### ❌ DON'T:
- Auto-approve low confidence suggestions
- Ignore source information
- Approve data that looks suspicious
- Skip verification for critical fields (contact info)

## Monitoring Performance

### Check Autonomous Updates

View what was auto-applied by cron:

```sql
-- Run in Cloudflare D1 console
SELECT
  es.business_id,
  b.name,
  es.field_name,
  es.suggested_value,
  es.confidence,
  datetime(es.created_at, 'unixepoch') as applied_at
FROM enrichment_suggestions es
JOIN businesses b ON b.id = es.business_id
WHERE es.status = 'auto_applied'
ORDER BY es.created_at DESC
LIMIT 20;
```

### View Completeness Scores

```sql
SELECT
  b.name,
  ba.completeness_score,
  datetime(ba.analysis_date, 'unixepoch') as last_analyzed
FROM business_analysis ba
JOIN businesses b ON b.id = ba.business_id
ORDER BY ba.completeness_score ASC
LIMIT 20;
```

### Check Pending Suggestions

```sql
SELECT
  b.name,
  COUNT(*) as pending_suggestions
FROM enrichment_suggestions es
JOIN businesses b ON b.id = es.business_id
WHERE es.status = 'pending'
GROUP BY b.id, b.name
ORDER BY pending_suggestions DESC;
```

## Troubleshooting

### "Analysis failed" Error

**Possible causes:**
- Business website is down
- Website blocks scraping
- Network timeout

**Solution:**
- Try again later
- Check if business has a website
- Verify website is accessible

### No Suggestions Found

**Reasons:**
- Business profile is already complete
- Website has no additional data
- All data already in database

**This is normal** if completeness score is >80%

### Low Confidence Scores

**Causes:**
- Website has inconsistent data
- AI couldn't extract cleanly
- Multiple conflicting sources

**Solution:**
- Manually verify the data
- Check the source URL
- Reject if uncertain

## Advanced Features

### Bulk Analysis (Coming Soon)

Future feature to analyze multiple businesses at once.

### Custom Confidence Thresholds (Coming Soon)

Ability to adjust auto-apply threshold per field type.

### Webhook Notifications (Coming Soon)

Get notified when analysis completes or auto-updates are applied.

## API Access (For Developers)

### Trigger Analysis

```bash
curl -X POST https://kiamichibizconnect.com/api/admin/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": 123,
    "mode": "manual",
    "adminEmail": "admin@example.com"
  }'
```

### Get Suggestions

```bash
curl https://kiamichibizconnect.com/api/admin/suggestions/123
```

### Review Suggestion

```bash
curl -X POST "https://kiamichibizconnect.com/api/admin/suggestions/456/review?review_action=approve" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewedBy": "admin@example.com",
    "notes": "Verified with business"
  }'
```

## Support

For issues or questions:
1. Check `ANALYZER_STATUS.md` for deployment status
2. Review `ANALYZER_TESTING.md` for troubleshooting
3. View logs in Cloudflare Dashboard
4. Contact admin@kiamichibizconnect.com

## Success Metrics

After 30 days of use, you should see:
- Average completeness score: 50 → 75+
- Complete profiles: 20% → 60%+
- Auto-applied suggestions: 500-1000
- Manual reviews: 200-300

The analyzer will continuously improve your business directory data quality!
