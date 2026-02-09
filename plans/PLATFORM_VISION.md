# KiamichiBizConnect Platform Vision

**Date:** 2025-02-09
**Author:** DevFlo (from Minte's context)

---

## 🎯 Ultimate Goal

Transform KiamichiBizConnect from a business directory into a **full-service local business platform** where paid users get:

1. **Namespace/Landing Page** - Custom subdomain or landing page
2. **Website Deployment** - Deploy workers-based sites via prompts
3. **AI Services** - Specialized AI agents for their business
4. **Social Automation** - Automated Facebook/Instagram posting
5. **Skills & Tools** - Business-specific worker deployments

---

## 💰 Pricing Tiers (Proposed)

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | Basic listing on directory |
| **Featured** | $25/mo | Featured rotation, Facebook spotlights |
| **Premium** | $50/mo | Daily posts, custom branding, analytics |
| **Enterprise** | $100/mo | **Full AI services**: Containerized DevFlo instance, landing page builder, social automation, custom workers |

---

## 🏗️ Architecture Evolution

### Current State
```
Main Worker (kiamichi-biz-connect)
├── Facebook Worker
├── Analyzer Worker
└── Business Agent Worker (to be replaced)
```

### Future State (Per-Business Namespaces)
```
KiamichiBizConnect Platform
├── Main Worker (directory + admin)
├── Facebook Worker (social automation)
├── Analyzer Worker (AI enrichment)
└── Business Namespaces/
    ├── velvet-fringe/
    │   ├── Landing Page Worker
    │   ├── AI Agent (DevFlo-lite)
    │   └── Social Automation Config
    ├── twisted-custom-leather/
    │   ├── Landing Page Worker
    │   ├── AI Agent (DevFlo-lite)
    │   └── E-commerce Integration
    └── [paid-business]/
        └── Custom Worker Stack
```

---

## 🔧 Skills Needed for Platform

### 1. Landing Page Builder Skill
- Deploy simple worker-based landing pages
- Templates for local businesses
- Custom domain support
- R2 asset storage

### 2. Social Automation Skill
- Daily unique posts (no repeats)
- VIP/family business priority
- Bigfoot Jr. mascot integration
- Workers AI image generation

### 3. Business AI Agent Skill
- Lightweight DevFlo instance per business
- Tools: social posting, listing updates, analytics
- Prompt-based site editing

### 4. Namespace Management Skill
- Deploy workers to business subdomain
- Manage bindings (D1, R2, KV)
- Template-based deployments

---

## 👨‍👩‍👧 VIP/Family Businesses

These businesses get **daily automated posts** with unique content:

1. **Velvet Fringe Salon** (ID: ?)
2. **Twisted Custom Leather** (ID: ?)

**Rules:**
- Never repeat the same post
- Rotate angles: services, testimonials, seasonal, promotions, new products
- Use Bigfoot Jr. mascot 30% of the time
- Use Workers AI (not OpenAI) for image gen

---

## 🐾 Bigfoot Jr. Mascot

**Character:** Playful baby Bigfoot from the Kiamichi Mountains
**Usage:** 30% of social posts include mascot
**Models:** 
- Image: `@cf/black-forest-labs/flux-1-dev`
- Text: `@cf/meta/llama-3-8b-instruct`

**Files:**
- `src/bigfoot-mascot.ts` - Mascot image generation
- `src/facebook-content-generator-mascot.ts` - Content with mascot integration

---

## 📋 Implementation Phases

### Phase 1: Foundation (Current)
- [x] Featured rotation system
- [ ] Merge bigfoot-mascot branch
- [ ] Wire mascot into Facebook worker
- [ ] VIP business daily automation

### Phase 2: Platform Infrastructure
- [ ] Create landing page builder skill
- [ ] Namespace management system
- [ ] Per-business R2 buckets

### Phase 3: Business AI Agents
- [ ] Create DevFlo-lite template
- [ ] Tools for social, listing, analytics
- [ ] Containerized deployment

### Phase 4: Monetization
- [ ] Stripe integration for tiers
- [ ] Automated provisioning on payment
- [ ] Usage tracking and billing

---

## 📚 Reference Documents (from Minte)

1. `WORKER_ARCHITECTURE.md` - Multi-worker pattern explanation
2. `AI_Business_Analyzer_Plan.md` - MCP-based analyzer agent
3. `ANALYZER_USAGE_GUIDE.md` - Admin panel analyzer features
4. `BLOG_GENERATION_PLAN.md` - AI blog system with SEO optimization

---

*This document captures the platform vision for KiamichiBizConnect as communicated by Minte on 2025-02-09*
