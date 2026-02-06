# KBC Database Enrichment Worker

**Purpose:** Match extracted business emails to KBC D1 database and enrich business records.

## Overview

This worker:
1. Downloads `business-emails.json` from R2 (`atlas-collab-pub/kbc-data/`)
2. Fetches businesses from D1 database (`kiamichi-biz-connect-db`)
3. Matches extracted businesses with database businesses using fuzzy name + address matching
4. Updates D1 `businesses` table with email addresses
5. Generates enrichment report (text + JSON)
6. Uploads report to R2

## Test-Driven Development (TDD)

✅ **All tests written FIRST (RED phase)**
✅ **All tests passing (GREEN phase)**
✅ **Code refactored for clarity**

### Test Results

```
Test Files  4 passed (4)
Tests      30 passed (30)
```

**Test Coverage:**
- `matcher.test.js` (9 tests) - Business matching algorithm
- `updater.test.js` (7 tests) - Database update logic
- `reporter.test.js` (7 tests) - Report generation
- `orchestrator.test.js` (7 tests) - End-to-end orchestration

## Architecture

### Modules

**`src/matcher.js`**
- `calculateMatchScore(dbBusiness, extractedBusiness)` - Fuzzy matching (60% name, 40% address)
- `matchBusinesses(dbBusiness, extractedBusiness, threshold)` - Match with configurable threshold

**`src/updater.js`**
- `updateBusinessEmail(businessId, email)` - Generate SQL update
- `batchUpdateEmails(matches)` - Batch process updates

**`src/reporter.js`**
- `generateEnrichmentReport(results, format)` - Generate text or JSON report
- `formatMatchDetails(match)` - Format individual match details

**`src/orchestrator.js`**
- `findBestMatches(dbBusinesses, extractedBusinesses)` - Find best match for each business
- `processEnrichment(extractedData, dbBusinesses)` - Main enrichment orchestration

**`src/index.js`**
- Cloudflare Worker entry point
- Handles `/enrich` POST endpoint

**`src/enrich.js`**
- Standalone CLI script for manual execution

## Usage

### Deploy Worker

```bash
cd workers/database-enrichment
npm install
npm test  # Verify all tests pass
wrangler deploy
```

### Run Enrichment

**Option 1: Via Worker API**
```bash
curl -X POST https://kbc-database-enrichment.srvcflo.workers.dev/enrich
```

**Option 2: Via CLI Script**
```bash
node src/enrich.js
```

**Option 3: Programmatically**
```javascript
import { processEnrichment } from './src/orchestrator.js';
import { generateEnrichmentReport } from './src/reporter.js';

const extractedData = { businesses: [...] };
const dbBusinesses = [...];

const results = processEnrichment(extractedData, dbBusinesses);
const report = generateEnrichmentReport(results);
```

## Matching Algorithm

**Fuzzy Matching with Fuzzball.js**

- **Name Score:** 60% weight (Levenshtein distance ratio)
- **Address Score:** 40% weight (Levenshtein distance ratio)
- **Threshold:** 0.8 (configurable)
- **Case Insensitive:** Yes
- **Handles:**
  - Business name variations (LLC, Inc, etc.)
  - Address abbreviations (St vs Street)
  - Missing addresses (penalty score)

**Examples:**

| DB Business | Extracted Business | Score | Match? |
|-------------|-------------------|-------|--------|
| Test Business | Test Business LLC | 0.92 | ✅ |
| Test Business | Test Business | 1.00 | ✅ |
| 123 Main Street | 123 Main St | 0.98 | ✅ |
| Acme Corp | Zenith Inc | 0.23 | ❌ |

## Database Schema

**D1 Database:** `kiamichi-biz-connect-db`
**Table:** `businesses`

Relevant columns:
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `address` (TEXT)
- `email` (TEXT, nullable) ← Updated by this worker

## Expected Results

**Before Enrichment:**
- 230 businesses in D1
- 5 valid emails (2% contact rate)

**After Enrichment:**
- 150+ businesses matched
- 165+ emails added
- 72% contact rate

## Dependencies

- `fuzzball` - Fuzzy string matching
- `vitest` - Testing framework
- `wrangler` - Cloudflare Workers CLI

## Success Criteria

- [x] All tests pass (30/30)
- [ ] 150+ businesses matched and updated
- [ ] Enrichment report uploaded to R2
- [ ] D1 database verified (run SELECT query)

## R2 File Locations

**Input:**
- `atlas-collab-pub/kbc-data/business-emails.json` (from email extraction worker)

**Output:**
- `atlas-collab-pub/kbc-data/enrichment-report-{timestamp}.txt`
- `atlas-collab-pub/kbc-data/enrichment-report-{timestamp}.json`

## Development

### Run Tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Test Individual Modules

```bash
npm test tests/matcher.test.js
npm test tests/updater.test.js
npm test tests/reporter.test.js
npm test tests/orchestrator.test.js
```

### Local Development

```bash
wrangler dev
# Then: curl -X POST http://localhost:8787/enrich
```

## Troubleshooting

**business-emails.json not found:**
- Ensure email extraction script completed successfully
- Check R2 location: `atlas-collab-pub/kbc-data/business-emails.json`

**Low match rate:**
- Adjust threshold in `findBestMatches()` (default: 0.8)
- Check data quality (missing names/addresses)

**Database update fails:**
- Verify D1 binding in wrangler.toml
- Check database ID matches production

## Timeline

**Created:** 2026-02-06 (overnight task)
**Status:** ✅ Tests complete, ready to deploy once email extraction completes
**Estimated Runtime:** 2-5 minutes for 165 businesses

---

**Part of:** KBC Email Extraction & Marketing Setup
**See:** `/home/flo/kiamichi-Biz-Connect/OVERNIGHT_TASK_EMAIL_EXTRACTION.md`
