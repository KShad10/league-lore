# Supabase Row Level Security (RLS) Policy Audit

## Overview

This document audits the Row Level Security policies implemented in the League Lore database schema.

## RLS Coverage Summary

| Table | RLS Enabled | Policy Defined | Policy Type | Status |
|-------|-------------|----------------|-------------|--------|
| `users` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `leagues` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `league_settings_history` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `managers` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `manager_username_history` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `weekly_scores` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `matchups` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `player_scores` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `reports` | ✅ | ✅ | `FOR ALL` | ✅ Covered |
| `email_recipients` | ✅ | ✅ | `FOR ALL` | ✅ Covered |

## Policy Analysis

### 1. Users Table
```sql
CREATE POLICY "Users can access own record" ON users
  FOR ALL USING (id = auth.uid());
```
- **Status**: ✅ Secure
- **Notes**: Users can only access their own user record via direct ID match.

### 2. Leagues Table
```sql
CREATE POLICY "Users can access own leagues" ON leagues
  FOR ALL USING (user_id = auth.uid());
```
- **Status**: ✅ Secure
- **Notes**: Users can only access leagues they own.

### 3. Related Tables (league-scoped)
All tables that reference `leagues` use a consistent pattern:
```sql
FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));
```

This pattern ensures:
- User can only access data for leagues they own
- Cascading security through the league ownership model

### 4. Manager Username History
Uses a deeper join:
```sql
FOR ALL USING (manager_id IN (
  SELECT m.id FROM managers m
  JOIN leagues l ON m.league_id = l.id
  WHERE l.user_id = auth.uid()
));
```
- **Status**: ✅ Secure
- **Notes**: Correctly traces ownership through the manager → league → user chain.

## Views

Views do not have RLS directly enabled. They inherit RLS from their underlying tables.

| View | Base Table(s) | Inherits RLS |
|------|---------------|--------------|
| `season_standings` | `weekly_scores`, `managers` | ✅ |
| `career_stats` | `weekly_scores`, `managers` | ✅ |
| `h2h_records` | `weekly_scores`, `managers` | ✅ |
| `weekly_rankings` | `weekly_scores` | ✅ |

Since all underlying tables have RLS enabled, view queries will be filtered appropriately.

## Identified Gaps

### 1. Missing `report_drafts` Table

The application code references a `report_drafts` table for auto-saved drafts, but this table is not present in the schema file.

**Recommendation**: Add the table with appropriate RLS:
```sql
CREATE TABLE report_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  season INT NOT NULL,
  week INT,
  report_type TEXT NOT NULL,
  html_content TEXT,
  sections JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(league_id, season, week, report_type)
);

ALTER TABLE report_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own report drafts" ON report_drafts
  FOR ALL USING (league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid()));
```

### 2. Consider Separating SELECT/INSERT/UPDATE/DELETE Policies

Current policies use `FOR ALL` which applies to all operations. Consider separating for finer control:

```sql
-- Read access
CREATE POLICY "Users can read own leagues" ON leagues
  FOR SELECT USING (user_id = auth.uid());

-- Write access
CREATE POLICY "Users can insert own leagues" ON leagues
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own leagues" ON leagues
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own leagues" ON leagues
  FOR DELETE USING (user_id = auth.uid());
```

**Trade-off**: More granular but more complex to maintain.

### 3. Consider Public Read Access for Shared Reports

If reports are ever shared publicly (e.g., via public URL), additional policies would be needed:

```sql
-- Future: Public read access for published reports
CREATE POLICY "Anyone can view published reports" ON reports
  FOR SELECT USING (
    status = 'published'
    OR league_id IN (SELECT id FROM leagues WHERE user_id = auth.uid())
  );
```

## Security Best Practices Applied

1. ✅ **Least Privilege**: Users only access their own data
2. ✅ **Defense in Depth**: API routes also verify auth before DB access
3. ✅ **Cascading Deletes**: Foreign keys use `ON DELETE CASCADE`
4. ✅ **Consistent Patterns**: All league-scoped tables use same policy pattern
5. ✅ **Auth Function**: Uses `auth.uid()` from Supabase Auth

## Testing Recommendations

1. **Test unauthenticated access**: Verify all tables reject unauthenticated queries
2. **Test cross-user access**: Verify users cannot access other users' data
3. **Test league ownership**: Verify changing league ownership propagates correctly
4. **Test cascading deletes**: Verify deleting a league removes all related data

## Conclusion

The current RLS implementation is **secure and comprehensive** for the existing tables. The main recommendation is to add the missing `report_drafts` table with appropriate RLS policy.

All policies correctly use `auth.uid()` to restrict access, and the cascading ownership model (user → league → data) is consistently applied.

---

*Last Audited: January 2026*
