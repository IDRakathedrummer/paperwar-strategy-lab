import React, { useState, useEffect } from 'react'

const NAV = ['Dashboard', 'Matches', 'Analysis', 'Recommendations', 'Automation']

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(d => setHealth(d.status))
      .catch(() => setHealth('offline'))
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-mark">◆</span>
          <span className="logo-text">PaperWar<br/><small>Strategy Lab</small></span>
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
          <span className={`dot ${health === 'ok' ? 'green' : 'red'}`}/>
          API {health ?? '…'}
        </div>
      </aside>
      <main className="content">
        <h1>{tab}</h1>
        <p className="muted">
          {tab === 'Dashboard' && 'Overview of recent matches and win rates.'}
          {tab === 'Matches' && 'Record and review individual matches.'}
          {tab === 'Analysis' && 'Build order win rates, transport timing, and matchup breakdowns.'}
          {tab === 'Recommendations' && 'Live action suggestions based on your historical winning patterns.'}
          {tab === 'Automation' && 'User-triggered production and transport macros. Off by default.'}
        </p>
      </main>
    </div>
  )
}
