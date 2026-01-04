'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface League {
  id: string
  name: string
  sleeper_league_id: string
  team_count: number
  first_season: number
  current_season: number
  last_sync_at: string
}

interface LeagueContextType {
  leagues: League[]
  currentLeague: League | null
  setCurrentLeague: (league: League) => void
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const LeagueContext = createContext<LeagueContextType | undefined>(undefined)

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>([])
  const [currentLeague, setCurrentLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeagues = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/leagues')
      const data = await response.json()
      
      if (data.success && data.leagues.length > 0) {
        setLeagues(data.leagues)
        // Set first league as current if none selected
        if (!currentLeague) {
          setCurrentLeague(data.leagues[0])
        }
      } else if (data.leagues?.length === 0) {
        setLeagues([])
        setCurrentLeague(null)
      } else {
        setError(data.error || 'Failed to fetch leagues')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeagues()
  }, [])

  return (
    <LeagueContext.Provider 
      value={{ 
        leagues, 
        currentLeague, 
        setCurrentLeague, 
        loading, 
        error,
        refetch: fetchLeagues 
      }}
    >
      {children}
    </LeagueContext.Provider>
  )
}

export function useLeague() {
  const context = useContext(LeagueContext)
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider')
  }
  return context
}
