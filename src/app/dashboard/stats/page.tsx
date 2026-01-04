'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLeague } from '@/lib/context/LeagueContext'
import {
  NavigationTabs,
  ControlField,
  Select,
  Button,
  InfoBanner,
  LoadingIndicator,
  SectionHeader,
  Card,
  SummaryRow,
  SummaryStat,
  EmptyState,
} from '@/components/ui'
import {
  DataTable,
  RecordCell,
  PointsCell,
  WinLossCell,
  StreakCell,
} from '@/components/ui/DataTable'

type TabType = 'standings' | 'postseason' | 'matchups' | 'weekly' | 'managers' | 'h2h' | 'streaks'

const TABS: { key: TabType; label: string; deemphasized?: boolean }[] = [
  { key: 'standings', label: 'Standings' },
  { key: 'postseason', label: 'Postseason' },
  { key: 'matchups', label: 'Matchups' },
  { key: 'weekly', label: 'Weekly Scores' },
  { key: 'managers', label: 'Managers' },
  { key: 'h2h', label: 'H2H Records', deemphasized: true },
  { key: 'streaks', label: 'Streaks', deemphasized: true },
]

const WEEK_OPTIONS = [
  { value: '', label: 'All Weeks' },
  ...Array.from({ length: 17 }, (_, i) => ({
    value: String(i + 1),
    label: `Week ${i + 1}`,
  })),
]

export default function StatsPage() {
  const router = useRouter()
  const { currentLeague, loading: leagueLoading, error: leagueError } = useLeague()
  
  const [activeTab, setActiveTab] = useState<TabType>('standings')
  const [season, setSeason] = useState('')
  const [week, setWeek] = useState('')
  const [h2hManager, setH2hManager] = useState('')
  const [h2hMatchupType, setH2hMatchupType] = useState('all')
  const [managerList, setManagerList] = useState<{ id: string; name: string }[]>([])
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seasonOptions, setSeasonOptions] = useState<{ value: string; label: string }[]>([])

  // Build season options from league data
  useEffect(() => {
    if (currentLeague) {
      const options = [{ value: '', label: 'All Seasons' }]
      for (let year = currentLeague.current_season; year >= currentLeague.first_season; year--) {
        options.push({ value: String(year), label: String(year) })
      }
      setSeasonOptions(options)
      // Default to current season
      if (!season) {
        setSeason(String(currentLeague.current_season))
      }
    }
  }, [currentLeague])

  const fetchData = useCallback(async () => {
    if (!currentLeague) return
    
    setLoading(true)
    setError(null)

    try {
      let url = `/api/leagues/${currentLeague.id}/${activeTab}`
      const params = new URLSearchParams()

      if (activeTab === 'h2h') {
        if (h2hManager) params.append('managerId', h2hManager)
        if (h2hMatchupType !== 'all') params.append('type', h2hMatchupType)
      } else if (activeTab === 'postseason') {
        params.append('season', season || String(currentLeague.current_season))
      } else if (activeTab !== 'managers') {
        if (season) params.append('season', season)
      }

      if (week && (activeTab === 'weekly' || activeTab === 'matchups')) {
        params.append('week', week)
      }

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setData(result)
        if (result.managers) {
          setManagerList(result.managers)
        }
      } else {
        setError(result.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [currentLeague, activeTab, season, week, h2hManager, h2hMatchupType])

  useEffect(() => {
    if (currentLeague) {
      fetchData()
    }
  }, [fetchData, currentLeague])

  // Redirect to onboarding if no league
  useEffect(() => {
    if (!leagueLoading && !currentLeague && !leagueError) {
      router.push('/onboarding')
    }
  }, [leagueLoading, currentLeague, leagueError, router])

  const isAllSeasons = !season
  const showSeasonFilter = !['managers', 'h2h'].includes(activeTab)
  const showWeekFilter = ['weekly', 'matchups'].includes(activeTab)

  // Show loading while checking for league
  if (leagueLoading) {
    return (
      <div className="page-container">
        <LoadingIndicator message="Loading league data..." />
      </div>
    )
  }

  // Show error if league context failed
  if (leagueError) {
    return (
      <div className="page-container">
        <InfoBanner variant="error">{leagueError}</InfoBanner>
      </div>
    )
  }

  // No league selected
  if (!currentLeague) {
    return (
      <div className="page-container">
        <EmptyState 
          title="No League Connected" 
          description="Connect your Sleeper league to view stats."
        />
      </div>
    )
  }

  return (
    <div className="page-container">
      <NavigationTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as TabType)}
      />

      {/* Controls */}
      <div className="controls-group">
        {showSeasonFilter && (
          <ControlField label="Season">
            <Select
              value={season}
              onChange={setSeason}
              options={
                activeTab === 'postseason'
                  ? seasonOptions.filter((o) => o.value !== '')
                  : seasonOptions
              }
            />
          </ControlField>
        )}

        {showWeekFilter && (
          <ControlField label="Week">
            <Select value={week} onChange={setWeek} options={WEEK_OPTIONS} />
          </ControlField>
        )}

        {activeTab === 'h2h' && (
          <>
            <ControlField label="Manager">
              <Select
                value={h2hManager}
                onChange={setH2hManager}
                options={[
                  { value: '', label: 'All Managers' },
                  ...managerList.map((m) => ({ value: m.id, label: m.name })),
                ]}
              />
            </ControlField>
            <ControlField label="Matchup Type">
              <Select
                value={h2hMatchupType}
                onChange={setH2hMatchupType}
                options={[
                  { value: 'all', label: 'All Matchups' },
                  { value: 'regular', label: 'Regular Season' },
                  { value: 'playoff', label: 'Playoffs Only' },
                ]}
              />
            </ControlField>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button onClick={fetchData} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>

      {/* Context Banner */}
      {(activeTab === 'standings' || activeTab === 'streaks') && data && (
        <InfoBanner>
          Showing regular season only (Weeks 1-
          {(data as { regularSeasonWeeks?: number }).regularSeasonWeeks || 14}).
          Playoffs start Week{' '}
          {(data as { playoffWeekStart?: number }).playoffWeekStart || 15}.
        </InfoBanner>
      )}

      {/* Error State */}
      {error && <InfoBanner variant="error">{error}</InfoBanner>}

      {/* Loading State */}
      {loading && <LoadingIndicator />}

      {/* Content */}
      {data && !loading && (
        <div className="section-block">
          {activeTab === 'standings' && <StandingsContent data={data} isAllSeasons={isAllSeasons} />}
          {activeTab === 'postseason' && <PostseasonContent data={data} season={season} />}
          {activeTab === 'matchups' && <MatchupsContent data={data} />}
          {activeTab === 'weekly' && <WeeklyContent data={data} />}
          {activeTab === 'managers' && <ManagersContent data={data} />}
          {activeTab === 'h2h' && <H2HContent data={data} />}
          {activeTab === 'streaks' && <StreaksContent data={data} isAllSeasons={isAllSeasons} />}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STANDINGS TAB
   ═══════════════════════════════════════════════════════════════════════════ */

type StandingRow = {
  rank: number
  season?: number
  seasonRank?: number
  displayName: string
  record: {
    h2h: { wins: number; losses: number }
    median: { wins: number; losses: number }
    combined: { wins: number; losses: number }
    allPlay: { wins: number; losses: number; rank?: number }
  }
  points: { for: number; against: number; forRank: number; againstRank: number }
}

function StandingsContent({
  data,
  isAllSeasons,
}: {
  data: Record<string, unknown>
  isAllSeasons: boolean
}) {
  const standings = (data.standings as Array<Record<string, unknown>>) || []

  if (standings.length === 0) {
    return <EmptyState title="No standings data available" />
  }

  const typedStandings = standings as unknown as StandingRow[]

  return (
    <>
      <SectionHeader
        title="Standings"
        context={isAllSeasons ? 'All Seasons Combined' : 'Season Record'}
      />

      <DataTable
        columns={[
          {
            key: 'rank',
            header: '#',
            width: '50px',
            className: 'col-rank',
            sortable: true,
            render: (row: StandingRow) => row.rank,
          },
          ...(isAllSeasons
            ? [
                {
                  key: 'season',
                  header: 'Year',
                  width: '70px',
                  sortable: true,
                  render: (row: StandingRow) => row.season,
                },
              ]
            : []),
          {
            key: 'displayName',
            header: 'Manager',
            align: 'left' as const,
            className: 'col-manager',
            sortable: true,
          },
          {
            key: 'h2h',
            header: 'H2H',
            sortable: true,
            sortKey: 'record.h2h.wins',
            render: (row: StandingRow) => (
              <RecordCell wins={row.record.h2h.wins} losses={row.record.h2h.losses} />
            ),
          },
          {
            key: 'median',
            header: 'Median',
            sortable: true,
            sortKey: 'record.median.wins',
            render: (row: StandingRow) => (
              <RecordCell wins={row.record.median.wins} losses={row.record.median.losses} />
            ),
          },
          {
            key: 'combined',
            header: 'Combined',
            sortable: true,
            sortKey: 'record.combined.wins',
            render: (row: StandingRow) => (
              <span className="font-bold">
                {row.record.combined.wins}-{row.record.combined.losses}
              </span>
            ),
          },
          {
            key: 'allPlay',
            header: 'All-Play',
            sortable: true,
            sortKey: 'record.allPlay.wins',
            render: (row: StandingRow) => (
              <RecordCell
                wins={row.record.allPlay.wins}
                losses={row.record.allPlay.losses}
                rank={row.record.allPlay.rank}
              />
            ),
          },
          {
            key: 'pf',
            header: 'PF',
            sortable: true,
            sortKey: 'points.for',
            render: (row: StandingRow) => (
              <PointsCell value={row.points.for} rank={row.points.forRank} />
            ),
          },
          {
            key: 'pa',
            header: 'PA',
            sortable: true,
            sortKey: 'points.against',
            render: (row: StandingRow) => (
              <PointsCell value={row.points.against} rank={row.points.againstRank} />
            ),
          },
        ]}
        data={typedStandings}
        keyExtractor={(row, i) => `${row.season || ''}-${row.displayName}-${i}`}
        defaultSort={{ key: 'rank', direction: 'asc' }}
      />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   POSTSEASON TAB
   ═══════════════════════════════════════════════════════════════════════════ */

function PostseasonContent({
  data,
  season,
}: {
  data: Record<string, unknown>
  season: string
}) {
  const summary = data.summary as Record<string, unknown> | undefined
  const seedings = (data.seedings as Array<Record<string, unknown>>) || []

  return (
    <>
      <SectionHeader title="Postseason" context={`${season || '2025'} Season`} />

      {summary && (
        <SummaryRow>
          <SummaryStat
            label="Champion"
            value={
              summary.champion
                ? `#${summary.championSeed} ${summary.champion}`
                : 'TBD'
            }
            isChampion
          />
          <SummaryStat
            label="Runner-Up"
            value={
              summary.runnerUp
                ? `#${summary.runnerUpSeed} ${summary.runnerUp}`
                : 'TBD'
            }
          />
          <SummaryStat
            label="Third Place"
            value={
              summary.thirdPlace
                ? `#${summary.thirdPlaceSeed} ${summary.thirdPlace}`
                : 'TBD'
            }
          />
          <SummaryStat
            label="Last Place"
            value={
              summary.toiletBowlLoser
                ? `#${summary.toiletBowlLoserSeed} ${summary.toiletBowlLoser}`
                : 'TBD'
            }
          />
        </SummaryRow>
      )}

      {seedings.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginTop: 'var(--space-xl)' }}>
          <Card title="Playoff Bracket">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {seedings
                .filter((s) => s.bracket === 'playoff')
                .map((s) => (
                  <div
                    key={s.seed as number}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 'var(--space-sm)',
                      background: 'var(--surface-sunken)',
                    }}
                  >
                    <span>
                      <span className="text-muted text-xs">#{s.seed as number}</span>{' '}
                      <span className="font-semibold">{s.name as string}</span>
                      {Boolean(s.hasBye) && (
                        <span
                          className="text-xs text-gold uppercase ml-2"
                          style={{
                            background: 'rgba(139, 105, 20, 0.15)',
                            padding: '2px 6px',
                          }}
                        >
                          BYE
                        </span>
                      )}
                    </span>
                    <span className="text-muted text-sm">
                      {s.combinedWins as number}W • {s.pointsFor as number} PF
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          <Card title="Toilet Bowl">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {seedings
                .filter((s) => s.bracket === 'toilet_bowl')
                .map((s) => (
                  <div
                    key={s.seed as number}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: 'var(--space-sm)',
                      background: 'var(--surface-sunken)',
                    }}
                  >
                    <span>
                      <span className="text-muted text-xs">#{s.seed as number}</span>{' '}
                      <span className="font-semibold">{s.name as string}</span>
                    </span>
                    <span className="text-muted text-sm">
                      {s.combinedWins as number}W • {s.pointsFor as number} PF
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {data.playoff && (
        <BracketSection
          title="Playoff Bracket"
          rounds={(data.playoff as Record<string, unknown>).rounds as Record<string, unknown>}
          type="playoff"
        />
      )}

      {data.placeGames && (
        <BracketSection
          title="Place Games"
          rounds={(data.placeGames as Record<string, unknown>).rounds as Record<string, unknown>}
          type="place"
        />
      )}

      {data.toiletBowl && (
        <BracketSection
          title="Toilet Bowl"
          rounds={(data.toiletBowl as Record<string, unknown>).rounds as Record<string, unknown>}
          type="toilet"
        />
      )}
    </>
  )
}

function BracketSection({
  title,
  rounds,
  type,
}: {
  title: string
  rounds: Record<string, unknown>
  type: 'playoff' | 'place' | 'toilet'
}) {
  if (!rounds) return null
  
  const roundEntries = Object.entries(rounds).sort(([a], [b]) => parseInt(a) - parseInt(b))

  if (roundEntries.length === 0) return null

  return (
    <div style={{ marginTop: 'var(--space-2xl)' }}>
      <h3
        className="section-title"
        style={{
          textAlign: 'left',
          borderBottom: '2px solid var(--border-light)',
          paddingBottom: 'var(--space-sm)',
          marginBottom: 'var(--space-lg)',
          color:
            type === 'playoff'
              ? 'var(--accent-gold)'
              : type === 'toilet'
              ? 'var(--accent-secondary)'
              : 'var(--foreground)',
        }}
      >
        {title}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${roundEntries.length}, minmax(200px, 1fr))`,
          gap: 'var(--space-xl)',
        }}
      >
        {roundEntries.map(([weekKey, roundData]) => {
          const round = roundData as {
            name: string
            week: number
            matchups: Array<Record<string, unknown>>
            byes?: Array<{ seed: number; name: string }>
          }

          return (
            <div key={weekKey}>
              <div className="bracket-round-title">
                {round.name}
                <span className="text-muted text-xs ml-2">(Week {round.week})</span>
              </div>

              {round.byes?.map((bye) => (
                <div
                  key={bye.seed}
                  className="bracket-matchup"
                  style={{ background: 'rgba(139, 105, 20, 0.08)' }}
                >
                  <div className="bracket-team">
                    <span>
                      <span className="bracket-seed">#{bye.seed}</span>
                      {bye.name}
                    </span>
                    <span className="text-gold text-xs uppercase">BYE</span>
                  </div>
                </div>
              ))}

              {(round.matchups || []).map((m, i) => {
                const team1 = m.team1 as Record<string, unknown>
                const team2 = m.team2 as Record<string, unknown>
                const isChampionship =
                  type === 'playoff' && String(m.matchupType).includes('Championship')

                return (
                  <div
                    key={i}
                    className={`bracket-matchup ${isChampionship ? 'championship' : ''}`}
                  >
                    <div className="text-muted text-xs mb-2">{m.matchupType as string}</div>
                    <div className={`bracket-team ${team1.isWinner ? 'winner' : 'loser'}`}>
                      <span>
                        <span className="bracket-seed">#{team1.seed as number}</span>
                        {team1.name as string}
                      </span>
                      <span className="bracket-score">{team1.points as number}</span>
                    </div>
                    <div className={`bracket-team ${team2.isWinner ? 'winner' : 'loser'}`}>
                      <span>
                        <span className="bracket-seed">#{team2.seed as number}</span>
                        {team2.name as string}
                      </span>
                      <span className="bracket-score">{team2.points as number}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MATCHUPS TAB
   ═══════════════════════════════════════════════════════════════════════════ */

type MatchupRow = {
  season: number
  week: number
  team1: { name: string; points: number; managerId: string }
  team2: { name: string; points: number; managerId: string }
  winner: { managerId: string }
  pointDifferential: number
  isPlayoff: boolean
  isToiletBowl: boolean
  matchupType: string
}

function MatchupsContent({ data }: { data: Record<string, unknown> }) {
  const matchups = (data.matchups as Array<Record<string, unknown>>) || []
  const summary = data.summary as Record<string, unknown> | undefined

  if (matchups.length === 0) {
    return (
      <>
        <SectionHeader title="Matchups" context="No data" />
        <EmptyState title="No matchups found" description="Try adjusting your filters" />
      </>
    )
  }

  const typedMatchups = matchups as unknown as MatchupRow[]

  return (
    <>
      <SectionHeader title="Matchups" context={`${matchups.length} Games`} />

      {summary && (
        <SummaryRow>
          <SummaryStat label="Total" value={summary.totalMatchups as number} />
          <SummaryStat label="Avg Margin" value={summary.avgPointDiff as number} />
          <SummaryStat label="Close Games (<10)" value={summary.closeGames as number} />
          <SummaryStat label="Blowouts (>40)" value={summary.blowouts as number} />
        </SummaryRow>
      )}

      <DataTable
        columns={[
          { key: 'season', header: 'Year', width: '60px', sortable: true },
          { key: 'week', header: 'Wk', width: '50px', sortable: true },
          {
            key: 'team1',
            header: 'Team 1',
            align: 'left' as const,
            sortable: true,
            sortKey: 'team1.name',
            render: (row: MatchupRow) => (
              <span
                className={
                  row.winner.managerId === row.team1.managerId
                    ? 'text-win font-semibold'
                    : ''
                }
              >
                {row.team1.name}
              </span>
            ),
          },
          {
            key: 'score1',
            header: 'Score',
            sortable: true,
            sortKey: 'team1.points',
            render: (row: MatchupRow) => row.team1.points.toFixed(2),
          },
          {
            key: 'team2',
            header: 'Team 2',
            align: 'left' as const,
            sortable: true,
            sortKey: 'team2.name',
            render: (row: MatchupRow) => (
              <span
                className={
                  row.winner.managerId === row.team2.managerId
                    ? 'text-win font-semibold'
                    : ''
                }
              >
                {row.team2.name}
              </span>
            ),
          },
          {
            key: 'score2',
            header: 'Score',
            sortable: true,
            sortKey: 'team2.points',
            render: (row: MatchupRow) => row.team2.points.toFixed(2),
          },
          {
            key: 'margin',
            header: 'Margin',
            sortable: true,
            sortKey: 'pointDifferential',
            render: (row: MatchupRow) => row.pointDifferential.toFixed(2),
          },
          {
            key: 'type',
            header: 'Type',
            render: (row: MatchupRow) =>
              row.isPlayoff ? (
                <span className={row.isToiletBowl ? 'text-loss' : 'text-gold'}>
                  {row.matchupType}
                </span>
              ) : (
                <span className="text-muted">Regular</span>
              ),
          },
        ]}
        data={typedMatchups}
        keyExtractor={(row, i) => `${row.season}-${row.week}-${i}`}
        defaultSort={{ key: 'week', direction: 'desc' }}
      />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   WEEKLY SCORES TAB
   ═══════════════════════════════════════════════════════════════════════════ */

type WeeklyRow = {
  season: number
  week: number
  managerName: string
  points: { for: number }
  opponentName: string
  results: {
    weeklyRank: number
    h2hWin: boolean
    medianWin: boolean
    allPlayWins: number
    allPlayLosses: number
  }
}

function WeeklyContent({ data }: { data: Record<string, unknown> }) {
  const scores = (data.scores as Array<Record<string, unknown>>) || []
  const summary = data.summary as Record<string, unknown> | undefined

  if (scores.length === 0) {
    return (
      <>
        <SectionHeader title="Weekly Scores" context="No data" />
        <EmptyState title="No scores found" description="Try adjusting your filters" />
      </>
    )
  }

  const typedScores = scores as unknown as WeeklyRow[]

  return (
    <>
      <SectionHeader title="Weekly Scores" context={`${scores.length} Records`} />

      {summary && (
        <SummaryRow>
          <SummaryStat label="Median" value={summary.median as number} />
          <SummaryStat
            label="High Score"
            value={`${summary.highest} (${summary.topScorer})`}
          />
          <SummaryStat
            label="Low Score"
            value={`${summary.lowest} (${summary.bottomScorer})`}
          />
        </SummaryRow>
      )}

      <DataTable
        columns={[
          { key: 'season', header: 'Year', width: '60px', sortable: true },
          { key: 'week', header: 'Wk', width: '50px', sortable: true },
          {
            key: 'managerName',
            header: 'Manager',
            align: 'left' as const,
            className: 'col-manager',
            sortable: true,
          },
          {
            key: 'points',
            header: 'Points',
            sortable: true,
            sortKey: 'points.for',
            render: (row: WeeklyRow) => row.points.for.toFixed(2),
          },
          {
            key: 'rank',
            header: 'Rank',
            sortable: true,
            sortKey: 'results.weeklyRank',
            render: (row: WeeklyRow) => row.results.weeklyRank,
          },
          {
            key: 'opponent',
            header: 'vs',
            align: 'left' as const,
            sortable: true,
            sortKey: 'opponentName',
            render: (row: WeeklyRow) => (
              <span className="text-muted">{row.opponentName || '—'}</span>
            ),
          },
          {
            key: 'h2h',
            header: 'H2H',
            render: (row: WeeklyRow) => <WinLossCell isWin={row.results.h2hWin} />,
          },
          {
            key: 'median',
            header: 'Med',
            render: (row: WeeklyRow) => <WinLossCell isWin={row.results.medianWin} />,
          },
          {
            key: 'allPlay',
            header: 'All-Play',
            sortable: true,
            sortKey: 'results.allPlayWins',
            render: (row: WeeklyRow) =>
              `${row.results.allPlayWins}-${row.results.allPlayLosses}`,
          },
        ]}
        data={typedScores}
        keyExtractor={(row, i) => `${row.season}-${row.week}-${row.managerName}-${i}`}
        defaultSort={{ key: 'points.for', direction: 'desc' }}
      />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANAGERS TAB (Career Stats)
   ═══════════════════════════════════════════════════════════════════════════ */

type ManagerRow = {
  rank: number
  displayName: string
  career: {
    combined: { wins: number; losses: number; winPct: number; rank: number }
    h2h: { wins: number; losses: number; winPct: number; rank: number }
    median: { wins: number; losses: number; winPct: number; rank: number }
    allPlay: { wins: number; losses: number; winPct: number; rank: number }
    points: {
      totalPF: number
      totalPA: number
      avgPerWeek: number
      pfRank: number
      paRank: number
    }
    totalWeeks: number
  }
}

function ManagersContent({ data }: { data: Record<string, unknown> }) {
  const managers = (data.managers as Array<Record<string, unknown>>) || []

  if (managers.length === 0) {
    return (
      <>
        <SectionHeader title="Managers" context="Career Statistics" />
        <EmptyState title="No manager data available" />
      </>
    )
  }

  const typedManagers = managers as unknown as ManagerRow[]

  return (
    <>
      <SectionHeader title="Managers" context="Career Statistics" />

      <DataTable
        columns={[
          {
            key: 'rank',
            header: '#',
            width: '50px',
            className: 'col-rank',
            sortable: true,
            render: (row: ManagerRow) => row.rank,
          },
          {
            key: 'displayName',
            header: 'Manager',
            align: 'left' as const,
            className: 'col-manager',
            sortable: true,
          },
          {
            key: 'combined',
            header: 'Combined',
            sortable: true,
            sortKey: 'career.combined.winPct',
            render: (row: ManagerRow) => (
              <RecordCell
                wins={row.career.combined.wins}
                losses={row.career.combined.losses}
                winPct={row.career.combined.winPct}
                rank={row.career.combined.rank}
              />
            ),
          },
          {
            key: 'h2h',
            header: 'H2H',
            sortable: true,
            sortKey: 'career.h2h.winPct',
            render: (row: ManagerRow) => (
              <RecordCell
                wins={row.career.h2h.wins}
                losses={row.career.h2h.losses}
                winPct={row.career.h2h.winPct}
              />
            ),
          },
          {
            key: 'median',
            header: 'Median',
            sortable: true,
            sortKey: 'career.median.winPct',
            render: (row: ManagerRow) => (
              <RecordCell
                wins={row.career.median.wins}
                losses={row.career.median.losses}
                winPct={row.career.median.winPct}
              />
            ),
          },
          {
            key: 'allPlay',
            header: 'All-Play',
            sortable: true,
            sortKey: 'career.allPlay.winPct',
            render: (row: ManagerRow) => (
              <RecordCell
                wins={row.career.allPlay.wins}
                losses={row.career.allPlay.losses}
                winPct={row.career.allPlay.winPct}
              />
            ),
          },
          {
            key: 'pf',
            header: 'Total PF',
            sortable: true,
            sortKey: 'career.points.totalPF',
            render: (row: ManagerRow) => (
              <PointsCell value={row.career.points.totalPF} rank={row.career.points.pfRank} />
            ),
          },
          {
            key: 'avgPf',
            header: 'Avg/Wk',
            sortable: true,
            sortKey: 'career.points.avgPerWeek',
            render: (row: ManagerRow) => row.career.points.avgPerWeek.toFixed(2),
          },
          {
            key: 'weeks',
            header: 'Weeks',
            sortable: true,
            sortKey: 'career.totalWeeks',
            render: (row: ManagerRow) => row.career.totalWeeks,
          },
        ]}
        data={typedManagers}
        keyExtractor={(row) => row.displayName}
        defaultSort={{ key: 'rank', direction: 'asc' }}
      />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   H2H RECORDS TAB
   ═══════════════════════════════════════════════════════════════════════════ */

type H2HRow = {
  manager1: { name: string }
  manager2: { name: string }
  wins: number
  losses: number
  winPct: number
  pointsFor: number
  pointsAgainst: number
  avgMargin: number
}

function H2HContent({ data }: { data: Record<string, unknown> }) {
  const records = (data.records as Array<Record<string, unknown>>) || []

  if (records.length === 0) {
    return (
      <>
        <SectionHeader title="Head-to-Head Records" context="All-Time" />
        <EmptyState title="No head-to-head data available" />
      </>
    )
  }

  const typedRecords = records as unknown as H2HRow[]

  return (
    <>
      <SectionHeader title="Head-to-Head Records" context="All-Time" />

      <DataTable
        columns={[
          {
            key: 'manager1',
            header: 'Manager',
            align: 'left' as const,
            className: 'col-manager',
            sortable: true,
            sortKey: 'manager1.name',
            render: (row: H2HRow) => row.manager1.name,
          },
          {
            key: 'manager2',
            header: 'vs',
            align: 'left' as const,
            sortable: true,
            sortKey: 'manager2.name',
            render: (row: H2HRow) => row.manager2.name,
          },
          {
            key: 'wins',
            header: 'Record',
            sortable: true,
            render: (row: H2HRow) => `${row.wins}-${row.losses}`,
          },
          {
            key: 'winPct',
            header: 'Win %',
            sortable: true,
            render: (row: H2HRow) => (
              <span className={row.winPct >= 50 ? 'text-win font-semibold' : 'text-loss'}>
                {row.winPct}%
              </span>
            ),
          },
          {
            key: 'pointsFor',
            header: 'PF',
            sortable: true,
            render: (row: H2HRow) => row.pointsFor.toFixed(2),
          },
          {
            key: 'pointsAgainst',
            header: 'PA',
            sortable: true,
            render: (row: H2HRow) => row.pointsAgainst.toFixed(2),
          },
          {
            key: 'avgMargin',
            header: 'Avg Margin',
            sortable: true,
            render: (row: H2HRow) => (
              <span className={row.avgMargin > 0 ? 'text-win' : 'text-loss'}>
                {row.avgMargin > 0 ? '+' : ''}
                {row.avgMargin.toFixed(2)}
              </span>
            ),
          },
        ]}
        data={typedRecords}
        keyExtractor={(row, i) => `${row.manager1.name}-${row.manager2.name}-${i}`}
        defaultSort={{ key: 'winPct', direction: 'desc' }}
      />
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STREAKS TAB
   ═══════════════════════════════════════════════════════════════════════════ */

type StreakRow = {
  name: string
  currentStreaks: {
    h2h: { type: 'W' | 'L' | null; display: string }
    median: { type: 'W' | 'L' | null; display: string }
    combined: { type: 'W' | 'L' | null; display: string }
  }
  longestStreaks: {
    h2h: {
      win: { length: number; season?: number }
      loss: { length: number; season?: number }
    }
    median: {
      win: { length: number; season?: number }
      loss: { length: number; season?: number }
    }
    combined: {
      win: { length: number; season?: number }
      loss: { length: number; season?: number }
    }
  }
}

function StreaksContent({
  data,
  isAllSeasons,
}: {
  data: Record<string, unknown>
  isAllSeasons: boolean
}) {
  const streaks = (data.streaks as Array<Record<string, unknown>>) || []
  const leagueRecords = data.leagueRecords as Record<string, Record<string, unknown>> | undefined

  if (streaks.length === 0) {
    return (
      <>
        <SectionHeader
          title="Streaks"
          context={isAllSeasons ? 'All-Time Records' : 'Season Records'}
        />
        <EmptyState title="No streak data available" />
      </>
    )
  }

  const typedStreaks = streaks as unknown as StreakRow[]

  return (
    <>
      <SectionHeader
        title="Streaks"
        context={isAllSeasons ? 'All-Time Records' : 'Season Records'}
      />

      {leagueRecords && (
        <Card title="League Records" className="mb-6">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
            <div>
              <h4 className="text-win font-semibold text-sm uppercase tracking-wide mb-2">
                Longest Win Streaks
              </h4>
              {['h2hWin', 'medianWin', 'combinedWin'].map((key) => {
                const record = leagueRecords[key]
                if (!record) return null
                const label =
                  key === 'h2hWin' ? 'H2H' : key === 'medianWin' ? 'Median' : 'Combined'
                return (
                  <div key={key} className="flex justify-between text-sm mb-1">
                    <span className="text-muted">{label}:</span>
                    <span>
                      <span className="text-win font-bold">{record.length as number}W</span>
                      <span className="text-muted ml-2">
                        {record.manager as string}
                        {isAllSeasons && ` (${record.season})`} Wk {record.startWeek as number}-
                        {record.endWeek as number}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
            <div>
              <h4 className="text-loss font-semibold text-sm uppercase tracking-wide mb-2">
                Longest Loss Streaks
              </h4>
              {['h2hLoss', 'medianLoss', 'combinedLoss'].map((key) => {
                const record = leagueRecords[key]
                if (!record) return null
                const label =
                  key === 'h2hLoss' ? 'H2H' : key === 'medianLoss' ? 'Median' : 'Combined'
                return (
                  <div key={key} className="flex justify-between text-sm mb-1">
                    <span className="text-muted">{label}:</span>
                    <span>
                      <span className="text-loss font-bold">{record.length as number}L</span>
                      <span className="text-muted ml-2">
                        {record.manager as string}
                        {isAllSeasons && ` (${record.season})`} Wk {record.startWeek as number}-
                        {record.endWeek as number}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Manager',
            align: 'left' as const,
            className: 'col-manager',
            sortable: true,
          },
          ...(!isAllSeasons
            ? [
                {
                  key: 'currH2H',
                  header: 'H2H Streak',
                  render: (row: StreakRow) => (
                    <StreakCell
                      type={row.currentStreaks.h2h.type}
                      length={parseInt(row.currentStreaks.h2h.display) || 0}
                    />
                  ),
                },
                {
                  key: 'currMedian',
                  header: 'Med Streak',
                  render: (row: StreakRow) => (
                    <StreakCell
                      type={row.currentStreaks.median.type}
                      length={parseInt(row.currentStreaks.median.display) || 0}
                    />
                  ),
                },
                {
                  key: 'currCombined',
                  header: 'Comb Streak',
                  render: (row: StreakRow) => (
                    <StreakCell
                      type={row.currentStreaks.combined.type}
                      length={parseInt(row.currentStreaks.combined.display) || 0}
                    />
                  ),
                },
              ]
            : []),
          {
            key: 'bestH2H',
            header: 'Best H2H',
            sortable: true,
            sortKey: 'longestStreaks.h2h.win.length',
            render: (row: StreakRow) => (
              <span>
                <span className="text-win">{row.longestStreaks.h2h.win.length}W</span>
                {isAllSeasons && row.longestStreaks.h2h.win.length > 0 && (
                  <span className="text-muted text-xs ml-1">
                    ({row.longestStreaks.h2h.win.season})
                  </span>
                )}
                {' / '}
                <span className="text-loss">{row.longestStreaks.h2h.loss.length}L</span>
                {isAllSeasons && row.longestStreaks.h2h.loss.length > 0 && (
                  <span className="text-muted text-xs ml-1">
                    ({row.longestStreaks.h2h.loss.season})
                  </span>
                )}
              </span>
            ),
          },
          {
            key: 'bestMedian',
            header: 'Best Median',
            sortable: true,
            sortKey: 'longestStreaks.median.win.length',
            render: (row: StreakRow) => (
              <span>
                <span className="text-win">{row.longestStreaks.median.win.length}W</span>
                {isAllSeasons && row.longestStreaks.median.win.length > 0 && (
                  <span className="text-muted text-xs ml-1">
                    ({row.longestStreaks.median.win.season})
                  </span>
                )}
                {' / '}
                <span className="text-loss">{row.longestStreaks.median.loss.length}L</span>
                {isAllSeasons && row.longestStreaks.median.loss.length > 0 && (
                  <span className="text-muted text-xs ml-1">
                    ({row.longestStreaks.median.loss.season})
                  </span>
                )}
              </span>
            ),
          },
          {
            key: 'bestCombined',
            header: 'Best Combined',
            sortable: true,
            sortKey: 'longestStreaks.combined.win.length',
            render: (row: StreakRow) => (
              <span>
                <span className="text-win">{row.longestStreaks.combined.win.length}W</span>
                {isAllSeasons && row.longestStreaks.combined.win.length > 0 && (
                  <span className="text-muted text-xs ml-1">
                    ({row.longestStreaks.combined.win.season})
                  </span>
                )}
                {' / '}
                <span className="text-loss">{row.longestStreaks.combined.loss.length}L</span>
                {isAllSeasons && row.longestStreaks.combined.loss.length > 0 && (
                  <span className="text-muted text-xs ml-1">
                    ({row.longestStreaks.combined.loss.season})
                  </span>
                )}
              </span>
            ),
          },
        ]}
        data={typedStreaks}
        keyExtractor={(row) => row.name}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />
    </>
  )
}
