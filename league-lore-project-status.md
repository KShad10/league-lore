# League Lore — Project Status & Continuation Guide

**Last Updated:** January 3, 2026  
**Project Location:** `/Users/kristianshad/league-lore/`  
**Supabase Project:** Org "KShad10's Org", Project "League Lore", Region "Americas"

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Completed Work](#completed-work)
3. [Current Architecture](#current-architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Known Issues & Limitations](#known-issues--limitations)
7. [Future Roadmap](#future-roadmap)

---

## Project Overview

League Lore is a Next.js web application that syncs fantasy football league data from the Sleeper API into a Supabase database, then provides analytics and reporting tools. The primary use case is supporting the "OG Papio Dynasty League" — a 10-team SuperFlex dynasty league with dual scoring (H2H + median wins).

### Tech Stack
- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Data Source:** Sleeper API

### Key Features Built
- League data sync from Sleeper API
- Season standings with H2H, Median, Combined, and All-Play records
- Career/manager statistics across all seasons
- Head-to-head records between managers
- Streak tracking (current and historical)
- Weekly scores with median win calculation
- Matchup history with game type classification
- Postseason bracket visualization with seeds, byes, and playoff format settings

---

## Completed Work

### Phase 1: Foundation ✓
- Next.js project initialized with TypeScript and Tailwind
- Supabase client configuration
- Environment variables setup

### Phase 2: Data Ingestion ✓
- Sleeper API wrapper (`/src/lib/sleeper/`)
- Data sync endpoint (`/api/leagues/sync/route.ts`)
- Tables populated: `leagues`, `managers`, `league_settings_history`, `matchups`, `weekly_scores`

### Phase 3: Stats API Endpoints ✓
All endpoints live at `/api/leagues/[leagueId]/`

| Endpoint | Status | Description |
|----------|--------|-------------|
| `/standings` | ✓ | Season standings with all record types, supports All Seasons view |
| `/managers` | ✓ | Career stats across all seasons |
| `/streaks` | ✓ | Current and longest streaks, league records |
| `/h2h` | ✓ | Head-to-head records, filterable by manager and matchup type |
| `/matchups` | ✓ | All matchups with game type labels |
| `/weekly` | ✓ | Weekly scores with H2H/Median/All-Play results |
| `/postseason` | ✓ | Playoff and Toilet Bowl brackets with seeding |

### Phase 3.5: UI Implementation ✓
- Stats dashboard at `/dashboard/stats`
- Tabbed interface for all endpoints
- Season/week filtering
- Color-coded All Seasons view
- Postseason bracket visualization

### Phase 3.6: Playoff Settings Enhancement ✓ (Jan 2, 2026)
Enhanced postseason support with full playoff format configuration:

**Types Updated (`/src/types/sleeper.ts`):**
- Added `PlayoffSettings` interface with all format fields
- Extended `SleeperLeague.settings` to capture additional Sleeper API fields:
  - `playoff_round_type` (0=one week, 1=two week champ, 2=two weeks all)
  - `playoff_seed_type` (0=fixed bracket, 1=re-seed)
  - `playoff_type` (0=standard, 1=two weeks per matchup)
  - `loser_bracket_type` (0=toilet bowl, 1=consolation)

**Sleeper API Wrapper (`/src/lib/sleeper/league.ts`):**
- New `extractPlayoffSettings()` function normalizes raw Sleeper settings
- All playoff format fields now extracted with sensible defaults

**Sync Route (`/api/leagues/sync/route.ts`):**
- Now stores all playoff format settings in `league_settings_history.league_settings` JSONB

**Postseason Endpoint (`/api/leagues/[leagueId]/postseason/route.ts`):**
- Complete rewrite with modular helper functions
- Full `PlayoffConfig` interface for settings
- New `Seeding` interface with `hasBye` field
- Bye week detection based on playoff team count
- Support for different round types (one week, two week championship, two weeks per round)
- Support for consolation vs toilet bowl lower brackets
- Third place tracking in summary
- Format descriptors in API response (`roundType`, `seedType`, `lowerBracket`)

**UI Updates (`/src/app/dashboard/stats/page.tsx`):**
- Added third place display to summary banner
- Added format info display (round type, seeding, lower bracket type)
- BYE badges in seedings list for teams with first-round byes
- BYE cards in bracket visualization for bye week
- Updated grid to 4 columns for summary (Champion, Runner-Up, Third, Last Place)

### Phase 4: Report Templates ✓ (Jan 2, 2026)
Complete report generation system with Cob Chronicles styling:

**Theme System (`/src/lib/reports/theme.ts`):**
- `cobChroniclesTheme` - Full color palette, typography, spacing
- `reportStyles` - CSS-in-JS style objects
- `signaturePhrases` - Supreme Leader persona phrases (openers, transitions, closers)
- `reportTypes` - Configuration for different report types

**HTML Generator (`/src/lib/reports/html-generator.ts`):**
- `reportStylesheet` - Complete CSS for print-optimized reports
- `generateHtmlDocument()` - Wraps content in full HTML document
- `html` builder object with components:
  - `title`, `subtitle`, `section`, `subsection`
  - `statGrid`, `table`, `matchupCard`, `matchupGrid`
  - `callout`, `highlightBox`, `badge`, `awardCard`
  - `pageBreak`, `noBreak`

**Weekly Report Generator (`/src/lib/reports/weekly-report.ts`):**
- `generateWeeklyReport(data)` - Full weekly recap
- Week summary stats, matchup cards, standings
- Top/bottom performers with award cards
- Playoff picture section for late-season weeks
- Random persona phrases for variety

**Postseason Report Generator (`/src/lib/reports/postseason-report.ts`):**
- `generatePostseasonReport(data)` - Full postseason report
- Championship banner with gradient styling
- Seedings display with bye indicators
- Playoff bracket, place games, toilet bowl sections
- Final standings table with badges
- Punishment callout for toilet bowl loser

**API Endpoints:**
- `GET /api/leagues/[leagueId]/reports/weekly?season=X&week=Y`
  - Returns HTML report (default) or JSON data (`format=json`)
- `GET /api/leagues/[leagueId]/reports/postseason?season=X`
  - Returns HTML report (default) or JSON data (`format=json`)

**Reports Dashboard (`/dashboard/reports`):**
- Report type selection (Weekly / Postseason)
- Season and week selectors
- Live preview in iframe
- "Open in New Tab" for full view
- "Download HTML" for local save
- PDF conversion instructions

### Phase 5: Claude API Integration ✓ (Jan 2, 2026)
Complete AI commentary generation with Supreme Leader persona:

**AI Client (`/src/lib/ai/client.ts`):**
- Anthropic SDK configuration
- Model: `claude-sonnet-4-20250514`
- Temperature: 0.8 for creative output

**Prompts (`/src/lib/ai/prompts.ts`):**
- `SUPREME_LEADER_SYSTEM_PROMPT` - Full persona definition
  - Voice & style guidelines (60% stats, 30% comedy, 10% meta)
  - Signature phrases ("Vegas KNOWS", "But I digress")
  - Writing guidelines (em-dashes, varied sentence length)
  - League context (SuperFlex, dual scoring, toilet bowl)
- `PROMPTS` object with templates for:
  - `weeklyOpener` - Scene-setting narrative
  - `matchupCommentary` - Individual game analysis
  - `standingsAnalysis` - Playoff race breakdown
  - `topPerformerSpotlight` - Celebrating winners
  - `bottomPerformerRoast` - Gentle roasting
  - `playoffPicture` - Late-season implications
  - `postseasonRecap` - Championship summary
  - `awardsCommentary` - Season honors
  - `weeklyCloser` - Sign-off

**Generator (`/src/lib/ai/generator.ts`):**
- `generateWeeklyCommentary(data)` - Full weekly commentary
  - Returns: opener, matchupCommentaries, standingsAnalysis, topPerformerSpotlight, bottomPerformerRoast, playoffPicture, closer
- `generatePostseasonCommentary(data)` - Postseason narrative
  - Returns: recap, championPath, toiletBowlSummary
- `generateSingleCommentary(type, data)` - Ad-hoc generation
- `generateRaw(prompt)` - Custom prompt passthrough

**Commentary API (`/api/leagues/[leagueId]/commentary`):**
- POST endpoint for generating commentary
- Supports: `weekly`, `postseason`, `custom` types
- Fetches league data and passes to Claude
- Returns structured commentary object

**Updated Reports Dashboard (`/dashboard/reports`):**
- New "AI Commentary" tab
- Generate commentary button with loading state
- Color-coded commentary sections display
- Copy All button for clipboard
- Progress indicator during generation (~30-60 sec)

**Environment:**
- Requires `ANTHROPIC_API_KEY` in `.env.local`

### Phase 5.5: PDF Export ✓ (Jan 3, 2026)
Browser-based PDF export using native print dialog:

**PDF Library (`/src/lib/pdf/index.ts`):**
- `printIframe(iframe)` - Triggers print dialog for iframe content
- `printHtml(html, title)` - Opens HTML in new window and prints
- `exportReportAsPdf(url)` - Fetches and prints report URL
- `pdfPrintStyles` - Enhanced print CSS for better output
- `pageConfig` - Letter and A4 size configurations

**Enhanced Print CSS (`/src/lib/reports/html-generator.ts`):**
- Page size: Letter (8.5" × 11") with 0.5" margins
- Force background colors/images with `print-color-adjust`
- Page break utilities: `.page-break`, `.no-break`, `.avoid-break`
- Headers stay with content (`page-break-after: avoid`)
- Tables and cards kept together (`page-break-inside: avoid`)
- Screen-only element hiding (`.no-print`, `.screen-only`)

**Reports Dashboard Updates:**
- New "Export PDF" button (primary variant)
- Iframe ref for direct print access
- Updated tip text with PDF export instructions

**Usage:**
1. Generate HTML report
2. Click "Export PDF" button
3. Browser print dialog opens with report content
4. Select "Save as PDF" as destination
5. PDF saved with all styling preserved

---

## Current Architecture

### File Structure
```
league-lore/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── leagues/
│   │   │   │   ├── [leagueId]/
│   │   │   │   │   ├── standings/route.ts
│   │   │   │   │   ├── managers/route.ts
│   │   │   │   │   ├── streaks/route.ts
│   │   │   │   │   ├── h2h/route.ts
│   │   │   │   │   ├── matchups/route.ts
│   │   │   │   │   ├── weekly/route.ts
│   │   │   │   │   ├── postseason/route.ts
│   │   │   │   │   ├── commentary/route.ts     ← NEW (Phase 5)
│   │   │   │   │   └── reports/
│   │   │   │   │       ├── weekly/route.ts
│   │   │   │   │       └── postseason/route.ts
│   │   │   │   └── sync/route.ts
│   │   │   └── test-sleeper/
│   │   ├── dashboard/
│   │   │   ├── stats/page.tsx
│   │   │   ├── sync/page.tsx
│   │   │   └── reports/page.tsx        ← Updated (AI tab)
│   │   └── page.tsx
│   ├── components/
│   │   ├── reports/
│   │   └── ui/
│   ├── lib/
│   │   ├── sleeper/
│   │   │   ├── config.ts
│   │   │   ├── fetch.ts
│   │   │   ├── index.ts
│   │   │   ├── league.ts
│   │   │   └── stats.ts
│   │   ├── reports/
│   │   │   ├── index.ts
│   │   │   ├── theme.ts
│   │   │   ├── html-generator.ts
│   │   │   ├── weekly-report.ts
│   │   │   └── postseason-report.ts
│   │   ├── ai/                         ← NEW (Phase 5)
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   ├── prompts.ts
│   │   │   └── generator.ts
│   │   ├── pdf/                        ← NEW (Phase 5.5)
│   │   │   └── index.ts
│   │   └── supabase/
│   └── types/
│       └── sleeper.ts
├── sql/
├── .env.local                      ← Add ANTHROPIC_API_KEY
└── package.json
```

### Key Files

**`/src/lib/sleeper/league.ts`** — Sleeper API wrapper
- `getLeague(leagueId)` — League info and settings (now includes full playoff config)
- `extractPlayoffSettings(settings)` — Normalizes raw Sleeper settings to `PlayoffSettings`
- `getLeagueUsers(leagueId)` — Manager info
- `getLeagueRosters(leagueId)` — Current rosters
- `getWeekMatchups(leagueId, week)` — Weekly matchups

**`/src/app/api/leagues/sync/route.ts`** — Data sync
- Fetches all data from Sleeper API
- Calculates weekly ranks, median wins, all-play records
- **Now stores full playoff format settings in `league_settings_history`**

**`/src/app/api/leagues/[leagueId]/postseason/route.ts`** — Postseason endpoint
- `getPlayoffConfig()` — Loads settings from DB
- `calculateSeedings()` — Ranks managers, assigns byes
- `getByeSeeds()` — Determines which seeds get byes based on playoff team count
- `classifyMatchups()` — Tags each matchup (playoff, place_game, toilet_bowl)
- `getPlayoffMatchupType()` — Names rounds based on format
- `isTwoWeekRound()` — Checks if round spans two weeks
- `groupByBracket()` — Organizes matchups into bracket structures
- `determineSummary()` — Finds champion, runner-up, third place, toilet bowl loser

---

## Database Schema

### Tables

**`leagues`**
```sql
- id: uuid (PK)
- user_id: uuid (FK → users)
- sleeper_league_id: text
- name: text
- team_count: integer
- roster_positions: jsonb
- scoring_settings: jsonb
- first_season: integer
- current_season: integer
- last_sync_at: timestamp
- created_at, updated_at: timestamp
```

**`managers`**
```sql
- id: uuid (PK)
- league_id: uuid (FK → leagues)
- sleeper_user_id: text
- sleeper_roster_id: integer
- current_username: text
- display_name: text
- avatar_url: text
- is_active: boolean
- created_at, updated_at: timestamp
```

**`league_settings_history`**
```sql
- id: uuid (PK)
- league_id: uuid (FK → leagues)
- season: integer
- league_settings: jsonb  -- NOW includes:
  -- playoff_week_start, playoff_teams, trade_deadline, total_rosters
  -- playoff_round_type, playoff_seed_type, playoff_type, loser_bracket_type
- scoring_settings: jsonb
- roster_positions: jsonb
- created_at: timestamp
```

**`matchups`**
```sql
- id: uuid (PK)
- league_id: uuid (FK → leagues)
- season: integer
- week: integer
- matchup_id: integer
- team1_manager_id: uuid (FK → managers)
- team2_manager_id: uuid (FK → managers)
- team1_points: decimal
- team2_points: decimal
- winner_manager_id: uuid (FK → managers)
- point_differential: decimal
- is_playoff: boolean
- is_toilet_bowl: boolean
- playoff_round: integer
- created_at, updated_at: timestamp
```

**`weekly_scores`**
```sql
- id: uuid (PK)
- league_id: uuid (FK → leagues)
- manager_id: uuid (FK → managers)
- opponent_id: uuid (FK → managers)
- season: integer
- week: integer
- matchup_id: integer
- points_for: decimal
- points_against: decimal
- optimal_points: decimal
- h2h_win: boolean
- median_win: boolean
- weekly_rank: integer
- allplay_wins: integer
- allplay_losses: integer
- created_at, updated_at: timestamp
```

---

## API Endpoints

### GET `/api/leagues/[leagueId]/postseason`
**Query Params:** `season` (required)

**Response (Enhanced):**
```json
{
  "success": true,
  "leagueId": "uuid",
  "season": 2025,
  "settings": {
    "playoffWeekStart": 15,
    "playoffTeams": 6,
    "totalRosters": 10,
    "toiletBowlTeams": 4,
    "format": {
      "roundType": "one-week-per-round",
      "seedType": "fixed-bracket",
      "lowerBracket": "toilet-bowl"
    }
  },
  "seedings": [{
    "seed": 1,
    "managerId": "uuid",
    "name": "Shaddydaddy105",
    "combinedWins": 22,
    "pointsFor": 2156.78,
    "bracket": "playoff",
    "hasBye": true
  }],
  "summary": {
    "champion": "aj006",
    "championSeed": 2,
    "runnerUp": "Shaddydaddy105",
    "runnerUpSeed": 1,
    "thirdPlace": "Wolfgang123",
    "thirdPlaceSeed": 4,
    "toiletBowlLoser": "Goduto",
    "toiletBowlLoserSeed": 10
  },
  "playoff": {
    "rounds": {
      "15": {
        "name": "Wildcard",
        "week": 15,
        "byes": [
          { "seed": 1, "name": "Shaddydaddy105", "managerId": "uuid" },
          { "seed": 2, "name": "aj006", "managerId": "uuid" }
        ],
        "matchups": [/* matchup objects */]
      },
      "16": {
        "name": "Semifinal",
        "week": 16,
        "matchups": [/* matchup objects */]
      },
      "17": {
        "name": "Championship",
        "week": 17,
        "matchups": [/* matchup objects */]
      }
    }
  },
  "placeGames": {
    "rounds": {
      "16": { "name": "5th Place", "week": 16, "matchups": [...] },
      "17": { "name": "3rd Place", "week": 17, "matchups": [...] }
    }
  },
  "toiletBowl": {
    "rounds": {
      "15": { "name": "Toilet Bowl Round 1", "week": 15, "matchups": [...] },
      "16": { "name": "Last Place", "week": 16, "matchups": [...] }
    }
  }
}
```

---

## Known Issues & Limitations

### 1. Weekly Scores Data Gap
The current sync may not have all 2025 weeks. Re-run sync to pull latest data.

### 2. Two-Week Matchup Aggregation
While the system now tracks whether a round is two weeks, aggregate score calculation and display for two-week matchups is not yet implemented. The `isTwoWeekMatchup` flag is set but UI doesn't show combined scores.

### 3. Re-Seeding Logic
The `playoffSeedType === 1` (re-seed) case is detected and stored but the actual bracket reconstruction after each round isn't implemented yet.

### 4. Place Game Detection
Current logic checks if both teams have already lost in the playoff bracket. Could be enhanced by tracking expected bracket paths for multi-round tournaments.

---

## Future Roadmap

### Phase 6: Additional Features
- Player-level statistics (top scorers, positional breakdowns)
- Trade history visualization
- Draft analysis (hit rates, best picks)
- Dynasty value integration (FantasyCalc API)

### Phase 7: Multi-League Support
- League selection UI
- Cross-league comparisons
- Public league directory

### Phase 8: Two-Week Matchup Support
- Aggregate score display for multi-week matchups
- Week span indicators in bracket view
- Combined score tooltips

### Phase 9: AI-Enhanced Reports (Future)
- Auto-embed AI commentary into HTML reports
- Streaming generation for faster feedback
- Manager-specific narrative threads
- Historical performance callbacks

### Phase 10: Server-Side PDF Generation (Optional Enhancement)
- Puppeteer integration for consistent PDF output
- Custom fonts and precise layout control
- Batch PDF generation for archives
- Note: Requires Vercel Pro or custom deployment for Puppeteer

---

## Development Commands

```bash
# Start development server
cd /Users/kristianshad/league-lore
npm run dev

# Access the app
open http://localhost:3000/dashboard/stats

# Sync league data (re-run to update 2025 weeks)
# Visit http://localhost:3000/dashboard/sync
# Or POST to /api/leagues/sync with body: { "sleeper_league_id": "your-league-id" }
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
ANTHROPIC_API_KEY=[your-api-key]  # Required for AI Commentary
```

---

## Contact & Context

This project is for Kristian (username: kristianshad), commissioner of the OG Papio Dynasty League. The league has been running since 2022 with 10 managers. Key context:

- **Scoring:** H2H + Median wins (dual scoring since 2023)
- **Format:** SuperFlex, 0.5 TE Premium (since 2023)
- **Playoffs:** 6 teams, Week 15-17, seeds 1-2 get byes
- **Toilet Bowl:** Bottom 4 teams, inverse elimination (losers advance)
- **Report Style:** "The Cob Chronicles" written as "Supreme Leader SHADdam Hussein"

The existing Python data pipeline at `/Users/kristianshad/Projects/OG_Papio_Dynasty_League/` contains CSV data files that can be referenced for validation.
