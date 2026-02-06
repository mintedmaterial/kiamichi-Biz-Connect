# KiamichiBizConnect - Local Business Directory Platform

A comprehensive business directory for Southeast Oklahoma, Northeast Texas, and Southwest Arkansas built on Cloudflare Workers.

## 🎯 Features

### Core Features (MVP)
- ✅ **Homepage** - Customized layout with featured businesses and search
- ✅ **Business Listings** - Display businesses with images, ratings, and details
- ✅ **Category Browsing** - Organized by service type (Hair Salons, Home Builders, etc.)
- ✅ **Search Functionality** - Search by name, category, and city
- ✅ **Business Detail Pages** - Full business information and contact details
- ✅ **Business Submission Form** - Allow businesses to submit their listings
- ✅ **Blog System** - Featured business spotlights
- ✅ **Ad Placement System** - Strategic advertising spots for premium businesses
- ✅ **Responsive Design** - Mobile-friendly Tailwind CSS design

### Tech Stack
- **Runtime**: Cloudflare Workers
- **Database**: D1 (SQLite)
- **Storage**: R2 (for images)
- **Caching**: Workers KV
- **AI**: Workers AI (for blog generation)
- **Frontend**: TailwindCSS
- **Language**: TypeScript

## 🚀 Quick Start

### Prerequisites
- Node.js 16.17.0 or later
- npm or yarn
- Cloudflare account
- Wrangler CLI

### Installation

1. **Clone and setup**
```bash
cd kiamichi-biz-connect
npm install
```

2. **Create D1 Database**
```bash
# Create the database
npx wrangler d1 create kiamichi-biz-connect-db

# Copy the database_id from output and update wrangler.toml
```

3. **Initialize Database Schema**
```bash
# Apply schema locally
npx wrangler d1 execute kiamichi-biz-connect-db --local --file=./schema.sql

# Apply schema to production
npx wrangler d1 execute kiamichi-biz-connect-db --remote --file=./schema.sql
```

4. **Seed Sample Data (Optional)**
```bash
# Add sample data locally
npx wrangler d1 execute kiamichi-biz-connect-db --local --file=./seed.sql

# Add sample data to production
npx wrangler d1 execute kiamichi-biz-connect-db --remote --file=./seed.sql
```

5. **Create R2 Bucket**
```bash
npx wrangler r2 bucket create kiamichi-biz-images
```

6. **Create KV Namespace**
```bash
# Create for production
npx wrangler kv:namespace create "CACHE"

# Copy the id from output and update wrangler.toml
```

7. **Local Development**
```bash
npm run dev
# or
npx wrangler dev
```

Visit `http://localhost:8787` to see your local development site.

8. **Deploy to Production**
```bash
npm run deploy
# or
npx wrangler deploy
```

## 🔄 Development Workflow

This project uses [Changesets](https://github.com/changesets/changesets) for automated versioning and changelog generation.

### Making Changes

1. Make your code changes
2. Add a changeset:
   ```bash
   npm run changeset
   ```
3. Follow the prompts to describe your changes:
   - Choose version bump type (patch/minor/major)
   - Write a summary (becomes CHANGELOG entry)
4. Commit the changeset file with your changes

### Releasing

1. Merge PR to `main`
2. GitHub Action automatically creates "Version Packages" PR
3. Review the version bumps and CHANGELOG
4. Merge "Version Packages" PR → Automatic deployment to Cloudflare

### Version Types

- **patch** (1.0.0 → 1.0.1) - Bug fixes, minor improvements
- **minor** (1.0.0 → 1.1.0) - New features, backwards compatible
- **major** (1.0.0 → 2.0.0) - Breaking changes

## 📁 Project Structure

```
kiamichi-biz-connect/
├── src/
│   ├── index.ts          # Main Worker entry point with routing
│   ├── types.ts          # TypeScript interfaces
│   ├── database.ts       # Database service layer
│   └── templates.ts      # HTML templates
├── schema.sql            # Database schema
├── seed.sql              # Sample data
├── wrangler.toml         # Cloudflare Workers configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Project dependencies
```

## 🗄️ Database Schema

### Tables
- **categories** - Business categories (Home Services, Beauty, etc.)
- **businesses** - Main business listings
- **ad_placements** - Premium ad positions
- **business_submissions** - Pending business submissions
- **blog_posts** - Featured business spotlights
- **business_keywords** - Search keywords for better discoverability

## 🎨 Customization

### Adding a New Business Category
```sql
INSERT INTO categories (name, slug, description, icon) 
VALUES ('New Category', 'new-category', 'Description here', '🏪');
```

### Adding a Business Manually
```sql
INSERT INTO businesses (name, slug, description, category_id, city, state, is_active)
VALUES ('Business Name', 'business-slug', 'Description', 1, 'Durant', 'OK', 1);
```

### Creating Ad Placements
```sql
-- Featured homepage ad
INSERT INTO ad_placements (business_id, placement_type, start_date, end_date, is_active)
VALUES (1, 'homepage-featured', unixepoch('now'), unixepoch('now', '+30 days'), 1);
```

## 🔌 API Endpoints

### Public API
- `GET /` - Homepage
- `GET /search?q=query&category=slug&city=name` - Search businesses
- `GET /categories` - List all categories
- `GET /category/:slug` - Category page
- `GET /business/:slug` - Business detail page
- `GET /blog` - Blog posts
- `GET /submit` - Business submission form
- `POST /submit` - Submit business

### JSON API
- `GET /api/categories` - Get all categories as JSON
- `GET /api/search?q=query` - Search businesses as JSON
- `GET /api/stats` - Get platform statistics

## 🎯 Next Steps & Enhancements

### Phase 2 Features
1. **Admin Panel**
   - Approve/reject business submissions
   - Edit business listings
   - Manage ad placements
   - Generate blog posts with AI

2. **Advanced Search**
   - Filter by ratings
   - Distance-based search
   - Service area mapping

3. **User Reviews**
   - Allow users to leave reviews
   - Rating system
   - Review moderation

4. **Payment Integration**
   - Ad placement purchases
   - Premium listings
   - Stripe integration

5. **AI Blog Generation**
   - Automated daily blog posts
   - Business spotlight generation
   - SEO-optimized content

6. **Email Notifications**
   - New submission alerts
   - Featured business notifications

7. **Analytics Dashboard**
   - Business view tracking
   - Search analytics
   - Popular categories

## 🔧 Administration

### Viewing Submissions
```bash
npx wrangler d1 execute kiamichi-biz-connect-db --remote \
  --command="SELECT * FROM business_submissions WHERE status='pending'"
```

### Approving a Business
```bash
# First, get submission details, then create business entry
npx wrangler d1 execute kiamichi-biz-connect-db --remote \
  --command="INSERT INTO businesses (...) VALUES (...)"
```

### Managing Ad Placements
```bash
# View active ads
npx wrangler d1 execute kiamichi-biz-connect-db --remote \
  --command="SELECT * FROM ad_placements WHERE is_active=1"
```

## 📊 Monitoring

### View Logs
```bash
npx wrangler tail
```

### Check Database Size
```bash
npx wrangler d1 info kiamichi-biz-connect-db
```

## 🌐 SEO Optimization

The platform is designed for SEO with:
- Clean, semantic HTML
- Descriptive page titles and meta descriptions
- Structured data for local businesses
- Fast loading times (Cloudflare CDN)
- Mobile-responsive design

## 💡 Tips for Success

1. **Start Local** - Build out your business database with 20-50 quality listings before launch
2. **High-Quality Content** - Use good images and detailed descriptions
3. **Regular Blog Posts** - Feature 1 business per day to keep content fresh
4. **Social Media** - Share listings on local Facebook groups and community pages
5. **Local SEO** - Target city + service keywords (e.g., "Durant plumber")

## 📝 License

This project is built for Southeast Remodeling Solutions. All rights reserved.

## 🤝 Support

For questions or issues:
- Email: admin@kiamichibizconnect.com
- Create an issue in the repository

## 🎉 Credits

Built with:
- Cloudflare Workers
- Tailwind CSS
- TypeScript
- D1 Database
- Workers AI
