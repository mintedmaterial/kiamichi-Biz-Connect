# KiamichiBizConnect - Quick Reference Card

## 🚀 Essential Commands

```bash
# Navigate to project
cd C:\Users\Minte\Desktop\dev-code\kiamichi-biz-connect

# Install dependencies
npm install

# Create Cloudflare resources
npx wrangler d1 create kiamichi-biz-connect-db
npx wrangler r2 bucket create kiamichi-biz-images
npx wrangler kv:namespace create "CACHE"

# Setup database locally
npm run db:schema:local
npm run db:seed:local

# Run development server
npm run dev

# Deploy to production
npm run deploy
```

## 🔗 Key URLs (Local Development)

- **Homepage**: http://localhost:8787/
- **Business Directory**: http://localhost:8787/businesses
- **Categories**: http://localhost:8787/categories
- **Blog**: http://localhost:8787/blog
- **Submit Business**: http://localhost:8787/submit
- **Admin Panel**: http://localhost:8787/admin
- **Search**: http://localhost:8787/search?q=builders

## 🔑 Admin Panel Features

**URL**: /admin (requires ADMIN_KEY in header)

### Quick Actions:
1. **Add Business** - Manual entry with full details
2. **View Submissions** - Approve pending businesses
3. **Manage Ads** - Create featured placements
4. **Generate Blog** - AI-powered content creation

## 💼 Business Information Captured

```
✓ Basic Info (name, description, category)
✓ Contact (email, phone, website)
✓ Location (address, city, state, zip, coordinates)
✓ Social (Facebook, Google Business)
✓ Images (logo, photos)
✓ Ratings (Google & Facebook)
✓ Service Area
✓ Verification Status
```

## 🎯 Ad Placement Types

1. **homepage-featured** - Top of homepage (prime spot)
2. **category-top** - First in category results
3. **sidebar** - Right column ads
4. **sponsored** - Highlighted in search results

## 📊 Database Tables

- `businesses` - All business listings
- `categories` - Service categories (hierarchical)
- `ad_placements` - Active advertisements
- `blog_posts` - Content marketing
- `business_submissions` - Pending approvals

## 🎨 Default Categories (from seed.sql)

1. Home & Construction
2. Professional Services
3. Health & Wellness
4. Automotive
5. Food & Dining
6. Retail & Shopping
7. Personal Services
8. Events & Entertainment
9. Education & Training
10. Technology & Digital

## 🤖 AI Blog Generation

**Endpoint**: POST /admin/blog/generate

**Prompts AI to create**:
- Business spotlights
- Service guides
- Local tips
- Industry trends
- SEO-optimized content

## 📱 Responsive Design

✓ Mobile-first CSS
✓ Touch-friendly navigation
✓ Optimized images
✓ Fast edge caching
✓ Progressive enhancement

## 🔍 SEO Features Built-In

- Semantic HTML5
- Meta descriptions
- Schema.org markup
- Sitemap generation
- Fast Cloudflare CDN
- Daily fresh content (blog)
- Local keyword optimization

## 🛠️ Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Database**: D1 (SQLite at edge)
- **Storage**: R2 (images)
- **Cache**: KV (performance)
- **AI**: Workers AI (blog generation)
- **Framework**: None (pure Workers API)

## 📈 Growth Milestones

### Week 1: Setup
- Deploy to production
- Add 20 businesses manually
- Generate 5 blog posts

### Month 1: Launch
- 100+ businesses listed
- Daily blog posts active
- Basic SEO in place
- Social media presence

### Month 3: Scale
- 300+ businesses
- 10 paying advertisers
- Top 3 Google ranking for local searches
- 1000+ monthly visitors

### Month 6: Monetize
- 500+ businesses
- 30+ paying advertisers
- Profitable revenue stream
- Regional brand recognition

## 💡 Revenue Projections

**Conservative Estimate (Month 6)**:
- 30 businesses × $29/month = $870
- 10 businesses × $79/month = $790
- 5 custom placements × $200 = $1000
- **Total Monthly**: ~$2,660

**Optimistic Estimate (Year 1)**:
- 100 businesses × $29/month = $2,900
- 30 businesses × $79/month = $2,370
- 15 custom placements × $200 = $3,000
- **Total Monthly**: ~$8,270

## 🎯 Marketing Strategy

### Online:
- Google My Business optimization
- Facebook business page
- Local Facebook groups
- LinkedIn for B2B
- Email campaigns

### Offline:
- Chamber of Commerce
- Business networking events
- Local newspapers
- Flyers at popular spots
- Word of mouth

## 📞 Next Actions

1. ✅ Copy project to Desktop
2. ✅ Run `npm install`
3. ✅ Create Cloudflare resources
4. ✅ Update wrangler.toml IDs
5. ✅ Initialize database
6. ✅ Test locally
7. ✅ Add first 10 businesses
8. ✅ Generate 3 blog posts
9. ✅ Deploy to production
10. ✅ Start marketing!

## 🆘 Quick Troubleshooting

**Problem**: "npm command not found"
**Solution**: Install Node.js from nodejs.org

**Problem**: "wrangler not found"
**Solution**: `npm install -g wrangler`

**Problem**: "Database not initialized"
**Solution**: `npm run db:schema:local`

**Problem**: "Can't connect to localhost:8787"
**Solution**: Make sure `npm run dev` is running

**Problem**: "AI not working"
**Solution**: Workers AI requires paid Cloudflare plan

## 🔐 Security Checklist

- [ ] Change ADMIN_KEY in wrangler.toml
- [ ] Use environment secrets for production
- [ ] Never commit .env files
- [ ] Sanitize all user inputs
- [ ] Rate limit submission form
- [ ] Enable CORS properly
- [ ] Use HTTPS in production

## 📝 Content Ideas (First 10 Blog Posts)

1. "Top 10 Home Builders in Southeast Oklahoma"
2. "How to Choose a Contractor for Your Project"
3. "Local Business Spotlight: [Featured Business]"
4. "Spring Home Maintenance Tips from Local Experts"
5. "Best Restaurants in Hugo, Oklahoma"
6. "Wedding Venues in Northeast Texas"
7. "Auto Repair: When to DIY vs Call a Pro"
8. "Supporting Local Businesses in McCurtain County"
9. "Small Business Success Stories: [Business Name]"
10. "Complete Guide to Home Remodeling in Oklahoma"

---

**Remember**: This is an MVP! Start small, test fast, iterate based on feedback. Focus on getting 50-100 businesses listed and generating consistent traffic before scaling features.

**Your advantage**: You're a local contractor who understands the market, knows the businesses, and has credibility in the community. Use that!
