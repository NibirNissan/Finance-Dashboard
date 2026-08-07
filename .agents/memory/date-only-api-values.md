---
name: Date-only API values
description: Calendar dates may arrive from the API as ISO timestamps even when the domain field is date-only.
---

Normalize date-only values to their first 10 characters before formatting them or putting them into date inputs.

**Why:** PostgreSQL date columns and generated response schemas can cross the API boundary as timestamp-shaped ISO strings; appending another time suffix to an already timestamped value creates an invalid date.

**How to apply:** Keep API payloads and database storage date-only, but make display and edit-form helpers tolerant of both `YYYY-MM-DD` and `YYYY-MM-DDT00:00:00.000Z`.