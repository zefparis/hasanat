import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Shield from '../components/Shield'
import { exploreApi, type LearnState } from '../lib/api'
import { useI18n } from '../lib/i18n'

export default function Learn() {
  const { t } = useI18n()
  const [state, setState] = useState<LearnState | null>(null)

  useEffect(() => {
    exploreApi.learn().then(setState).catch(() => {})
  }, [])

  if (!state) {
    return <div className="screen"><Header title={t('learn.title')} right={<Shield />} /><div className="pad"><p className="muted">{t('common.loading')}</p></div></div>
  }

  const quranPct = Math.round((state.quran.juzRead / state.quran.juzTotal) * 100)
  const circumference = 2 * Math.PI * 54

  return (
    <div className="screen">
      <Header title={t('learn.title')} right={<Shield />} />

      {/* Quran progress ring */}
      <div className="pad sec">
        <h3>{t('learn.quranReading')}</h3>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 16px' }}>
          <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
            <svg viewBox="0 0 130 130" style={{ width: '100%', height: '100%' }}>
              <circle cx="65" cy="65" r="54" stroke="var(--surface2)" strokeWidth="8" fill="none" />
              <circle
                cx="65" cy="65" r="54" stroke="var(--primary-2)" strokeWidth="8" fill="none" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (quranPct / 100) * circumference}
                transform="rotate(-90 65 65)"
                style={{ transition: 'stroke-dashoffset .8s' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <b style={{ fontFamily: 'var(--serif)', fontSize: 28 }}>{state.quran.juzRead}<small style={{ fontSize: 14, color: 'var(--muted)' }}>/{state.quran.juzTotal}</small></b>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('learn.juz')}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="kv"><span>{t('learn.streak')}</span><b>{state.quran.streak} {t('learn.days')}</b></div>
            <div className="kv"><span>{t('learn.pointsMonth')}</span><b>{state.quran.pointsThisMonth}</b></div>
            <div className="kv"><span>{t('learn.progress')}</span><b>{quranPct}%</b></div>
          </div>
        </div>
        <p className="disc" style={{ marginTop: 8 }}>
          {t('learn.pointsDisc')}
        </p>
      </div>

      {/* Courses */}
      <div className="pad sec">
        <h3>{t('learn.courses')}</h3>
        <div className="card">
          {state.courses.map((c) => (
            <div key={c.id} className="item" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 12 }}>
              <div className="tx" style={{ flex: 1 }}>
                <b style={{ fontSize: 14 }}>{c.title}</b>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('learn.lessons', { completed: c.completedLessons, total: c.lessons })}</span>
              </div>
              <div style={{ width: 100 }}>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div style={{ width: `${c.progress * 100}%`, height: '100%', background: c.progress === 1 ? 'var(--ok)' : 'var(--primary-2)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', textAlign: 'right', marginTop: 4 }}>
                  {c.progress === 1 ? t('learn.complete') : `${Math.round(c.progress * 100)}%`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Badges */}
      <div className="pad sec">
        <h3>{t('learn.badges')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {state.badges.map((b) => (
            <div key={b.id} className="card" style={{ textAlign: 'center', padding: '14px 8px', opacity: b.earned ? 1 : 0.4, border: b.earned ? '1px solid var(--accent)' : '1px solid var(--line)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{b.earned ? b.icon : '🔒'}</div>
              <b style={{ fontSize: 11.5, lineHeight: 1.3, display: 'block' }}>{b.title}</b>
              <span style={{ fontSize: 10, color: b.earned ? 'var(--ok)' : 'var(--muted)' }}>{b.earned ? t('learn.earned') : t('learn.locked')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
