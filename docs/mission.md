# Mission — Expanse Tracker

## Core Objective

Expanse Tracker is a personal and family finance dashboard that helps people in Bangladesh log daily expenses, understand monthly spending patterns, and stay on top of recurring bills — all from a single, clean interface.

## Target Audience

- **Primary:** Individual earners in Bangladesh (18–45) who want a simple way to track day-to-day spending without the overhead of a full accounting tool.
- **Secondary:** Small families who share a household budget and want visibility into combined spending across categories.
- **SaaS buyers:** Power users who need unlimited history, priority reports, and multi-device access via a paid subscription.

## Problem It Solves

Most people in Bangladesh have no structured way to record expenses. They either keep mental notes (forgotten in days) or use generic spreadsheets (too tedious to maintain). Expanse Tracker removes friction:

- **One tap to log** an expense from any device.
- **Automatic monthly summaries** so users always know where their money went.
- **Category breakdowns** that make patterns visible at a glance.
- **Recurring vs. one-time distinction** so fixed costs (rent, subscriptions) are separated from variable spending (groceries, outings).

## Currency

All monetary values are expressed exclusively in **Bangladeshi Taka (BDT, ৳)**. No other currency is displayed or accepted.

## Business Model

- **Free tier** — up to 20 expenses/month, 3 categories, monthly summary only.
- **Monthly plan** — ৳100/month — unlimited expenses, all categories, full history.
- **Yearly plan** — ৳500/year — everything in Monthly, 2 months free, priority support, family sharing.

Subscription state is managed in the `users` table (`subscriptionPlan`, `subscriptionExpiry`) and controlled by admins via the CMS or by users via the `/pricing` page.
