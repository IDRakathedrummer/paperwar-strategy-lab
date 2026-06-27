import React, { useEffect, useMemo, useState } from 'react'

const NAV = ['Dashboard', 'Matches', 'Analysis', 'Recommendations', 'Automation']
// All FastAPI routes sit under /api (routes.py prefix) — /health lives at root
const API = 'http://localhost:8000/api/'
const HEALTH_URL = 'http://localhost:8000/health'

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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

// Decode a raw event row — data column is a JSON string written by the backend's ingest_event()
// Mirrors every recordEvent() call shape in the userscript v2.0
function decodeEvent(event) {
  let payload = {}
  if (event.data) {
    try { payload = JSON.parse(event.data) } catch { payload = {} }
  }

  const type = event.type || 'event'
  const t = event.t ?? '—'
  const matchShort = event.match_id ? `…${event.match_id.slice(-10)}` : 'unknown'

  let detail = ''
  if (type === 'ink_change') {
    detail = `${payload.prev ?? '?'} → ${payload.ink ?? '?'} ink`
  } else if (type === 'tech_unlock') {
    detail = payload.name || payload.entity || ''
    if (payload.via) detail += ` (${payload.via})`
  } else if (type === 'build' || type === 'ui_click') {
    detail = payload.entity || ''
  } else if (type === 'transport') {
    detail = payload.entity || ''
  } else if (type === 'snapshot') {
    const ownedCount = payload.tech?.owned?.length ?? 0
    const unitCount = payload.units?.length ?? 0
    detail = `${payload.ink ?? '?'} ink · ${ownedCount} tech · ${unitCount} units`
  } else if (type === 'match_end_snapshot') {
    const ownedCount = payload.tech?.owned?.length ?? 0
    detail = `final: ${payload.ink ?? '?'} ink · ${ownedCount} tech unlocked`
  } else if (type === 'match_end') {
    detail = payload.result?.head || ''
  }

  // Colour key: first segment of underscore-split type name
  const tagKey = type.split('_')[0]

  return { type, t, matchShort, detail, tagKey }
}

// ─── PANELS ───────────────────────────────────────────────────────────────────

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
          <div className="eyebrow">Live sync — FastAPI + Tampermonkey userscript</div>
          <h2>PaperWar match intelligence</h2>
          <p className="muted">
            Match data flows: in-game userscript → POST /api/events &amp; /api/matches/end →
            FastAPI → this dashboard. The event stream shows decoded payloads from the most
            recent recorded match.
          </p>
        </div>
        <button className="action-btn" onClick={refresh}>Refresh data</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Total matches" value={totalMatches} subtext="GET /api/matches/" />
        <StatCard
          label="Win rate"
          value={`${winRate}%`}
          tone={winRate >= 50 ? 'good' : 'bad'}
          subtext="Inferred from result_head field"
        />
        <StatCard
          label="Avg duration"
          value={avgDuration ? formatDuration(avgDuration) : '—'}
          subtext="From duration_seconds column"
        />
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
            <EmptyState
              title="No recorded matches"
              text="Start a game with the userscript running — it will POST /api/matches/start and /api/matches/end automatically."
            />
          ) : (
            <div className="list-stack compact-list">
              {matches.slice(0, 6).map(match => (
                <article className="list-item" key={match.id}>
                  <div>
                    <div className="list-title">{match.map_name || 'Unknown map'}</div>
                    <div className="list-meta">
                      {inferMatchResult(match)} · {formatDuration(match.duration_seconds)} · {match.enemy_style || 'No enemy style'}
                    </div>
                  </div>
                  <div className={`badge ${inferMatchResult(match) === 'Win' ? 'good' : 'bad'}`}>
                    {inferMatchResult(match)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h3>Event stream — latest match</h3>
            <span>GET /api/events/{'{match_id}'}</span>
          </div>
          {!recentEvents.length ? (
            <EmptyState
              title="No events yet"
              text="Once the userscript runs a match, decoded build, tech, transport, ink, and snapshot events will appear here."
            />
          ) : (
            <div className="list-stack compact-list">
              {recentEvents.slice(0, 10).map((event, idx) => {
                const { type, t, matchShort, detail, tagKey } = decodeEvent(event)
                return (
                  <article className="list-item event-item" key={`${event.id || idx}-${type}`}>
                    <div className="event-type-col">
                      <span className={`event-tag event-tag--${tagKey}`}>{type}</span>
                    </div>
                    <div className="event-body">
                      <div className="list-title mono">{detail || '—'}</div>
                      <div className="list-meta">t={t}s · {matchShort}</div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <div className="two-col-grid">
        <section className="card">
          <div className="section-head">
            <h3>Matchup summary</h3>
            <span>GET /api/analysis/matchup-summary</span>
          </div>
          {!analysis.matchupSummary.length ? (
            <EmptyState title="No matchup data" text="Populate enemy_style on match records and this table will show per-style win rates." />
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
            <span>GET /api/analysis/transport-timing</span>
          </div>
          {!analysis.transportWindows.length ? (
            <EmptyState title="No winning transport launches" text="Appears when winning matches contain transport events from the userscript click interceptor." />
          ) : (
            <div className="list-stack compact-list mono-list">
              {analysis.transportWindows.slice(0, 8).map((row, idx) => (
                <article className="list-item" key={`${row.match_id}-${row.t}-${idx}`}>
                  <div>
                    <div className="list-title mono">{row.match_id}</div>
                    <div className="list-meta">transport at t={row.t}s</div>
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
          <span>POST /api/matches/</span>
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
            <input value={form.enemy_style} onChange={e => setForm({ ...form, enemy_style: e.target.value })} placeholder="Aggro, Naval, Turtle…" />
          </label>
          <label className="full-span">
            <span>Notes</span>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="What happened in this game?" rows={5} />
          </label>
          <button className="action-btn" type="submit" disabled={creating}>
            {creating ? 'Saving…' : 'Create match'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Recorded matches</h3>
          <span>GET /api/matches/</span>
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
                    <td className="mono truncate-cell" title={match.id}>{match.id}</td>
                    <td>{match.map_name || '—'}</td>
                    <td>
                      <span className={`badge ${inferMatchResult(match) === 'Win' ? 'good' : inferMatchResult(match) === 'Loss' ? 'bad' : ''}`}>
                        {inferMatchResult(match)}
                      </span>
                    </td>
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
          <span>GET /api/analysis/win-rates</span>
        </div>
        {!analysis.winRates.length ? (
          <EmptyState
            title="No win-rate data"
            text="Groups matches by result_head — the raw label the userscript reads from .rc-head on the result screen."
          />
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
          <span>GET /api/analysis/transport-timing</span>
        </div>
        {!analysis.transportWindows.length ? (
          <EmptyState
            title="No transport windows yet"
            text="The userscript click interceptor fires a 'transport' event on transport/naval/carrier clicks. These appear here in winning matches."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Time</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {analysis.transportWindows.map((row, idx) => {
                  let parsed = {}
                  try { parsed = row.data ? JSON.parse(row.data) : {} } catch { parsed = {} }
                  return (
                    <tr key={`${row.match_id}-${idx}`}>
                      <td className="mono truncate-cell" title={row.match_id}>{row.match_id}</td>
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
          <span>GET /api/analysis/matchup-summary</span>
        </div>
        {!analysis.matchupSummary.length ? (
          <EmptyState
            title="No matchup summary yet"
            text="Fill enemy_style on your match records — manually or via a future enrichment step — and this table will group win rates per strategy."
          />
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
  // Shape mirrors what the userscript collects during a match (tech, units, ink, elapsed)
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
          <span>POST /api/recommendations/live</span>
        </div>
        <p className="muted">
          Sends a sample game state to the live recommendation endpoint and displays the raw
          JSON response. Extend the backend logic there to return real suggestions based on
          historical win patterns from the event and match stores.
        </p>
        <div className="action-row">
          <button className="action-btn" onClick={() => refresh(sampleState)} disabled={loading}>
            {loading ? 'Requesting…' : 'Request recommendation'}
          </button>
        </div>
        <pre className="json-block sample-block">{JSON.stringify(sampleState, null, 2)}</pre>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>Backend response</h3>
          <span>Raw JSON</span>
        </div>
        {!recommendation ? (
          <EmptyState title="No recommendation fetched" text="Click the button above to probe the endpoint." />
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
          Keep automation behind explicit user actions. The userscript captures state continuously
          and posts events; any build-order helper or transport macro should stay off by default
          and require a deliberate trigger from this tab.
        </p>
        <div className="callout-grid">
          <div className="callout good">
            <h4>Good next step</h4>
            <p>
              Add a <code>/api/automation/plan</code> endpoint that returns a recommended build order
              based on match history, then wire a confirm button here that the player triggers manually.
            </p>
          </div>
          <div className="callout bad">
            <h4>Not ready yet</h4>
            <p>
              Continuous autonomous play. The analysis layer needs to mature — transport timing
              patterns and tech unlock win-rate correlations — before automation is meaningful.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const [health, setHealth] = useState(null)
  const [matches, setMatches] = useState([])
  const [analysis, setAnalysis] = useState({ winRates: [], transportWindows: [], matchupSummary: [] })
  const [recentEvents, setRecentEvents] = useState([])
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState({ data: false, recommendation: false, creating: false })
  const [error, setError] = useState('')

  // fetchJSON prepends the /api/ base — so fetchJSON('matches/') hits /api/matches/
  const fetchJSON = async (path, options) => {
    const res = await fetch(`${API}${path}`, options)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `HTTP ${res.status} — ${path}`)
    }
    return res.json()
  }

  const refreshData = async () => {
    setLoading(prev => ({ ...prev, data: true }))
    setError('')
    try {
      const [healthRes, matchesRes, winRatesRes, transportRes, matchupRes] = await Promise.all([
        fetch(HEALTH_URL).then(r => r.json()),   // /health is NOT under /api
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

      // index 0 = most recent match (backend returns newest-first)
      // Guard explicitly against undefined/null/"undefined" to prevent
      // fetchJSON('events/undefined') which causes a 307 → 405 error chain
      const latestMatch = loadedMatches[0]
      const matchId = latestMatch?.id
      if (matchId && matchId !== 'undefined' && matchId !== 'null') {
        try {
          const eventsRes = await fetchJSON(`events/${matchId}`)
          setRecentEvents(eventsRes.events || [])
        } catch {
          setRecentEvents([])
        }
      } else {
        setRecentEvents([])
      }
    } catch (err) {
      setHealth('offline')
      setError(err.message || 'Could not reach backend — is the FastAPI server running on port 8000?')
    } finally {
      setLoading(prev => ({ ...prev, data: false }))
    }
  }

  useEffect(() => { refreshData() }, [])

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
            >{n}</button>
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
              {tab === 'Dashboard' && 'Overview of recorded matches, decoded event stream, and analysis summaries from FastAPI.'}
              {tab === 'Matches' && 'Manual match entry form and a live table of the backend match store.'}
              {tab === 'Analysis' && 'Win-rate breakdowns, transport timing windows, and enemy-style matchup data.'}
              {tab === 'Recommendations' && 'Probe the live recommendation endpoint with a sample in-game state.'}
              {tab === 'Automation' && 'Guidance on safe, manual-gated automation helpers to build next.'}
            </p>
          </div>
          <button className="ghost-btn" onClick={refreshData} disabled={loading.data}>
            {loading.data ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        {error ? <div className="error-banner">{error}</div> : null}
        {activePanel}
      </main>
    </div>
  )
}
