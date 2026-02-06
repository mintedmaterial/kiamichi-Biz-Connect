# Overnight Task: KBC Email Extraction & Marketing Setup

**Branch:** `feat/email-extraction-marketing`  
**Date:** 2026-02-06  
**Agents:** Sub-agents (TDD-driven)  
**Goal:** Extract 165+ business emails from CSV files, enrich D1 database, prepare email marketing infrastructure

---

## Context

**Problem:** KBC has 230 businesses in D1 but only 5 valid email addresses (2% contact rate)

**Solution:** Minte has 11 CSV files on his PC with scraped business data including website URLs. We'll scrape those websites to extract emails.

**Expected Yield:** 165+ emails (72% contact rate)

**Files Location:** `C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect\Businessdata\*.csv`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Email Extraction Script (Node.js on Minte's PC) │
│  - Read CSV files                                        │
│  - Extract website URLs                                  │
│  - Scrape websites for emails                           │
│  - Validate & deduplicate                               │
│  - Output: business-emails.json                         │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼ Upload to R2
┌─────────────────────────────────────────────────────────┐
│ Step 2: D1 Database Enrichment (VPS)                    │
│  - Download business-emails.json from R2               │
│  - Match by business name + address                     │
│  - Update businesses table with emails                  │
│  - Generate enrichment report                           │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Step 3: Email Marketing Infrastructure (Cloudflare)     │
│  - Cloudflare Email Worker                             │
│  - Email templates (category-specific)                  │
│  - Unsubscribe management                               │
│  - Campaign tracking                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Task 1: Email Extraction Script (TDD)

**Location:** Create new directory `/home/flo/kiamichi-Biz-Connect/scripts/email-extractor/`

### Requirements

1. **Read CSV files** from Minte's PC via SSH
2. **Parse CSV** and extract:
   - Business name
   - Address
   - Phone
   - Website URL
3. **Scrape websites** for email addresses
4. **Validate emails** (format + optional MX lookup)
5. **Deduplicate** emails
6. **Output JSON** with structure:
```json
{
  "businesses": [
    {
      "name": "Business Name",
      "address": "123 Main St, City, State ZIP",
      "phone": "(555) 123-4567",
      "website": "https://example.com",
      "emails": ["contact@example.com", "info@example.com"],
      "source": "adventure.csv"
    }
  ],
  "stats": {
    "totalBusinesses": 550,
    "withWebsites": 275,
    "emailsExtracted": 165,
    "successRate": "72%"
  }
}
```

### TDD Implementation Plan

**Test 1: CSV Parsing**
```typescript
test('parses CSV file and extracts business data', async () => {
  const csvContent = `ID,Name,Address,Website,Phone
1,Test Business,"123 Main St, OK",https://test.com,(555) 123-4567`;
  
  const businesses = await parseBusinessCSV(csvContent);
  
  expect(businesses).toHaveLength(1);
  expect(businesses[0].name).toBe('Test Business');
  expect(businesses[0].website).toBe('https://test.com');
});
```

**Test 2: Website Scraping**
```typescript
test('extracts emails from website HTML', async () => {
  const html = '<html><body>Contact: info@example.com</body></html>';
  
  const emails = extractEmailsFromHTML(html);
  
  expect(emails).toContain('info@example.com');
});
```

**Test 3: Email Validation**
```typescript
test('validates email format', () => {
  expect(isValidEmail('test@example.com')).toBe(true);
  expect(isValidEmail('invalid-email')).toBe(false);
  expect(isValidEmail('no-at-sign.com')).toBe(false);
});
```

**Test 4: Deduplication**
```typescript
test('removes duplicate emails', () => {
  const emails = ['test@example.com', 'info@example.com', 'test@example.com'];
  
  const unique = deduplicateEmails(emails);
  
  expect(unique).toHaveLength(2);
  expect(unique).toContain('test@example.com');
  expect(unique).toContain('info@example.com');
});
```

**Test 5: End-to-End**
```typescript
test('extracts and validates emails from multiple businesses', async () => {
  const businesses = [
    { name: 'Business A', website: 'https://a.com' },
    { name: 'Business B', website: 'https://b.com' }
  ];
  
  const result = await extractBusinessEmails(businesses);
  
  expect(result.stats.totalBusinesses).toBe(2);
  expect(result.businesses[0].emails).toBeDefined();
});
```

### Dependencies

```json
{
  "dependencies": {
    "papaparse": "^5.4.1",
    "node-fetch": "^3.3.2",
    "cheerio": "^1.0.0-rc.12",
    "email-validator": "^2.0.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/papaparse": "^5.3.14",
    "vitest": "^1.2.0",
    "typescript": "^5.3.3"
  }
}
```

### Files to Create

1. `scripts/email-extractor/package.json`
2. `scripts/email-extractor/tsconfig.json`
3. `scripts/email-extractor/src/csv-parser.ts`
4. `scripts/email-extractor/src/email-scraper.ts`
5. `scripts/email-extractor/src/email-validator.ts`
6. `scripts/email-extractor/src/main.ts`
7. `scripts/email-extractor/tests/csv-parser.test.ts`
8. `scripts/email-extractor/tests/email-scraper.test.ts`
9. `scripts/email-extractor/tests/email-validator.test.ts`
10. `scripts/email-extractor/tests/integration.test.ts`

### Execution Steps

1. **Setup project**
   ```bash
   cd /home/flo/kiamichi-Biz-Connect/scripts
   mkdir email-extractor && cd email-extractor
   npm init -y
   npm install papaparse node-fetch cheerio email-validator
   npm install -D @types/node @types/papaparse vitest typescript
   ```

2. **Write tests first** (RED)
3. **Implement minimal code** (GREEN)
4. **Refactor** (keep tests green)
5. **Run extraction**
   ```bash
   npm test  # All tests pass
   npm run extract  # Run extraction script
   ```

6. **Upload results to R2**
   ```bash
   wrangler r2 object put atlas-collab-pub/kbc-data/business-emails.json \
     --file=output/business-emails.json --remote
   ```

---

## Task 2: D1 Database Enrichment (TDD)

**Location:** Create `/home/flo/kiamichi-Biz-Connect/workers/database-enrichment/`

### Requirements

1. **Download** `business-emails.json` from R2
2. **Match businesses** by name + address similarity
3. **Update D1** `businesses` table with email addresses
4. **Generate report** showing:
   - Matches found
   - Emails added
   - Unmatched entries
   - Success rate

### TDD Implementation Plan

**Test 1: Business Matching**
```typescript
test('matches business by name and address', () => {
  const dbBusiness = { name: 'Test Business', address: '123 Main St, OK' };
  const extractedBusiness = { name: 'Test Business', address: '123 Main Street, OK' };
  
  const match = matchBusinesses(dbBusiness, extractedBusiness);
  
  expect(match.score).toBeGreaterThan(0.8);
  expect(match.isMatch).toBe(true);
});
```

**Test 2: Email Update**
```typescript
test('updates business email in D1', async () => {
  const businessId = 1;
  const email = 'test@example.com';
  
  await updateBusinessEmail(businessId, email);
  
  const updated = await getBusinessById(businessId);
  expect(updated.email).toBe('test@example.com');
});
```

**Test 3: Report Generation**
```typescript
test('generates enrichment report', async () => {
  const results = {
    matched: 150,
    unmatched: 15,
    emailsAdded: 165
  };
  
  const report = generateEnrichmentReport(results);
  
  expect(report).toContain('150 businesses matched');
  expect(report).toContain('165 emails added');
});
```

### Files to Create

1. `workers/database-enrichment/src/matcher.ts`
2. `workers/database-enrichment/src/updater.ts`
3. `workers/database-enrichment/src/reporter.ts`
4. `workers/database-enrichment/src/index.ts`
5. `workers/database-enrichment/tests/*.test.ts`

---

## Task 3: Email Marketing Infrastructure (TDD)

**Location:** Create `/home/flo/kiamichi-Biz-Connect/workers/email-marketing/`

### Requirements

1. **Email Worker** (Cloudflare Email Worker)
2. **Templates** for different business categories:
   - Restaurants/Food: "AI assistant for restaurant operations"
   - Professional Services: "Automate client scheduling and follow-ups"
   - Retail: "Inventory management and customer engagement"
3. **Unsubscribe** management (store in D1)
4. **Campaign tracking** (open rates, click-through)

### TDD Implementation Plan

**Test 1: Template Rendering**
```typescript
test('renders email template with business data', () => {
  const business = { name: 'Test Restaurant', category: 'Food-dining' };
  
  const email = renderEmailTemplate(business, 'restaurant-intro');
  
  expect(email.subject).toContain('Test Restaurant');
  expect(email.body).toContain('restaurant operations');
});
```

**Test 2: Unsubscribe Handling**
```typescript
test('marks email as unsubscribed', async () => {
  const email = 'test@example.com';
  
  await unsubscribeEmail(email);
  
  const status = await getSubscriptionStatus(email);
  expect(status.subscribed).toBe(false);
});
```

**Test 3: Campaign Tracking**
```typescript
test('tracks email campaign metrics', async () => {
  const campaignId = 'campaign-001';
  
  await trackEmailSent(campaignId, 'test@example.com');
  await trackEmailOpened(campaignId, 'test@example.com');
  
  const stats = await getCampaignStats(campaignId);
  expect(stats.sent).toBe(1);
  expect(stats.opened).toBe(1);
  expect(stats.openRate).toBe(1.0);
});
```

### Files to Create

1. `workers/email-marketing/src/templates/*.ts`
2. `workers/email-marketing/src/sender.ts`
3. `workers/email-marketing/src/tracker.ts`
4. `workers/email-marketing/src/unsubscribe.ts`
5. `workers/email-marketing/wrangler.toml`
6. `workers/email-marketing/tests/*.test.ts`

---

## Sub-Agent Task Assignment

### Sub-Agent 1: Email Extraction Script
**Goal:** Build and test email extraction tool
**Deliverables:**
- All tests passing
- Extracted `business-emails.json` uploaded to R2
- Extraction report with stats

**Checklist:**
- [ ] Project scaffolding complete
- [ ] All tests written first (RED)
- [ ] Implementation (GREEN)
- [ ] Refactoring complete
- [ ] End-to-end test passes
- [ ] Extraction run successfully
- [ ] Results uploaded to R2

### Sub-Agent 2: D1 Database Enrichment
**Goal:** Match and enrich KBC database with extracted emails
**Deliverables:**
- Matching algorithm tested and working
- D1 database updated
- Enrichment report generated

**Checklist:**
- [ ] Business matching tests pass
- [ ] Email update tests pass
- [ ] Report generation tests pass
- [ ] Integration test passes
- [ ] Database enriched successfully
- [ ] Report uploaded to R2

### Sub-Agent 3: Email Marketing Infrastructure
**Goal:** Build email campaign system
**Deliverables:**
- Email templates for all categories
- Cloudflare Email Worker deployed
- Tracking system in place
- Unsubscribe mechanism working

**Checklist:**
- [ ] Template tests pass
- [ ] Sender tests pass
- [ ] Tracker tests pass
- [ ] Unsubscribe tests pass
- [ ] Worker deployed to Cloudflare
- [ ] Test email campaign sent successfully

---

## Success Criteria

**By morning (2026-02-06 ~8:00 AM CST):**

1. ✅ Email extraction complete with 165+ emails
2. ✅ D1 database enriched (email column populated)
3. ✅ Email marketing worker deployed
4. ✅ Test campaign ready to send
5. ✅ All code tested (TDD) with 100% pass rate
6. ✅ Documentation complete
7. ✅ Results uploaded to R2 for Flo/Minte review

**Evidence Required:**
- All test suites passing
- R2 uploads confirmed
- D1 database query showing updated emails
- Worker deployment confirmation
- Comprehensive report in R2

---

## Resources

**R2 Bucket:** `atlas-collab-pub`
**Working Directory:** `/home/flo/kiamichi-Biz-Connect`
**Source CSV Files:** `C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect\Businessdata\*.csv` (via SSH to 100.84.133.97)
**D1 Database:** `kiamichi-biz-connect-db`

**Reference Documents:**
- Data Audit: https://pub-30a843d7499b4062bd2f2e9cde157bd0.r2.dev/tasks/kbc-email-marketing/data-audit.md
- Extraction Plan: https://pub-30a843d7499b4062bd2f2e9cde157bd0.r2.dev/tasks/kbc-email-marketing/data-extraction-plan.md

---

## Emergency Contact

If blocked, post status update to Discord #kbc-feature-development with:
- Task being attempted
- Blocker description
- Tests passing/failing
- Logs/error messages

**DO NOT:**
- Write code without tests
- Skip verification steps
- Leave failing tests
- Deploy untested code
