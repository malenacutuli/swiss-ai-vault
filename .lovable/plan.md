
# Platform Owner Analytics & User Monitoring System
## Complete Implementation Plan for malena@axessible.ai

---

## Executive Summary

This plan delivers a comprehensive user monitoring and analytics system giving you full control and visibility over every user interaction, signup, session, cost, revenue, and feature usage across SwissBrain.

**What You'll Get:**
- Real-time email notifications for every new signup
- Complete user journey tracking (source, pages, features)
- Session-level analytics with duration and activity metrics
- Per-user cost and revenue attribution
- IP address and geolocation tracking
- Active/idle user classification
- Platform Owner Dashboard with live data

---

## 1. Database Schema - User Activity Tracking

### 1.1 Core Analytics Tables

**Table: `platform_analytics_events`**
Captures every user interaction across the platform.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Authenticated user (nullable for anonymous) |
| anonymous_id | TEXT | Fingerprint hash for anonymous users |
| session_id | UUID | Links events to sessions |
| event_type | TEXT | page_view, feature_use, click, signup, login, etc. |
| event_name | TEXT | Specific event (e.g., "ghost_chat_message") |
| page_path | TEXT | URL path visited |
| feature_category | TEXT | ghost, agents, studio, health, discovery |
| metadata | JSONB | Custom properties per event |
| ip_address | INET | User IP (hashed for privacy option) |
| country_code | TEXT | Geo-location country |
| region | TEXT | Geo-location region/state |
| city | TEXT | Geo-location city |
| user_agent | TEXT | Browser/device info |
| referrer | TEXT | Traffic source URL |
| utm_source | TEXT | Marketing attribution |
| utm_medium | TEXT | Marketing channel |
| utm_campaign | TEXT | Campaign name |
| created_at | TIMESTAMPTZ | Event timestamp |

**Table: `user_sessions`**
Tracks complete user sessions with duration and activity metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Session ID |
| user_id | UUID | User reference |
| anonymous_id | TEXT | For pre-signup tracking |
| started_at | TIMESTAMPTZ | Session start |
| ended_at | TIMESTAMPTZ | Session end (updated on last activity) |
| duration_seconds | INTEGER | Computed session duration |
| page_count | INTEGER | Pages visited |
| feature_count | INTEGER | Features used |
| event_count | INTEGER | Total events |
| entry_page | TEXT | First page visited |
| exit_page | TEXT | Last page visited |
| ip_address | INET | Session IP |
| country_code | TEXT | Geographic location |
| device_type | TEXT | desktop, mobile, tablet |
| browser | TEXT | Chrome, Safari, etc. |
| referrer | TEXT | Traffic source |
| utm_source | TEXT | Marketing source |
| is_converted | BOOLEAN | Did anonymous convert to signup? |
| is_active | BOOLEAN | Currently active session |
| last_activity_at | TIMESTAMPTZ | Last event timestamp |

**Table: `user_signups`**
Dedicated table for signup tracking with full attribution.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to auth.users |
| email | TEXT | User email |
| full_name | TEXT | User name |
| signup_method | TEXT | email, google, github |
| ip_address | INET | Signup IP |
| country_code | TEXT | Signup country |
| city | TEXT | Signup city |
| referrer | TEXT | Traffic source |
| utm_source | TEXT | Marketing source |
| utm_campaign | TEXT | Campaign |
| landing_page | TEXT | First page visited |
| pages_before_signup | INTEGER | Engagement depth |
| time_to_signup_seconds | INTEGER | Time from first visit to signup |
| device_type | TEXT | Device used |
| browser | TEXT | Browser used |
| notification_sent | BOOLEAN | Email notification sent |
| created_at | TIMESTAMPTZ | Signup timestamp |

**Table: `user_cost_tracking`**
Tracks costs per user per feature.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | User reference |
| date | DATE | Tracking date |
| feature | TEXT | Feature used |
| provider | TEXT | AI provider (anthropic, openai, etc.) |
| model | TEXT | Model used |
| input_tokens | INTEGER | Tokens consumed |
| output_tokens | INTEGER | Tokens generated |
| estimated_cost_usd | NUMERIC(10,6) | Estimated cost |
| requests_count | INTEGER | Number of requests |
| created_at | TIMESTAMPTZ | Record timestamp |

---

## 2. Edge Function: Signup Notification System

### 2.1 New Function: `notify-signup`

Sends immediate email notification to malena@axessible.ai for every new user.

```text
Triggered by: Database trigger on auth.users INSERT
Sends to: malena@axessible.ai
Contains:
  - User email and name
  - Signup timestamp
  - IP address and location
  - Traffic source (referrer, UTM)
  - Device and browser info
  - Tier assigned (ghost_free)
```

### 2.2 Database Trigger Enhancement

Modify `handle_new_user()` to:
1. Insert into `user_signups` table
2. Call `notify-signup` edge function via pg_net
3. Record attribution data from session context

---

## 3. Frontend Analytics Tracker

### 3.1 New Hook: `useAnalytics`

A comprehensive analytics hook that tracks:

```text
Location: src/hooks/useAnalytics.ts

Features:
- Automatic page view tracking
- Feature usage tracking
- Click event tracking
- Session management (start/end/duration)
- UTM parameter capture
- Referrer tracking
- Device/browser detection
```

### 3.2 Analytics Provider

Wraps the app to provide consistent tracking context:

```text
Location: src/contexts/AnalyticsContext.tsx

Responsibilities:
- Generate/persist anonymous IDs
- Manage session lifecycle
- Batch events for efficient sending
- Sync with backend on page unload
```

### 3.3 Feature Tracking Integration

Add tracking calls to key features:

| Feature | Events to Track |
|---------|-----------------|
| Ghost Chat | message_sent, model_switched, mode_changed |
| Studio | artifact_generated, source_uploaded |
| Agents | task_started, task_completed, task_failed |
| Discovery | search_performed, source_selected |
| Health | consultation_started, document_uploaded |
| Vault | file_encrypted, file_shared |

---

## 4. Edge Function: Analytics Ingestion

### 4.1 New Function: `ingest-analytics`

High-performance analytics event receiver:

```text
Location: supabase/functions/ingest-analytics/index.ts

Features:
- Batch event ingestion (up to 100 events)
- IP geolocation lookup
- Session management
- Cost calculation
- Real-time updates
```

### 4.2 Cost Calculation Logic

```text
Cost per model (approximate):
- Claude Opus 4: $15/1M input, $75/1M output
- Claude Sonnet 4: $3/1M input, $15/1M output
- GPT-4o: $5/1M input, $15/1M output
- Gemini Pro: $1.25/1M input, $5/1M output
- DeepSeek: $0.14/1M input, $0.28/1M output
```

---

## 5. Platform Owner Dashboard

### 5.1 New Page: `/admin/platform-analytics`

A comprehensive dashboard showing:

**Real-time Metrics Panel:**
- Active users right now
- Signups today/this week/this month
- Active sessions count
- Revenue today

**User Acquisition:**
- New signups with full details
- Traffic sources breakdown
- Conversion funnel (visit → signup → paid)
- Geographic distribution map

**User Activity:**
- Most active users (ranked)
- Feature usage heatmap
- Page popularity
- Session duration distribution
- Active vs idle users

**Cost & Revenue:**
- Cost per user
- Revenue per user
- Margin by user tier
- AI provider cost breakdown
- Daily/weekly/monthly trends

**User Drilldown:**
Click any user to see:
- Complete session history
- All pages visited
- Features used
- Costs incurred
- Revenue generated
- Full activity timeline

### 5.2 Real-time Notifications Component

```text
Location: src/components/admin/LiveActivityFeed.tsx

Shows live stream of:
- New signups (highlighted)
- User logins
- Feature usage
- High-value actions
```

---

## 6. Implementation Sequence

### Phase 1: Database Schema (Day 1)
1. Create analytics tables with proper indexes
2. Create RLS policies (admin-only read)
3. Create aggregation functions
4. Add trigger to `auth.users` for signup capture

### Phase 2: Signup Notifications (Day 1)
1. Create `notify-signup` edge function
2. Configure pg_net to call function on signup
3. Test email delivery to malena@axessible.ai

### Phase 3: Frontend Tracking (Day 2)
1. Create `useAnalytics` hook
2. Create `AnalyticsProvider` context
3. Integrate into App.tsx
4. Add feature-specific tracking

### Phase 4: Analytics Ingestion (Day 2)
1. Create `ingest-analytics` edge function
2. Add geolocation lookup
3. Implement cost calculation
4. Test end-to-end flow

### Phase 5: Dashboard (Day 3)
1. Create Platform Analytics page
2. Build metric cards and charts
3. Add user drilldown views
4. Implement live activity feed
5. Add export capabilities

---

## 7. Technical Details

### 7.1 Privacy Considerations

- IP addresses can be hashed if preferred
- Full GDPR compliance with data retention policies
- Audit log for all data access
- No tracking of sensitive health data content

### 7.2 Performance Optimizations

- Batch event ingestion (100 events per request)
- Materialized views for aggregate metrics
- Partitioned tables for historical data
- Redis caching for real-time counters

### 7.3 Data Retention

| Data Type | Retention |
|-----------|-----------|
| Raw events | 90 days |
| Session summaries | 1 year |
| User aggregates | Forever |
| Cost tracking | Forever |

---

## 8. Sample Signup Notification Email

```text
Subject: New SwissBrain Signup: john.doe@example.com

New User Signup

Name: John Doe
Email: john.doe@example.com
Timestamp: 2026-01-28 15:32:45 UTC

Location:
  IP: 185.23.xxx.xxx
  Country: Switzerland
  City: Zurich

Traffic Source:
  Referrer: https://www.google.com
  UTM Source: google
  UTM Campaign: brand_search

Device:
  Type: Desktop
  Browser: Chrome 122
  OS: macOS

Engagement:
  Landing Page: /ghost
  Pages Before Signup: 4
  Time to Signup: 8 minutes

Tier Assigned: ghost_free

View in Dashboard: [link]
```

---

## 9. Dashboard Metrics Summary

| Metric | Source | Update Frequency |
|--------|--------|------------------|
| Active Users Now | user_sessions | Real-time |
| Signups Today | user_signups | Real-time |
| Revenue Today | credit_transactions + stripe | Hourly |
| Cost Today | user_cost_tracking | Real-time |
| Top Features | platform_analytics_events | Hourly |
| Geographic Breakdown | user_sessions | Daily |
| User LTV | billing + usage | Daily |
| Conversion Rate | user_signups / sessions | Daily |

---

## 10. Files to Create/Modify

### New Files:
```text
supabase/functions/notify-signup/index.ts
supabase/functions/ingest-analytics/index.ts
src/hooks/useAnalytics.ts
src/contexts/AnalyticsContext.tsx
src/pages/admin/PlatformAnalytics.tsx
src/components/admin/LiveActivityFeed.tsx
src/components/admin/UserDrilldown.tsx
src/components/admin/SignupNotifications.tsx
src/components/admin/CostRevenueChart.tsx
src/components/admin/GeographicMap.tsx
```

### Modified Files:
```text
src/App.tsx (add AnalyticsProvider)
src/contexts/AuthContext.tsx (track signups/logins)
src/layouts/AdminLayout.tsx (add Platform Analytics nav)
supabase/migrations/[new migration for schema]
```

---

## Outcome

After implementation, you will have:

1. **Immediate email notification** for every new signup to malena@axessible.ai
2. **Complete visibility** into user journeys from first visit to conversion
3. **Real-time session tracking** with duration and activity metrics
4. **Per-user cost attribution** down to the model and token level
5. **Revenue tracking** with LTV calculations
6. **Geographic insights** showing where users are signing up from
7. **Feature usage analytics** showing what's popular and what's not
8. **Active/idle classification** to identify engaged vs churning users
9. **Traffic source attribution** for marketing optimization
10. **Enterprise-ready audit trail** for investor due diligence
