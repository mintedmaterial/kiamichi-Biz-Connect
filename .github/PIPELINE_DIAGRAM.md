# CI/CD Pipeline Architecture

Visual representation of the complete CI/CD pipeline for Kiamichi Biz Connect.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Developer Workflow                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              Feature Branch                Main Branch
                    │                           │
                    ▼                           ▼
        ┌───────────────────────┐   ┌──────────────────────┐
        │   Pull Request        │   │  Production Deploy   │
        │                       │   │                      │
        │  ┌─────────────────┐  │   │  ┌────────────────┐  │
        │  │  CI Workflow    │  │   │  │ Deploy Workflow│  │
        │  │  (Type check,   │  │   │  │ (Migrations,   │  │
        │  │   Build, Test)  │  │   │  │  Deploy all 4  │  │
        │  └─────────────────┘  │   │  │   workers)     │  │
        │           │           │   │  └────────────────┘  │
        │           ▼           │   │                      │
        │  ┌─────────────────┐  │   └──────────┬───────────┘
        │  │Preview Workflow │  │              │
        │  │  (Deploy -      │  │              ▼
        │  │   preview       │  │   ┌──────────────────────┐
        │  │   workers)      │  │   │   Production Live    │
        │  └─────────────────┘  │   │  kiamichibizconnect  │
        │           │           │   │         .com         │
        │           ▼           │   └──────────────────────┘
        │  ┌─────────────────┐  │
        │  │  Test & Review  │  │
        │  └─────────────────┘  │
        │           │           │
        └───────────┼───────────┘
                    │
                    │ Merge
                    │
                    ▼
            Production Deploy
```

---

## Detailed CI Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                         Pull Request Created                     │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Trigger CI Workflow  │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────┐
        │   Type Check      │   │   Security Audit  │
        │                   │   │                   │
        │ - Main worker     │   │ - npm audit       │
        │ - Business agent  │   │ - Dependency scan │
        │ - Analyzer        │   │                   │
        │ - Facebook worker │   │                   │
        └────────┬──────────┘   └─────────┬─────────┘
                 │                        │
                 └────────────┬───────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Build Matrix   │
                    │   (Parallel)     │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Build Main   │  │Build Business│  │Build Analyzer│
    │   Worker     │  │    Agent     │  │  & Facebook  │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   Run Tests      │
                    │                  │
                    │ - Vitest (unit)  │
                    │ - Business agent │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   CI Success     │
                    │   ✓ All Passed   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Ready for Review │
                    └──────────────────┘
```

---

## Detailed Preview Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Pull Request Opened/Updated                   │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Trigger Preview       │
                    │   Workflow            │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Install Dependencies  │
                    │  (with npm cache)     │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────────┐
                    │   Deploy Preview Workers  │
                    │   (Sequential)            │
                    └───────────┬───────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
    │ Deploy Main    │  │Deploy Business │  │Deploy Analyzer │
    │  -preview      │  │   -preview     │  │  & Facebook    │
    │                │  │                │  │   -preview     │
    └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Comment on PR with:  │
                    │  - Preview URLs       │
                    │  - Deployment status  │
                    │  - Testing notes      │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Ready to Test        │
                    │  in Preview Env       │
                    └───────────────────────┘

                    PR Closed
                        │
                        ▼
                    ┌───────────────────────┐
                    │  Cleanup Preview      │
                    │  - Delete all 4       │
                    │    preview workers    │
                    │  - Comment on PR      │
                    └───────────────────────┘
```

---

## Detailed Deploy Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                       Merge to Main Branch                       │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Trigger Deploy        │
                    │   Workflow            │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Check for Migrations  │
                    │ (Look for .sql files) │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌───────────────┐      ┌────────────────┐
            │ Migrations    │      │ No Migrations  │
            │ Detected      │      │ Found          │
            └───────┬───────┘      └────────┬───────┘
                    │                       │
                    ▼                       │
            ┌───────────────┐              │
            │ Run D1        │              │
            │ Migrations:   │              │
            │ - schema.sql  │              │
            │ - seed.sql    │              │
            └───────┬───────┘              │
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Deploy Workers        │
                    │  (Parallel)           │
                    └───────────┬───────────┘
                                │
        ┌───────────┬───────────┼───────────┬───────────┐
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Main    │ │ Business │ │ Analyzer │ │ Facebook │ │          │
│ Worker   │ │  Agent   │ │  Worker  │ │  Worker  │ │  Jobs    │
│          │ │          │ │          │ │          │ │  Run in  │
│ Deploy   │ │ Deploy   │ │ Deploy   │ │ Deploy   │ │ Parallel │
│          │ │          │ │          │ │          │ │          │
│ - Build  │ │ - Build  │ │ - Build  │ │ - Build  │ │          │
│ - Upload │ │ - Upload │ │ - Upload │ │ - Upload │ │          │
│ - Bind   │ │ - Bind   │ │ - Bind   │ │ - Bind   │ │          │
│   secrets│ │   secrets│ │   D1/KV  │ │   D1/KV  │ │          │
│          │ │          │ │          │ │          │ │          │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────┘
     │            │            │            │
     │            │            │            │
     └────────────┼────────────┼────────────┘
                  │            │
                  ▼            ▼
        ┌──────────────────────────────┐
        │  Deployment Complete Job     │
        │  - Check all deployments     │
        │  - Generate summary          │
        │  - Report status             │
        └───────────┬──────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌────────────────┐      ┌────────────────┐
│ All Success    │      │ One or More    │
│ ✓ Production   │      │ Failed         │
│   Live         │      │ ✗ Rollback     │
└────────────────┘      └────────────────┘
```

---

## Worker Deployment Matrix

```
┌────────────────────────────────────────────────────────────────────┐
│                        Worker Architecture                         │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      Shared Resources                            │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐   │
│  │   D1 Database  │  │   KV Namespace │  │   R2 Buckets    │   │
│  │                │  │                │  │                 │   │
│  │ kiamichi-biz-  │  │  a5a33e270e..  │  │ - biz-images    │   │
│  │  connect-db    │  │                │  │ - templates     │   │
│  │                │  │  (cache)       │  │ - assets        │   │
│  └────────────────┘  └────────────────┘  └─────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
        │               │ │               │ │               │
        │ Main Worker   │ │Business Agent │ │ Analyzer      │
        │               │ │               │ │  Worker       │
        ├───────────────┤ ├───────────────┤ ├───────────────┤
        │ Domain:       │ │ Domain:       │ │ Background    │
        │ kiamichibiz   │ │ app.kiamichi  │ │ Cron: 3x/day  │
        │ connect.com   │ │ bizconnect    │ │               │
        │               │ │  .com         │ │ AI-powered    │
        │ Public API    │ │               │ │ enrichment    │
        │ Business      │ │ Dashboard UI  │ │               │
        │  listings     │ │ Chat agent    │ │ Auto updates  │
        │ Search        │ │ Voice agent   │ │               │
        │               │ │ Management    │ │               │
        └───────────────┘ └───────────────┘ └───────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │               │
                                            │ Facebook      │
                                            │  Worker       │
                                            ├───────────────┤
                                            │ Background    │
                                            │ Cron: 3x/day  │
                                            │               │
                                            │ Browser API   │
                                            │ Social posts  │
                                            │ Automation    │
                                            │               │
                                            └───────────────┘
```

---

## Resource Bindings Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     Environment Bindings                         │
└──────────────────────────────────────────────────────────────────┘

                        ┌─────────────────┐
                        │ Worker Request  │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
            ┌───────────────┐        ┌───────────────┐
            │ Production    │        │ Preview       │
            │ Environment   │        │ Environment   │
            └───────┬───────┘        └───────┬───────┘
                    │                        │
        ┌───────────┼────────────┐          │
        │           │            │          │
        ▼           ▼            ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ env.DB   │ │env.CACHE │ │env.IMAGES│ │ -preview │
│          │ │          │ │          │ │ suffix   │
│ D1       │ │ KV       │ │ R2       │ │          │
│ Binding  │ │ Binding  │ │ Binding  │ │ Same     │
│          │ │          │ │          │ │ bindings │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
     │             │            │            │
     └─────────────┼────────────┼────────────┘
                   │            │
                   ▼            ▼
           ┌────────────────────────┐
           │  Shared Resources      │
           │  (Production & Preview │
           │   use same D1, KV, R2) │
           └────────────────────────┘
                   ⚠️
           Preview uses PRODUCTION
               data! Be careful!
```

---

## Secrets Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     GitHub Secrets Storage                       │
│  (Encrypted at rest, never exposed in logs)                      │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
        ┌───────────────────┐     ┌───────────────────┐
        │ Cloudflare Secrets│     │Application Secrets│
        │                   │     │                   │
        │ - API_TOKEN       │     │ - ADMIN_KEY       │
        │ - ACCOUNT_ID      │     │ - GOOGLE_SECRET   │
        │                   │     │ - FB_SECRET       │
        │                   │     │ - FB_EMAIL        │
        │                   │     │ - FB_PASSWORD     │
        └─────────┬─────────┘     └─────────┬─────────┘
                  │                         │
                  └──────────┬──────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  GitHub Actions        │
                │  Workflow Execution    │
                │                        │
                │  env:                  │
                │    SECRET: ${{         │
                │      secrets.SECRET    │
                │    }}                  │
                └────────────┬───────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │ Wrangler Deploy        │
                │                        │
                │ Uses secrets to:       │
                │ - Authenticate with CF │
                │ - Set worker secrets   │
                │ - Configure bindings   │
                └────────────┬───────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  Cloudflare Worker     │
                │                        │
                │  env.ADMIN_KEY         │
                │  env.GOOGLE_SECRET     │
                │  etc.                  │
                └────────────────────────┘
```

---

## Cron Schedule Visualization

```
┌──────────────────────────────────────────────────────────────────┐
│                    Daily Cron Schedule (UTC)                     │
└──────────────────────────────────────────────────────────────────┘

Time (UTC)  00:00     06:00     12:00     18:00     24:00
            │         │         │         │         │
            ▼         ▼         ▼         ▼         ▼
Analyzer    │    ●────┼────●────┼────●────┼─────────┼
            │  02:00  │  14:00  │  20:00  │         │
            │  (8pm   │  (8am   │  (2pm   │         │
            │   CST)  │   CST)  │   CST)  │         │
            │         │         │         │         │
Facebook    ●─────────┼──●──────┼────●────●─────────│
            │  03:00  │  15:00  │  22:00  │  02:00  │
            │  (9pm   │  (9am   │  (4pm   │  (8pm   │
            │   CST)  │   CST)  │   CST)  │   CST)  │
            │         │         │         │         │
Token       │         ●─────────┼─────────┼─────────│
Refresh     │         14:00     │         │         │
            │         (8am CST) │         │         │
            │         │         │         │         │

Legend:
● = Cron trigger executes
CST = Central Standard Time (UTC-6)

Analyzer: 3 times/day for business enrichment
Facebook: 3 times/day for social posts + 2x for token refresh
```

---

## Complete Deployment Timeline

```
Developer Action                GitHub Actions                 Cloudflare

┌──────────────┐
│ git push     │
└──────┬───────┘
       │ (0 min)
       ▼
┌──────────────────┐
│ PR Created       │────────────┐
└──────────────────┘            │
                                ▼
                        ┌───────────────┐
                        │ CI Starts     │
                        └───────┬───────┘
                                │ (0-2 min)
                                ▼
                        ┌───────────────┐
                        │ Type Check    │
                        │ Build         │
                        │ Test          │
                        │ Audit         │
                        └───────┬───────┘
                                │ (8-12 min)
                                ▼
                        ┌───────────────┐
                        │ CI Complete ✓ │
                        └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │Preview Deploy │
                        │  Starts       │
                        └───────┬───────┘
                                │ (12-15 min)
                                ▼
                        ┌───────────────┐        ┌──────────────┐
                        │Deploy 4       │───────▶│ Preview URLs │
                        │ -preview      │        │ Available    │
                        │ workers       │        └──────────────┘
                        └───────┬───────┘
                                │ (15-20 min)
                                ▼
                        ┌───────────────┐
                        │ Comment on PR │
┌──────────────┐        │ with URLs     │
│ Review &     │◀───────┤               │
│ Test Preview │        └───────────────┘
└──────┬───────┘
       │ (20-40 min, manual)
       ▼
┌──────────────┐
│ Approve &    │
│ Merge PR     │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Merged to main   │────────────┐
└──────────────────┘            │
                                ▼
                        ┌───────────────┐
                        │Deploy Workflow│
                        │  Triggered    │
                        └───────┬───────┘
                                │ (0-1 min)
                                ▼
                        ┌───────────────┐
                        │Check for      │
                        │ Migrations    │
                        └───────┬───────┘
                                │ (1-2 min)
                                ▼
                        ┌───────────────┐        ┌──────────────┐
                        │Run Migrations │───────▶│ D1 Updated   │
                        │ (if needed)   │        └──────────────┘
                        └───────┬───────┘
                                │ (2-4 min)
                                ▼
                        ┌───────────────┐
                        │Deploy Workers │
                        │ (parallel)    │
                        └───────┬───────┘
                                │ (4-12 min)
                                ▼
                        ┌───────────────┐        ┌──────────────┐
                        │All Deployed ✓ │───────▶│ Production   │
                        └───────────────┘        │   Live!      │
                                                 └──────────────┘

Total Time: PR → Production = ~30-50 minutes
(including manual review time)
```

---

## Error Handling Flow

```
                        ┌───────────────┐
                        │ Workflow Step │
                        └───────┬───────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌───────────────┐       ┌───────────────┐
            │ Step Succeeds │       │  Step Fails   │
            └───────┬───────┘       └───────┬───────┘
                    │                       │
                    │                       ▼
                    │               ┌───────────────┐
                    │               │ continue-on-  │
                    │               │  error: true? │
                    │               └───────┬───────┘
                    │                       │
                    │           ┌───────────┴───────────┐
                    │           │                       │
                    │           ▼                       ▼
                    │   ┌───────────────┐       ┌───────────────┐
                    │   │ Log warning   │       │ Fail workflow │
                    │   │ Continue      │       │ Stop          │
                    │   └───────┬───────┘       └───────┬───────┘
                    │           │                       │
                    └───────────┼───────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ Next step or  │
                        │ workflow end  │
                        └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ GitHub Status │
                        │ - ✓ Success   │
                        │ - ⚠ Warning   │
                        │ - ✗ Failure   │
                        └───────────────┘
```

---

## Rollback Procedure

```
┌──────────────────────────────────────────────────────────────────┐
│                      Emergency Rollback                          │
└──────────────────────────────────────────────────────────────────┘

    Production Issue Detected
            │
            ▼
    ┌───────────────┐
    │ Immediate     │
    │ Actions       │
    └───────┬───────┘
            │
    ┌───────┴───────────────────┐
    │                           │
    ▼                           ▼
┌─────────────┐         ┌─────────────┐
│ Option 1:   │         │ Option 2:   │
│ Revert Code │         │ Wrangler    │
└─────┬───────┘         │ Rollback    │
      │                 └─────┬───────┘
      │                       │
      ▼                       ▼
┌─────────────┐         ┌─────────────────┐
│ git revert  │         │ wrangler        │
│ <commit>    │         │ deployments     │
│             │         │  list           │
│ Push to     │         │                 │
│  main       │         │ wrangler        │
└─────┬───────┘         │ rollback --     │
      │                 │ deployment-id   │
      │                 │  <id>           │
      │                 └─────┬───────────┘
      │                       │
      └───────────┬───────────┘
                  │
                  ▼
          ┌───────────────┐
          │ Verify Fix    │
          │ - Test main   │
          │   functions   │
          │ - Monitor logs│
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │ Post-mortem   │
          │ - Root cause  │
          │ - Prevention  │
          └───────────────┘
```

---

**Created**: December 2024
**Last Updated**: December 2024
**Version**: 1.0.0
