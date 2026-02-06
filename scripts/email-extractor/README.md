# KBC Email Extraction Tool

**Purpose:** Extract email addresses from business websites for KBC marketing campaigns

## Features

- ✅ TDD-driven development (26 tests, 100% passing)
- ✅ CSV parsing from remote machine via SSH
- ✅ Website scraping for email addresses
- ✅ Email validation and deduplication
- ✅ Automatic R2 upload
- ✅ Detailed extraction report

## Tech Stack

- **Node.js** + **TypeScript**
- **Vitest** (testing)
- **papaparse** (CSV parsing)
- **cheerio** (HTML parsing)
- **node-fetch** (HTTP requests)

## Installation

```bash
npm install
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Specific test file
npm test tests/email-validator.test.ts
```

## Usage

### Extract Emails from Remote CSV Files

```bash
npm run extract
```

This will:
1. SSH to `Minte@100.84.133.97`
2. Download CSV files from `C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect\Businessdata\`
3. Parse business data
4. Scrape websites for emails
5. Save results to `output/business-emails.json`
6. Upload to R2: `atlas-collab-pub/kbc-data/business-emails.json`
7. Generate extraction report

### Output Format

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

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Email Validator | 6 | ✅ Pass |
| CSV Parser | 6 | ✅ Pass |
| Email Scraper | 9 | ✅ Pass |
| Integration | 5 | ✅ Pass |
| **TOTAL** | **26** | **✅ 100%** |

## Architecture

```
┌─────────────────┐
│  CSV Files      │ (Remote: 100.84.133.97)
│  (11 files)     │
└────────┬────────┘
         │ SSH download
         ▼
┌─────────────────┐
│  CSV Parser     │ parseBusinessCSV()
│  (papaparse)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Business Data  │ { name, address, phone, website }
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Email Scraper  │ scrapeWebsiteForEmails()
│  (cheerio)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Email          │ isValidEmail(), deduplicateEmails()
│  Validator      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Extraction     │ extractBusinessEmails()
│  Results        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Output JSON    │ business-emails.json
│  + R2 Upload    │
└─────────────────┘
```

## TDD Approach

This project was built using strict Test-Driven Development:

1. **RED** - Write failing test first
2. **Verify RED** - Confirm test fails for right reason
3. **GREEN** - Write minimal code to pass
4. **Verify GREEN** - Confirm test passes
5. **REFACTOR** - Clean up while keeping tests green
6. **Repeat** for next feature

Every function has corresponding tests written BEFORE implementation.

## Success Criteria

- [x] All tests passing (26/26)
- [x] CSV parser working
- [x] Email scraper working
- [x] Email validation working
- [x] Integration complete
- [ ] 165+ emails extracted (run extraction)
- [ ] Results uploaded to R2
- [ ] Report generated

## Next Steps

1. Run extraction: `npm run extract`
2. Review `output/business-emails.json`
3. Check R2 upload: `https://pub-30a843d7499b4062bd2f2e9cde157bd0.r2.dev/kbc-data/business-emails.json`
4. Proceed to Task 2: D1 Database Enrichment

## Troubleshooting

**SSH connection fails:**
- Verify Tailscale is connected
- Test SSH: `ssh Minte@100.84.133.97 "echo test"`

**No emails found:**
- Check if websites are accessible
- Review extraction report for details
- Some businesses may not have email addresses on their websites

**R2 upload fails:**
- Ensure wrangler is authenticated
- Check R2 bucket permissions
- Verify `--remote` flag is used

## License

MIT - KBC Internal Tool
