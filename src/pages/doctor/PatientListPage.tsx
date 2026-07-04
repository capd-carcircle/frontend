import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import useAuthStore from '../../store/authStore'
import { useNavigate } from "react-router";
import { PatientDrawer } from './PatientDrawer';
import { formatPhone, calcAge, patientLabel } from '../../utils/helpers';
import { apiFetch } from '../../api/apiFetch';

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  textLight:    '#9ca3af',
  success:      '#16a34a',
  successLight: '#f0fdf4',
  warning:      '#d97706',
  warningLight: '#fffbeb',
  danger:       '#dc2626',
  dangerLight:  '#fef2f2',
}

interface PatientOverview {
  id: number; name: string; phone_number: string
  birth_date: string | null; gender: string | null
  total_records: number; last_record_date: string | null
  last_submitted_at: string | null
  latest_risk_level: 'urgent' | 'caution' | 'normal' | null
  days_since_last_record: number | null
  is_current: boolean
  assignment_started_at: string | null
  assignment_ended_at: string | null
  has_anomaly: boolean | null
  anomaly_record_date: string | null
}

/* ── 환자 이름 포맷 (홍길동(36, 남)) ── */


type RiskFilter = 'all' | 'urgent' | 'caution' | 'normal' | 'no_record'
type SortKey    = 'name' | 'last_record' | 'risk' | 'total'
type ScopeTab   = 'current' | 'past'

const RISK_CFG = {
  urgent:  { label: '🚨 긴급', bg: C.dangerLight,  color: C.danger,  border: '#fca5a5' },
  caution: { label: '⚠️ 주의', bg: C.warningLight, color: C.warning, border: '#fcd34d' },
  normal:  { label: '✓ 정상',  bg: C.successLight, color: C.success, border: '#bbf7d0' },
} as const

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fde68a', color: C.text, padding: '0 1px', borderRadius: 2, fontWeight: 700 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function AnomalyBadge({ date }: { date: string | null }) {
  const title = date
    ? `${new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 분석 리포트에서 이상치 감지됨`
    : '최근 분석 리포트에서 이상치 감지됨'
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: C.dangerLight, color: C.danger, border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      📊 이상치
    </span>
  )
}

function DaysTag({ days }: { days: number | null }) {
  if (days === null) return <span style={{ fontSize: 11, color: C.textLight }}>기록 없음</span>
  if (days === 0) return <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>오늘</span>
  if (days === 1) return <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>어제</span>
  const color  = days >= 7 ? C.danger : days >= 3 ? C.warning : C.textMuted
  const bg     = days >= 7 ? C.dangerLight : days >= 3 ? C.warningLight : C.bg
  const border = days >= 7 ? '#fca5a5' : days >= 3 ? '#fcd34d' : C.border
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: '2px 7px' }}>
      {days}일 전{days >= 3 ? ' ⚠' : ''}
    </span>
  )
}

const MOBILE_BP = 768

function PatientCard({ p, query, onClick, isCurrent }: {
  p: PatientOverview; query: string; onClick: () => void; isCurrent: boolean
}) {
  const isOverdue = isCurrent && p.days_since_last_record !== null && p.days_since_last_record >= 3
  return (
    <div onClick={onClick} className="patient-card" style={{
      background: '#fff', border: `1px solid ${isOverdue ? '#fcd34d' : C.border}`,
      borderRadius: 12, padding: '14px 16px', marginBottom: 8,
      cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: isCurrent ? 1 : 0.82,
      transition: 'box-shadow 0.15s, border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span className="clickable-name" style={{ fontWeight: 700, fontSize: 15, color: C.primaryDark }}>
          <Highlight text={patientLabel(p.name, p.birth_date, p.gender)} query={query} />
        </span>
        <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, borderRadius: 5, padding: '2px 6px', fontWeight: 600 }}>
          #{String(p.id).padStart(4, '0')}
        </span>
        {!isCurrent && (
          <span style={{ fontSize: 11, color: C.textMuted, background: '#f3f4f6', borderRadius: 5, padding: '2px 6px' }}>과거 담당</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {p.has_anomaly && <AnomalyBadge date={p.anomaly_record_date} />}
          {p.latest_risk_level
            ? <span style={{ background: RISK_CFG[p.latest_risk_level].bg, color: RISK_CFG[p.latest_risk_level].color, border: `1px solid ${RISK_CFG[p.latest_risk_level].border}`, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>{RISK_CFG[p.latest_risk_level].label}</span>
            : <span style={{ fontSize: 12, color: C.textLight }}>위험도 없음</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}><Highlight text={formatPhone(p.phone_number)} query={query} /></span>
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {p.total_records > 0 ? <><b style={{ color: C.text }}>{p.total_records}</b>건 기록</> : '기록 없음'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: C.textLight }}>
          {p.last_record_date
            ? new Date(p.last_record_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
            : '기록 없음'}
        </span>
        {isCurrent && <DaysTag days={p.days_since_last_record} />}
        {!isCurrent && p.assignment_ended_at && (
          <span style={{ fontSize: 11, color: C.textMuted }}>
            담당 종료: {new Date(p.assignment_ended_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}

export default function PatientListPage() {
  const navigate = useNavigate()
  const [patients,        setPatients]        = useState<PatientOverview[]>([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [query,           setQuery]           = useState('')
  const [riskFilter,      setRiskFilter]      = useState<RiskFilter>('all')
  const [sortKey,         setSortKey]         = useState<SortKey>('name')
  const [sortDesc,        setSortDesc]        = useState(false)
  const [isMobile,        setIsMobile]        = useState(window.innerWidth < MOBILE_BP)
  const [drawerPatientId, setDrawerPatientId] = useState<number | null>(null)
  const [scope,           setScope]           = useState<ScopeTab>('current')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BP)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fetchPatients = useCallback((sc: ScopeTab) => {
    const token = localStorage.getItem('access_token')
    if (!token) { navigate('/login'); return }
    setLoading(true); setError('')
    apiFetch(`${API}/api/v1/patients/overview?scope=${sc}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { useAuthStore.getState().logout(); navigate('/login'); return null }
        if (!res.ok) throw new Error('서버 오류')
        return res.json()
      })
      .then(data => { if (data) setPatients(data) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => { fetchPatients(scope) }, [scope, fetchPatients])

  const handleDischarge = (patientId: number) => setPatients(prev => prev.filter(p => p.id !== patientId))

  const filtered = useMemo(() => {
    let list = patients
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.phone_number.includes(q))
    }
    if (riskFilter !== 'all') {
      if (riskFilter === 'no_record') list = list.filter(p => !p.total_records)
      else list = list.filter(p => p.latest_risk_level === riskFilter)
    }
    const RISK_RANK: Record<string, number> = { urgent: 0, caution: 1, normal: 2 }
    list = [...list].sort((a, b) => {
      let diff = 0
      if (sortKey === 'name')        diff = a.name.localeCompare(b.name, 'ko')
      if (sortKey === 'last_record') diff = (b.last_record_date ?? '').localeCompare(a.last_record_date ?? '')
      if (sortKey === 'risk')        diff = (RISK_RANK[a.latest_risk_level ?? ''] ?? 9) - (RISK_RANK[b.latest_risk_level ?? ''] ?? 9)
      if (sortKey === 'total')       diff = b.total_records - a.total_records
      return sortDesc ? -diff : diff
    })
    return list
  }, [patients, query, riskFilter, sortKey, sortDesc])

  const stats = useMemo(() => ({
    total:    patients.length,
    urgent:   patients.filter(p => p.latest_risk_level === 'urgent').length,
    caution:  patients.filter(p => p.latest_risk_level === 'caution').length,
    overdue:  patients.filter(p => p.days_since_last_record !== null && p.days_since_last_record >= 3).length,
    noRecord: patients.filter(p => !p.total_records).length,
  }), [patients])

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDesc(d => !d); else { setSortKey(key); setSortDesc(false) } }
  const sortIcon = (key: SortKey) => sortKey !== key ? '↕' : sortDesc ? '↓' : '↑'

  const TABS: { key: RiskFilter; label: string; count: number; color?: string }[] = [
    { key: 'all',       label: '전체',      count: stats.total },
    { key: 'urgent',    label: '🚨 긴급',  count: stats.urgent,  color: C.danger  },
    { key: 'caution',   label: '⚠️ 주의',  count: stats.caution, color: C.warning },
    { key: 'no_record', label: '기록 없음', count: stats.noRecord },
  ]

  const pad = isMobile ? '16px' : '28px 32px'

  return (
    <main style={{ padding: pad, minHeight: '100vh' }}>
      <div style={{ marginBottom: isMobile ? 14 : 22 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, letterSpacing: '-0.04em' }}>담당 환자 관리</h1>
      </div>

      {/* scope 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: isMobile ? 14 : 20, borderBottom: `2px solid ${C.border}` }}>
        {(['current', 'past'] as ScopeTab[]).map(tab => (
          <button key={tab} onClick={() => { setScope(tab); setRiskFilter('all'); setQuery('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 18px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', color: scope === tab ? C.primary : C.textMuted, borderBottom: scope === tab ? `2px solid ${C.primary}` : '2px solid transparent', marginBottom: -2, transition: 'all 0.15s' }}>
            {tab === 'current' ? '현재 담당' : '과거 담당'}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      {scope === 'current' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? 10 : 12, marginBottom: isMobile ? 14 : 22 }}>
          {[
            { label: '총 환자',     value: stats.total,   icon: '👥', color: undefined },
            { label: '긴급 (최근)', value: stats.urgent,  icon: '🚨', color: C.danger  },
            { label: '주의 (최근)', value: stats.caution, icon: '⚠️', color: C.warning },
            { label: '3일+ 미제출', value: stats.overdue, icon: '📋', color: stats.overdue > 0 ? C.warning : undefined },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: isMobile ? '12px 14px' : '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{c.icon}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{c.label}</span>
              </div>
              <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: c.color ?? C.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 검색 + 필터 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.textMuted, pointerEvents: 'none' }}>🔍</span>
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="환자 이름 또는 전화번호 검색..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: query ? 32 : 12, paddingTop: 8, paddingBottom: 8, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
          />
          {query && <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.textMuted }}>✕</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setRiskFilter(t.key)}
              style={{ background: riskFilter === t.key ? (t.color ?? C.primary) : '#fff', color: riskFilter === t.key ? '#fff' : (t.color ?? C.textMuted), border: `1px solid ${riskFilter === t.key ? 'transparent' : C.border}`, borderRadius: 8, padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: C.textMuted, fontSize: 13, padding: '20px 0' }}>불러오는 중...</p>}
      {error   && <p style={{ color: C.danger,    fontSize: 13 }}>오류: {error}</p>}

      {/* 모바일 카드 */}
      {!loading && isMobile && (
        <div>
          {filtered.length === 0
            ? <div style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: '40px 0' }}>{scope === 'past' ? '과거 담당 환자가 없습니다.' : '조건에 맞는 환자가 없습니다.'}</div>
            : filtered.map(p => <PatientCard key={p.id} p={p} query={query} onClick={() => setDrawerPatientId(p.id)} isCurrent={scope === 'current'} />)
          }
        </div>
      )}

      {/* 데스크톱 테이블 */}
      {!loading && !isMobile && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {[
                  { k: 'name'        as SortKey, l: '환자명' },
                  { k: null,                      l: '번호' },
                  { k: null,                      l: '전화번호' },
                  { k: 'risk'        as SortKey, l: '최근 위험도' },
                  { k: 'total'       as SortKey, l: '총 기록' },
                  { k: 'last_record' as SortKey, l: '마지막 기록' },
                  { k: null,                      l: scope === 'current' ? '경과일' : '담당 종료일' },
                ].map((col, i) => (
                  <th key={i} onClick={col.k ? () => handleSort(col.k!) : undefined}
                    style={{ padding: '12px 14px', fontWeight: 700, color: C.textMuted, textAlign: 'left', cursor: col.k ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {col.l}{col.k ? ` ${sortIcon(col.k)}` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7} style={{ padding: '40px 14px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>{scope === 'past' ? '과거 담당 환자가 없습니다.' : '조건에 맞는 환자가 없습니다.'}</td></tr>
                : filtered.map((p, idx) => {
                  const isOverdue = scope === 'current' && p.days_since_last_record !== null && p.days_since_last_record >= 3
                  return (
                    <tr key={p.id} onClick={() => setDrawerPatientId(p.id)}
                      className="patient-row"
                      style={{ borderBottom: idx < filtered.length - 1 ? `1px solid ${C.border}` : 'none', background: isOverdue ? '#fffef0' : '#fff', cursor: 'pointer', opacity: scope === 'past' ? 0.82 : 1, transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--capd-primary-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = isOverdue ? '#fffef0' : '#fff')}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}><span className="clickable-name" style={{ color: C.primaryDark }}><Highlight text={patientLabel(p.name, p.birth_date, p.gender)} query={query} /></span></td>
                      <td style={{ padding: '12px 14px', color: C.textMuted, fontSize: 12 }}>#{String(p.id).padStart(4, '0')}</td>
                      <td style={{ padding: '12px 14px', color: C.textMuted }}><Highlight text={formatPhone(p.phone_number)} query={query} /></td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.latest_risk_level
                            ? <span style={{ background: RISK_CFG[p.latest_risk_level].bg, color: RISK_CFG[p.latest_risk_level].color, border: `1px solid ${RISK_CFG[p.latest_risk_level].border}`, borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{RISK_CFG[p.latest_risk_level].label}</span>
                            : <span style={{ fontSize: 12, color: C.textLight }}>없음</span>}
                          {p.has_anomaly && <AnomalyBadge date={p.anomaly_record_date} />}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{p.total_records > 0 ? `${p.total_records}건` : <span style={{ color: C.textLight }}>없음</span>}</td>
                      <td style={{ padding: '12px 14px', color: C.textMuted, fontSize: 12 }}>
                        {p.last_record_date ? new Date(p.last_record_date + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {scope === 'current'
                          ? <DaysTag days={p.days_since_last_record} />
                          : p.assignment_ended_at
                            ? <span style={{ fontSize: 12, color: C.textMuted }}>{new Date(p.assignment_ended_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            : <span style={{ fontSize: 12, color: C.textLight }}>—</span>}
                      </td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      )}

      {drawerPatientId !== null && (
        <PatientDrawer patientId={drawerPatientId} onClose={() => setDrawerPatientId(null)} onDischarge={handleDischarge} navigate={navigate} />
      )}
    </main>
  )
}
