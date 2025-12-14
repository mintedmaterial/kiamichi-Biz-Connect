# AI Business Analyzer Worker

Autonomous AI agent that analyzes and enriches business listings for KiamichiBizConnect.

## Features

- **Completeness Analysis**: Scores business profiles 0-100 based on field completeness
- **AI-Powered Enrichment**: Uses Workers AI to identify missing data and suggest improvements
- **Web Intelligence**: Scrapes business websites and social profiles for missing information
- **Autonomous Updates**: Automatically applies high-confidence suggestions (95%+ confidence)
- **Manual Review Queue**: Stores medium-confidence suggestions for admin approval
- **Scheduled Runs**: Executes 3x daily (8am, 2pm, 8pm Central) via cron triggers

## Architecture

### Modes

1. **Manual Mode** (`/analyze` POST endpoint)
   - Triggered by admin from dashboard
   - Returns all suggestions for manual review
   - No automatic updates applied

2. **Auto Mode** (cron scheduled)
   - Runs autonomously 3x per day
   - Applies high-confidence suggestions automatically (≥95%)
   - Respects daily update limit (max 3 per business per day)
   - Prioritizes incomplete businesses and stale data

### Database Schema

- `business_analysis`: Analysis results and completeness scores
- `enrichment_suggestions`: Individual field suggestions with confidence scores
- `enrichment_queue`: Processing queue for async analysis

### Enrichment Pipeline

1. **Analyze Completeness**: Calculate 0-100 score based on field weights
2. **Generate Plan**: Use AI to identify and prioritize missing fields
3. **Web Research**: Fetch data from business website, Facebook, etc.
4. **Extract & Validate**: Parse web content and calculate confidence scores
5. **Store Results**: Save analysis and suggestions to database
6. **Auto-Apply**: Apply high-confidence suggestions (auto mode only)

## API Endpoints

### POST /analyze
Trigger business analysis

**Request:**
```json
{
  "businessId": 123,
  "mode": "manual",
  "adminEmail": "admin@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "businessId": 123,
  "mode": "manual",
  "completenessScore": 65,
  "suggestionsCount": 5,
  "autoAppliedCount": 0
}
```

### GET /analysis/:businessId
Get latest analysis results for a business

### GET /health
Health check endpoint

## Configuration

Environment variables in `wrangler.toml`:

- `ANALYZER_VERSION`: Version identifier
- `MAX_AUTO_UPDATES_PER_DAY`: Max autonomous updates per business (default: 3)
- `AUTO_APPLY_CONFIDENCE_THRESHOLD`: Minimum confidence for auto-apply (default: 0.95)

## Deployment

```bash
cd workers/analyzer-worker
npx wrangler deploy
```

## Monitoring

View logs in Cloudflare dashboard or via CLI:
```bash
npx wrangler tail kiamichi-biz-ai-analyzer
```

## Service Binding

The main worker connects to this analyzer via service binding:
```toml
[[services]]
binding = "ANALYZER"
service = "kiamichi-biz-ai-analyzer"
```

This enables the main worker to trigger analysis and fetch results without external HTTP calls.
