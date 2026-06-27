import React, { useEffect, useMemo, useState } from 'react'

const NAV = ['Dashboard', 'Matches', 'Analysis', 'Recommendations', 'Automation']
const API = '/'

function StatCard({ label, value, tone = 'default', subtext }) {
  return (
    <section className={`card stat-card ${tone !== 'default' ? `tone-${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {subtext ? <div className="stat-subtext">{subtext}</div> : null}
    </section>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (!mins) return `${secs}s`
  return `${mins}m ${secs}s`
}

function inferMatchResult(match) {
  const raw = `${match.result_head || ''} ${match.result_label || ''}`.toLowerCase()
  if (raw.includes('victory') || raw.includes('win')) return 'Win'
  if (raw.includes('defeat') || raw.includes('loss')) return 'Loss'
  if (match.result_head === 'win') return 'Win'
  if (match.result_head === 'loss') return 'Loss'
  return match.result_head || 'Unknown'
}

function getWinRate(matches) {
  if (!matches.length) return 0
  const wins = matches.filter(m => inferMatchResult(m) === 'Win').length
  return Math.round((wins / matches.length) * 100)
}

function groupBy(matches, getKey) {
  const map = new Map()
  matches.forEach(match => {
    const key = getKey(match) || 'Unknown'
    const entry = map.get(key) || { key, total: 0, wins: 0 }
    entry.total += 1
    if (inferMatchResult(match) === 'Win') entry.wins += 1
    map.set(key, entry)
  })
  return [...map.values()]
    .map(entry => ({ ...entry, rate: entry.total ? Math.round((entry.wins / entry.total) * 100) : 0 }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total)
}

function DashboardPanel({ matches, analysis, recentEvents, refresh }) {
  const totalMatches = matches.length
  const winRate = getWinRate(matches)
  const avgDuration = matches.length
    ? Math.round(matches.reduce((sum, m) => sum + (m.duration_seconds || 0), 0) / matches.length)
    : 0
  const latestMatch = matches[0]

  return (
    <div className="panel-stack">
      <div className="hero-card card">
        <div>
          <div className="eyebrow">Live sync from FastAPI + userscript</div>
          <h2>PaperWar match intelligence</h2>
          <p className="muted">
            This dashboard reads directly from your backend so you can review captured matches,
            inspect analysis endpoints, and verify that live userscript events are flowing into the API.
          </p>
        </div>
        <button className="action-btn" onClick={refresh}>Refresh data</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Total matches" value={totalMatches} subtext="Last 100 from /matches" />
        <StatCard label="Win rate" value={`${winRate}%`} tone={winRate >= 50 ? 'good' : 'bad'} subtext="Derived from recorded results" />
        <StatCard label="Average duration" value={avgDuration ? formatDuration(avgDuration) : '—'} subtext="Based on duration_seconds" />
        <StatCard
          label="Latest result"
          value={latestMatch ? inferMatchResult(latestMatch) : '—'}
          tone={latestMatch && inferMatchResult(latestMatch) === 'Win' ? 'good' : 'default'}
          subtext={latestMatch ? (latestMatch.map_name || 'Unknown map') : 'No matches yet'}
        />
      </div>

      <div className="two-col-grid">
        <section className="card">
          <div className="section-head">
            <h3>Recent matches</h3>
            <span>{matches.length} loaded</span>
          </div>
          {!matches.length ? (
            <EmptyState title="No recorded matches" text="Start a game with the userscript running or add one manually from the Matches tab." />
          ) : (
            <div className="list-stack compact-list">
              {matches.slice(0, 6).map(match => (
                <article className="list-item" key={match.id}>
                  <div>
                    <div className="list-title">{match.map_name || 'Unknown map'}</div>
                    <div className="list-meta">
                      {inferMatchResult(match)} · {formatDuration(match.duration_seconds)} · {match.enemy_style || 'Unknown enemy style'}
                    </div>
                  </div>
                  <div className={`badge ${inferMatchResult(match) === 'Win' ? 'good' : 'bad'}`}>{inferMatchResult(match)}</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h3>Live event stream</h3>
            <span>/events + /matches/end</span>
          </div>
          {!recentEvents.length ? (
            <EmptyState title="No events yet" text="Events appear here after the userscript starts posting build, transport, snapshot, and tech events." />
          ) : (
            <div className="list-stack compact-list mono-list">
              {recentEvents.slice(0, 8).map((event, idx) => (
                <article className="list-item" key={`${event.id || idx}-${event.type || 'event'}`}>
                  <div>
                    <div className="list-title mono">{event.type || 'event'}</div>
                    <div className="list-meta">t={event.t ?? '—'}s · {event.match_id || 'unknown match'}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="two-col-grid">
        <section className="card">
          <div className="section-head">
            <h3>Matchup summary</h3>
            <span>/analysis/matchup-summary</span>
          </div>
          {!analysis.matchupSummary.length ? (
            <EmptyState title="No matchup summary" text="Enemy-style aggregation appears here once enough matches are recorded." />
          ) : (
            <div className="list-stack">
              {analysis.matchupSummary.map(row => (
                <article className="list-item" key={row.enemy_style || 'unknown'}>
                  <div>
                    <div className="list-title">{row.enemy_style || 'Unknown'}</div>
                    <div className="list-meta">{row.wins}/{row.total} wins</div>
                  </div>
                  <div className="metric-pill">{row.total ? Math.round((row.wins / row.total) * 100) : 0}%</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h3>Transport timing</h3>
            <span>/analysis/transport-timing</span>
          </div>
          {!analysis.transportWindows.length ? (
            <EmptyState title="No winning transport launches" text="This fills when winning matches contain transport_launched events from the userscript." />
          ) : (
            <div className="list-stack compact-list mono-list">
              {analysis.transportWindows.slice(0, 8).map((row, idx) => (
                <article className="list-item" key={`${row.match_id}-${row.t}-${idx}`}>
                  <div>
                    <div className="list-title mono">match {row.match_id}</div>
                    <div className="list-meta">transport launch at {row.t}s</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MatchesPanel({ matches, onCreateMatch, creating }) {
  const [form, setForm] = useState({
    map_name: '',
    result: 'win',
    duration_seconds: 600,
    enemy_style: '',
    notes: '',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onCreateMatch(form)
    setForm({ map_name: '', result: 'win', duration_seconds: 600, enemy_style: '', notes: '' })
  }

  return (
    <div className="panel-stack two-col-grid wide-left">
      <section className="card">
        <div className="section-head">
          <h3>Manual match entry</h3>
          <span>POST /matches/</span>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            <span>Map name</span>
            <input value={form.map_name} onChange={e => setForm({ ...form, map_name: e.target.value })} placeholder="Island Crossing" />
          </label>
          <label>
            <span>Result</span>
            <select value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="draw">Draw</option>
            </select>
          </label>
          <label>
            <span>Duration (seconds)</span>
            <input type="number" min="1" value={form.duration_seconds} onChange={e => setForm({ ...form, duration_seconds: Number(e.target.value) })} />
          </label>
          <label>
            <span>Enemy style</span>
            <input value={form.enemy_style} onChange={e => setForm({ ...form, enemy_style: e.target.value })} placeholder="Aggro, Naval, Turtle..." />
          </label>
          <label className="full-span">
            <span>Notes</span>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="What happened in this game?" rows={5} />
          </label>
          <button className="action-btn" type="submit" disabled={creating}>{creating ? 'Saving…' : 'Create match'}</button>
        </form>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Recorded matches</h3>
          <span>GET /matches/</span>
        </div>
        {!matches.length ? (
          <EmptyState title="No matches stored" text="Use the userscript or the form on the left to populate the backend." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Map</th>
                  <th>Result</th>
                  <th>Duration</th>
                  <th>Enemy</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(match => (
                  <tr key={match.id}>
                    <td className="mono truncate-cell">{match.id}</td>
                    <td>{match.map_name || '—'}</td>
                    <td><span className={`badge ${inferMatchResult(match) === 'Win' ? 'good' : inferMatchResult(match) === 'Loss' ? 'bad' : ''}`}>{inferMatchResult(match)}</span></td>
                    <td>{formatDuration(match.duration_seconds)}</td>
                    <td>{match.enemy_style || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function AnalysisPanel({ analysis }) {
  return (
    <div className="panel-stack two-col-grid">
      <section className="card">
        <div className="section-head">
          <h3>Win rates by result head</h3>
          <span>GET /analysis/win-rates</span>
        </div>
        {!analysis.winRates.length ? (
          <EmptyState title="No win-rate data" text="This endpoint groups matches by result_head, so it improves as captured matches include real result screen labels." />
        ) : (
          <div className="list-stack">
            {analysis.winRates.map(row => (
              <article className="list-item" key={row.result_head || 'unknown'}>
                <div>
                  <div className="list-title">{row.result_head || 'Unknown'}</div>
                  <div className="list-meta">{row.wins}/{row.total} wins</div>
                </div>
                <div className="metric-pill">{row.total ? Math.round((row.wins / row.total) * 100) : 0}%</div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Winning transport windows</h3>
          <span>GET /analysis/transport-timing</span>
        </div>
        {!analysis.transportWindows.length ? (
          <EmptyState title="No transport windows yet" text="Once the userscript records transport_launched events in winning matches, they will be listed here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Time</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {analysis.transportWindows.map((row, idx) => {
                  let parsed = null
                  try { parsed = row.data ? JSON.parse(row.data) : null } catch { parsed = null }
                  return (
                    <tr key={`${row.match_id}-${idx}`}>
                      <td className="mono truncate-cell">{row.match_id}</td>
                      <td>{row.t}s</td>
                      <td>{parsed?.entity || parsed?.name || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card full-width-card">
        <div className="section-head">
          <h3>Enemy style matchup summary</h3>
          <span>GET /analysis/matchup-summary</span>
        </div>
        {!analysis.matchupSummary.length ? (
          <EmptyState title="No matchup summary yet" text="Add manual enemy_style values or let captured matches be enriched later to make this panel more useful." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Enemy style</th>
                  <th>Total</th>
                  <th>Wins</th>
                  <th>Win rate</th>
                </tr>
              </thead>
              <tbody>
                {analysis.matchupSummary.map(row => (
                  <tr key={row.enemy_style || 'unknown'}>
                    <td>{row.enemy_style || 'Unknown'}</td>
                    <td>{row.total}</td>
                    <td>{row.wins}</td>
                    <td>{row.total ? Math.round((row.wins / row.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function RecommendationsPanel({ recommendation, loading, refresh }) {
  const sampleState = {
    elapsed_seconds: 360,
    current_tech: ['Lt. Infantry', 'AKM', 'Scout'],
    current_units: { scout: 2, akm: 4, sniper: 1 },
    ink: 62,
    map_name: 'Island Crossing',
  }

  return (
    <div className="panel-stack">
      <section className="card">
        <div className="section-head">
          <h3>Live recommendation probe</h3>
          <span>POST /recommendations/live</span>
        </div>
        <p className="muted">
          The backend currently returns a placeholder recommendation. This panel verifies the endpoint,
          shows the JSON response, and gives you a place to extend the live decision engine next.
        </p>
        <div className="action-row">
          <button className="action-btn" onClick={() => refresh(sampleState)} disabled={loading}>
            {loading ? 'Requesting…' : 'Request recommendation'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Current response</h3>
          <span>Backend output</span>
        </div>
        {!recommendation ? (
          <EmptyState title="No recommendation fetched" text="Click the button above to call the live recommendation endpoint with a sample game state." />
        ) : (
          <pre className="json-block">{JSON.stringify(recommendation, null, 2)}</pre>
        )}
      </section>
    </div>
  )
}

function AutomationPanel() {
  return (
    <div className="panel-stack">
      <section className="card">
        <div className="section-head">
          <h3>Automation boundary</h3>
          <span>Manual-gated only</span>
        </div>
        <p className="muted">
          Keep automation behind explicit user actions. The userscript should capture state continuously,
          while any build-order helper or transport macro should remain off by default and require a deliberate trigger.
        </p>
        <div className="callout-grid">
          <div className="callout good">
            <h4>Good next step</h4>
            <p>Expose a backend endpoint for candidate macro plans, then bind a user-confirmed button in this tab.</p>
          </div>
          <div className="callout bad">
            <h4>Not ready yet</h4>
            <p>Continuous autonomous play logic. Your backend and frontend are currently structured for analysis first, automation second.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const [health, setHealth] = useState(null)
  const [matches, setMatches] = useState([])
  const [analysis, setAnalysis] = useState({
    winRates: [],
    transportWindows: [],
    matchupSummary: [],
  })
  const [recentEvents, setRecentEvents] = useState([])
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState({ data: false, recommendation: false, creating: false })
  const [error, setError] = useState('')

  const fetchJSON = async (path, options) => {
    const res = await fetch(`${API}${path}`, options)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Request failed: ${res.status}`)
    }
    return res.json()
  }

  const refreshData = async () => {
    setLoading(prev => ({ ...prev, data: true }))
    setError('')
    try {
      const [healthRes, matchesRes, winRatesRes, transportRes, matchupRes] = await Promise.all([
        fetchJSON('health'),
        fetchJSON('matches/'),
        fetchJSON('analysis/win-rates'),
        fetchJSON('analysis/transport-timing'),
        fetchJSON('analysis/matchup-summary'),
      ])

      setHealth(healthRes.status)
      const loadedMatches = matchesRes.matches || []
      setMatches(loadedMatches)
      setAnalysis({
        winRates: winRatesRes.win_rates || [],
        transportWindows: transportRes.transport_windows || [],
        matchupSummary: matchupRes.matchup_summary || [],
      })

      const matchWithEvents = loadedMatches.find(Boolean)
      if (matchWithEvents?.id) {
        try {
          const eventsRes = await fetchJSON(`events/${matchWithEvents.id}`)
          setRecentEvents(eventsRes.events || [])
        } catch {
          setRecentEvents([])
        }
      } else {
        setRecentEvents([])
      }
    } catch (err) {
      setHealth('offline')
      setError(err.message || 'Failed to load backend data.')
    } finally {
      setLoading(prev => ({ ...prev, data: false }))
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  const createMatch = async (payload) => {
    setLoading(prev => ({ ...prev, creating: true }))
    setError('')
    try {
      await fetchJSON('matches/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await refreshData()
      setTab('Matches')
    } catch (err) {
      setError(err.message || 'Failed to create match.')
    } finally {
      setLoading(prev => ({ ...prev, creating: false }))
    }
  }

  const requestRecommendation = async (state) => {
    setLoading(prev => ({ ...prev, recommendation: true }))
    setError('')
    try {
      const data = await fetchJSON('recommendations/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      setRecommendation(data)
    } catch (err) {
      setError(err.message || 'Failed to get recommendation.')
    } finally {
      setLoading(prev => ({ ...prev, recommendation: false }))
    }
  }

  const activePanel = useMemo(() => {
    switch (tab) {
      case 'Dashboard':
        return <DashboardPanel matches={matches} analysis={analysis} recentEvents={recentEvents} refresh={refreshData} />
      case 'Matches':
        return <MatchesPanel matches={matches} onCreateMatch={createMatch} creating={loading.creating} />
      case 'Analysis':
        return <AnalysisPanel analysis={analysis} />
      case 'Recommendations':
        return <RecommendationsPanel recommendation={recommendation} loading={loading.recommendation} refresh={requestRecommendation} />
      case 'Automation':
        return <AutomationPanel />
      default:
        return null
    }
  }, [tab, matches, analysis, recentEvents, recommendation, loading])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark">◆</span>
          <span className="logo-text">PaperWar<br /><small>Strategy Lab</small></span>
        </div>
        <nav>
          {NAV.map(n => (
            <button
              key={n}
              className={`nav-btn${tab === n ? ' active' : ''}`}
              onClick={() => setTab(n)}
            >
              {n}
            </button>
          ))}
        </nav>
        <div className="status-pill">
          <span className={`dot ${health === 'ok' ? 'green' : 'red'}`} />
          API {health ?? '…'}
        </div>
      </aside>

      <main className="content content-wide">
        <header className="page-header">
          <div>
            <h1>{tab}</h1>
            <p className="muted page-copy">
              {tab === 'Dashboard' && 'Overview of recorded matches, backend summaries, and the most recent event stream.'}
              {tab === 'Matches' && 'Manual match creation plus a live table of the backend match store.'}
              {tab === 'Analysis' && 'Transport timing, result grouping, and enemy-style breakdowns from FastAPI.'}
              {tab === 'Recommendations' && 'Probe the live recommendation endpoint and inspect the JSON response.'}
              {tab === 'Automation' && 'Define safe manual-gated helpers after your analysis layer is solid.'}
            </p>
          </div>
          <button className="ghost-btn" onClick={refreshData} disabled={loading.data}>{loading.data ? 'Refreshing…' : 'Refresh'}</button>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {activePanel}
      </main>
    </div>
  )
}
