# League Lore API Reference

This document describes all available API endpoints for the League Lore fantasy football analytics platform.

## Base URL

All API endpoints are relative to the application base URL:
- Development: `http://localhost:3000`
- Production: `https://your-domain.com`

## Authentication

All API endpoints require authentication via Supabase Auth. Include the session cookie in all requests.

Unauthorized requests return:
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

---

## Leagues

### List User Leagues

```
GET /api/leagues
```

Returns all leagues associated with the authenticated user.

**Response:**
```json
{
  "success": true,
  "leagues": [
    {
      "id": "uuid",
      "sleeperLeagueId": "123456789",
      "name": "OG Papio Dynasty",
      "teamCount": 10,
      "firstSeason": 2020,
      "currentSeason": 2024,
      "lastSyncAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### Sync League Data

```
POST /api/leagues/sync
```

Syncs all historical data from Sleeper API for a league.

**Request Body:**
```json
{
  "sleeper_league_id": "123456789"
}
```

**Response:**
```json
{
  "success": true,
  "leagueId": "uuid",
  "userId": "uuid",
  "league": {
    "name": "OG Papio Dynasty",
    "seasons": 5
  },
  "stats": {
    "seasons": 5,
    "uniqueManagers": 12,
    "weeklyScores": 700,
    "matchups": 350
  },
  "message": "Synced 5 seasons, 12 unique managers..."
}
```

---

## Standings

### Get Season Standings

```
GET /api/leagues/{leagueId}/standings
```

Returns aggregated standings for a league.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| season | number | all | Filter to specific season |
| playoffs | boolean | false | Include playoff weeks |

**Response:**
```json
{
  "success": true,
  "leagueId": "uuid",
  "season": 2024,
  "includePlayoffs": false,
  "regularSeasonWeeks": 14,
  "playoffWeekStart": 15,
  "totalEntries": 10,
  "seasons": [2024, 2023, 2022],
  "standings": [
    {
      "managerId": "uuid",
      "displayName": "John Doe",
      "username": "johndoe",
      "season": 2024,
      "rank": 1,
      "record": {
        "h2h": { "wins": 10, "losses": 4 },
        "median": { "wins": 11, "losses": 3 },
        "combined": { "wins": 21, "losses": 7 },
        "allPlay": { "wins": 98, "losses": 28, "rank": 1 }
      },
      "points": {
        "for": 1850.50,
        "against": 1650.25,
        "avgPerWeek": 132.18,
        "forRank": 1,
        "againstRank": 5
      },
      "weeksPlayed": 14,
      "seasonRank": 1
    }
  ]
}
```

---

## Weekly Scores

### Get Weekly Scores

```
GET /api/leagues/{leagueId}/weekly
```

Returns weekly score data for the league.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| season | number | all | Filter to specific season |
| week | number | all | Filter to specific week |
| managerId | string | all | Filter to specific manager |

**Response:**
```json
{
  "success": true,
  "leagueId": "uuid",
  "filters": {
    "season": 2024,
    "week": 5,
    "managerId": "all"
  },
  "count": 10,
  "summary": {
    "season": 2024,
    "week": 5,
    "median": 115.50,
    "highest": 165.25,
    "lowest": 85.10,
    "topScorer": "John Doe",
    "bottomScorer": "Jane Smith",
    "teamsAboveMedian": 5,
    "teamsBelowMedian": 5
  },
  "scores": [
    {
      "id": "uuid",
      "managerId": "uuid",
      "managerName": "John Doe",
      "opponentId": "uuid",
      "opponentName": "Jane Smith",
      "season": 2024,
      "week": 5,
      "matchupId": 1,
      "points": {
        "for": 165.25,
        "against": 120.50,
        "optimal": 180.00
      },
      "results": {
        "h2hWin": true,
        "medianWin": true,
        "weeklyRank": 1,
        "allPlayWins": 9,
        "allPlayLosses": 0
      }
    }
  ]
}
```

---

## Head-to-Head Records

### Get H2H Records

```
GET /api/leagues/{leagueId}/h2h
```

Returns head-to-head records between all manager pairs.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| managerId | string | all | Filter to matchups involving this manager |
| type | string | all | Filter: "all", "regular", "playoff" |

**Response:**
```json
{
  "success": true,
  "leagueId": "uuid",
  "filters": {
    "managerId": "all",
    "matchupType": "all"
  },
  "managers": [
    { "id": "uuid", "name": "John Doe" }
  ],
  "count": 45,
  "records": [
    {
      "manager1": { "id": "uuid", "name": "John Doe" },
      "manager2": { "id": "uuid", "name": "Jane Smith" },
      "matchups": 12,
      "wins": 8,
      "losses": 4,
      "winPct": 66.7,
      "pointsFor": 1450.50,
      "pointsAgainst": 1380.25,
      "avgMargin": 5.85
    }
  ]
}
```

---

## Managers

### List League Managers

```
GET /api/leagues/{leagueId}/managers
```

Returns all managers in the league with career statistics.

**Response:**
```json
{
  "success": true,
  "leagueId": "uuid",
  "count": 10,
  "managers": [
    {
      "id": "uuid",
      "sleeperUserId": "123456",
      "username": "johndoe",
      "displayName": "John Doe",
      "nickname": "The Champ",
      "avatarUrl": "https://...",
      "contextNotes": "Always trades for RBs",
      "rivalryNotes": { "uuid": "Epic rivalry since 2020" },
      "isActive": true,
      "rank": 1,
      "career": {
        "totalWeeks": 70,
        "combined": { "wins": 100, "losses": 40, "winPct": 71.43, "rank": 1 },
        "h2h": { "wins": 50, "losses": 20, "winPct": 71.43 },
        "median": { "wins": 50, "losses": 20, "winPct": 71.43 },
        "allPlay": { "wins": 450, "losses": 180, "winPct": 71.43 },
        "points": {
          "totalPF": 9250.50,
          "totalPA": 8500.25,
          "avgPerWeek": 132.15,
          "pfRank": 1,
          "paRank": 4
        }
      }
    }
  ]
}
```

### Get Manager Details

```
GET /api/leagues/{leagueId}/managers/{managerId}
```

Returns detailed information for a specific manager.

---

## Streaks

### Get Streak Data

```
GET /api/leagues/{leagueId}/streaks
```

Returns current and historical streak information.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| season | number | all | Filter to specific season |
| playoffs | boolean | false | Include playoff weeks |

**Response:**
```json
{
  "success": true,
  "leagueId": "uuid",
  "season": "all",
  "isAllSeasons": true,
  "includePlayoffs": false,
  "regularSeasonWeeks": 14,
  "playoffWeekStart": 15,
  "streaks": [
    {
      "managerId": "uuid",
      "name": "John Doe",
      "currentStreaks": {
        "h2h": { "type": "W", "length": 5, "display": "5W" },
        "median": { "type": "W", "length": 3, "display": "3W" },
        "combined": { "type": "W", "length": 8, "display": "8W" }
      },
      "longestStreaks": {
        "h2h": {
          "win": { "length": 8, "season": 2023, "startWeek": 5, "endWeek": 12 },
          "loss": { "length": 4, "season": 2022, "startWeek": 1, "endWeek": 4 }
        },
        "median": { "win": {...}, "loss": {...} },
        "combined": { "win": {...}, "loss": {...} }
      },
      "weeksPlayed": 70
    }
  ],
  "leagueRecords": {
    "h2hWin": { "length": 10, "manager": "John Doe", "managerId": "uuid", "season": 2023, "startWeek": 1, "endWeek": 10 },
    "h2hLoss": {...},
    "medianWin": {...},
    "medianLoss": {...},
    "combinedWin": {...},
    "combinedLoss": {...}
  }
}
```

---

## Matchups

### Get All Matchups

```
GET /api/leagues/{leagueId}/matchups
```

Returns historical matchup data.

---

## Postseason

### Get Postseason Data

```
GET /api/leagues/{leagueId}/postseason
```

Returns playoff bracket and results.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| season | number | Yes | Season year |

**Response:**
```json
{
  "success": true,
  "leagueId": "uuid",
  "season": 2024,
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
  "seedings": [
    {
      "seed": 1,
      "managerId": "uuid",
      "name": "John Doe",
      "combinedWins": 21,
      "pointsFor": 1850.50,
      "bracket": "playoff",
      "hasBye": true
    }
  ],
  "summary": {
    "champion": "John Doe",
    "championSeed": 2,
    "runnerUp": "Jane Smith",
    "runnerUpSeed": 1,
    "toiletBowlLoser": "Bob Jones",
    "toiletBowlLoserSeed": 10,
    "thirdPlace": "Alice Brown",
    "thirdPlaceSeed": 3
  },
  "playoff": {
    "rounds": {
      "15": {
        "name": "Wildcard",
        "week": 15,
        "matchups": [...],
        "byes": [{ "seed": 1, "name": "John Doe" }]
      }
    }
  },
  "placeGames": {...},
  "toiletBowl": {...}
}
```

---

## Reports

### Generate Weekly Report

```
GET /api/leagues/{leagueId}/reports/weekly
```

Generates a weekly recap report.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| season | number | Yes | Season year |
| week | number | Yes | Week number |
| format | string | No | "html" (default) or "json" |

### Generate Postseason Report

```
GET /api/leagues/{leagueId}/reports/postseason
```

Generates a postseason recap report.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| season | number | Yes | Season year |
| format | string | No | "html" (default) or "json" |

### Generate PDF

```
POST /api/leagues/{leagueId}/reports/pdf
```

Generates a PDF from HTML content.

**Request Body:**
```json
{
  "html": "<html>...</html>",
  "filename": "report.pdf",
  "format": "letter"
}
```

**Response:** Binary PDF file download

```
GET /api/leagues/{leagueId}/reports/pdf
```

Generates PDF from existing report endpoint.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | "weekly" or "postseason" |
| season | number | Yes | Season year |
| week | number | Conditional | Required for weekly |
| format | string | No | "letter" or "a4" |

### Get Draft Reports

```
GET /api/leagues/{leagueId}/reports/drafts
```

Returns saved draft reports.

---

## Commentary

### Generate Commentary

```
POST /api/leagues/{leagueId}/commentary
```

Generates AI-powered commentary using Claude.

**Request Body:**
```json
{
  "type": "weekly",
  "season": 2024,
  "week": 5,
  "voice": "supreme_leader",
  "template": "chronicle"
}
```

**Voice Options:**
- `supreme_leader` - Sarcastic, analytical commissioner persona
- `professional` - ESPN-style neutral analysis
- `casual` - Friendly group chat style
- `custom` - User-defined voice (requires `customVoice` field)

**Template Options:**
- `chronicle` - Commentary-heavy, long narratives
- `ledger` - Stats-heavy, minimal prose
- `standard` - Balanced approach

**Response:**
```json
{
  "success": true,
  "commentary": {
    "opener": "...",
    "matchupCommentaries": { "Team A vs Team B": "..." },
    "standingsAnalysis": "...",
    "topPerformerSpotlight": "...",
    "bottomPerformerRoast": "...",
    "playoffPicture": "...",
    "closer": "..."
  }
}
```

### Generate Section Commentary

```
POST /api/leagues/{leagueId}/commentary/section
```

Generates commentary for a specific section only.

---

## Sleeper API

### Lookup Sleeper User

```
GET /api/sleeper/user?username={username}
```

Looks up a Sleeper user by username.

### Test Sleeper Connection

```
GET /api/test-sleeper
```

Tests connectivity to Sleeper API.

---

## Error Responses

All endpoints may return error responses in this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| NOT_FOUND | 404 | Resource not found |
| BAD_REQUEST | 400 | Invalid request parameters |
| INTERNAL_ERROR | 500 | Server error |
| DATABASE_ERROR | 500 | Database operation failed |

---

## Rate Limiting

Currently no rate limiting is implemented. Future versions may include limits.

## Versioning

This API is currently unversioned. Breaking changes will be communicated in release notes.
