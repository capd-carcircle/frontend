import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router";

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

/* ═══════════════ 타입 ═══════════════ */
interface PatientInfo {
  id:           number
  name:         string
  phone_number: string
}
interface TodayRecord {
  record_id:           number
  patient_id:          number
  patient_name:        string
  status:              string
  risk_level:          'urgent' | 'caution' | 'normal' | null
  ai_summary:          string | null
  unreviewed_ai_count: number
}
interface DashboardStats {
  total_submitted: number
  pending_count:   number
  approved_count:  number
  total_patients:  number
  records:         TodayRecord[]
  patients:        PatientInfo[]
}

type StatusFilter = 'all' | 'submitted' | 'reviewed' | 'none'

/* ═══════════════ 날짜 유틸 (로컬 기준) ═══════════════ */
function toDateStr(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function isToday(d: Date): boolean {
  return toDateStr(d) === toDateStr(new Date())
}
function isFuture(d: Date): boolean {
  return toDateStr(d) > toDateStr(new Date())
}
function formatDateKo(d: Date): string {
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}
function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay() }

/* ═══════════════ 검색어 하이라이트 ═══════════════ */
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

/* ═══════════════ 위험도 설정 ═══════════════ */
const RISK = {
  urgent:  { label: '🚨 긴급', bg: C.dangerLight,  color: C.danger,  border: '#fca5a5', rank: 0 },
  caution: { label: '⚠️ 주의', bg: C.warningLight, color: C.warning, border: '#fcd34d', rank: 1 },
  normal:  { label: '✓ 정상',  bg: C.successLight, color: C.success, border: '#bbf7d0', rank: 2 },
} as const

/* ═══════════════ 뱃지 컴포넌트 ═══════════════ */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    submitted: { label: '미검토',   bg: C.dangerLight,  color: C.danger  },
    reviewed:  { label: '승인 완료', bg: C.successLight, color: C.success },
    rejected:  { label: '반려',     bg: '#f3f4f6',      color: C.textMuted },
  }
  const cfg = map[status] ?? { label: status, bg: '#f3f4f6', color: C.textMuted }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
      {cfg.label}
    </span>
  )
}
function RiskBadge({ level }: { level: 'urgent' | 'caution' | 'normal' | null }) {
  if (!level) return <span style={{ color: C.textLight, fontSize: 12 }}>—</span>
  const r = RISK[level]
  return (
    <span style={{ background: r.bg, color: r.color, border: `1px solid ${r.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
      {r.label}
    </span>
  )
}

/* ═══════════════ 통계 카드 ═══════════════ */
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{label}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? C.text, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ═══════════════ 위험도 분포 바 ═══════════════ */
function RiskBar({ records }: { records: TodayRecord[] }) {
  const w = records.filter(r => r.risk_level)
  const u = w.filter(r => r.risk_level === 'urgent').length
  const c = w.filter(r => r.risk_level === 'caution').length
  const n = w.filter(r => r.risk_level === 'normal').length
  const total = u + c + n

  if (total === 0) return <p style={{ fontSize: 12, color: C.textLight, margin: 0, textAlign: 'center', padding: '12px 0' }}>데이터 없음</p>

  const items = [
    { label: '긴급', count: u, color: C.danger,  bg: C.dangerLight  },
    { label: '주의', count: c, color: C.warning, bg: C.warningLight },
    { label: '정상', count: n, color: C.success, bg: C.successLight },
  ]
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 8, marginBottom: 12 }}>
        {items.map(i => i.count > 0 && (
          <div key={i.label} style={{ width: `${(i.count / total) * 100}%`, background: i.color, transition: 'width 0.5s' }} />
        ))}
      </div>
      {items.map(i => (
        <div key={i.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: i.color }} />
            <span style={{ fontSize: 11, color: C.textMuted }}>{i.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: i.count > 0 ? i.color : C.textLight }}>{i.count}</span>
            <span style={{ fontSize: 10, background: i.bg, color: i.color, borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
              {Math.round((i.count / total) * 100)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═══════════════ 제출율 게이지 ═══════════════ */
function SubmitGauge({ submitted, total }: { submitted: number; total: number }) {
  const rate = total > 0 ? Math.round((submitted / total) * 100) : 0
  const color = rate >= 80 ? C.success : rate >= 50 ? C.warning : C.danger
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: C.textMuted }}>전체 환자 기준</span>
        <span style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{rate}%</span>
      </div>
      <div style={{ height: 7, background: C.bg, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{submitted}명 제출 / {total}명 전체</div>
    </div>
  )
}

/* ═══════════════ 미니 캘린더 ═══════════════ */
const WEEKDAYS = ['일','월','화','수','목','금','토']
const MONTHS   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function MiniCalendar({ selectedDate, onSelect }: { selectedDate: Date; onSelect: (d: Date) => void }) {
  const today = new Date()
  const [vy, setVy] = useState(selectedDate.getFullYear())
  const [vm, setVm] = useState(selectedDate.getMonth())

  useEffect(() => { setVy(selectedDate.getFullYear()); setVm(selectedDate.getMonth()) }, [selectedDate])

  const days      = getDaysInMonth(vy, vm)
  const firstDay  = getFirstDayOfMonth(vy, vm)
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevM = () => { if (vm === 0) { setVy(y => y - 1); setVm(11) } else setVm(m => m - 1) }
  const nextM = () => {
    const ny = vm === 11 ? vy + 1 : vy
    const nm = vm === 11 ? 0 : vm + 1
    if (ny > today.getFullYear() || (ny === today.getFullYear() && nm > today.getMonth())) return
    setVy(ny); setVm(nm)
  }
  const nextDisabled = vy > today.getFullYear() || (vy === today.getFullYear() && vm >= today.getMonth())
  const selStr = toDateStr(selectedDate)
  const todStr = toDateStr(today)

  return (
    <div style={{ userSelect: 'none' }}>
      {/* 월 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={prevM} style={{ width: 26, height: 26, border: `1px solid ${C.border}`, borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: C.textMuted, fontFamily: 'inherit' }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{vy}년 {MONTHS[vm]}</span>
        <button onClick={nextM} disabled={nextDisabled} style={{ width: 26, height: 26, border: `1px solid ${C.border}`, borderRadius: 6, background: nextDisabled ? '#f9fafb' : '#fff', cursor: nextDisabled ? 'default' : 'pointer', fontSize: 13, color: nextDisabled ? C.textLight : C.textMuted, fontFamily: 'inherit' }}>›</button>
      </div>
      {/* 요일 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 3 }}>
        {WEEKDAYS.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : C.textLight, padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      {/* 날짜 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />
          const cd   = new Date(vy, vm, day)
          const cs   = toDateStr(cd)
          const fut  = isFuture(cd)
          const sel  = cs === selStr
          const tod  = cs === todStr
          const sun  = idx % 7 === 0
          const sat  = idx % 7 === 6
          return (
            <button key={day} disabled={fut} onClick={() => !fut && onSelect(cd)} style={{
              width: '100%', aspectRatio: '1', border: 'none', borderRadius: 6,
              fontSize: 11, fontWeight: sel || tod ? 700 : 400,
              cursor: fut ? 'default' : 'pointer',
              background: sel ? 'var(--capd-primary)' : tod ? 'var(--capd-primary-light)' : 'transparent',
              color: sel ? '#fff' : fut ? '#d1d5db' : tod ? 'var(--capd-primary-dark)' : sun ? '#ef4444' : sat ? '#3b82f6' : C.text,
              fontFamily: 'inherit', transition: 'background 0.1s',
            }}>{day}</button>
          )
        })}
      </div>
      {selStr !== todStr && (
        <button onClick={() => onSelect(today)} style={{ width: '100%', marginTop: 8, padding: '5px 0', border: `1px solid ${C.border}`, borderRadius: 7, background: '#fff', color: 'var(--capd-primary-dark)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          오늘로 이동
        </button>
      )}
    </div>
  )
}

/* ═══════════════ 상태 필터 탭 ═══════════════ */
const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',       label: '전체'   },
  { key: 'submitted', label: '미검토' },
  { key: 'reviewed',  label: '승인완료' },
  { key: 'none',      label: '미제출' },
]

/* ═══════════════ 정렬 함수 ═══════════════ */
function sortedPatientList(patients: PatientInfo[], recordMap: Map<number, TodayRecord>): PatientInfo[] {
  return [...patients].sort((a, b) => {
    const ra = recordMap.get(a.id)
    const rb = recordMap.get(b.id)
    const rank = (r: TodayRecord | undefined) => {
      if (!r) return 10
      if (r.risk_level === 'urgent')  return 0
      if (r.risk_level === 'caution') return 1
      if (r.status === 'submitted')   return 2
      return 5
    }
    return rank(ra) - rank(rb) || a.name.localeCompare(b.name, 'ko')
  })
}

const MOBILE_BP = 768

/* ═══════════════ 환자 카드 (모바일용) ═══════════════ */
function PatientCard({
  patient, record, searchQuery, onCardClick, onNameClick,
}: {
  patient: PatientInfo
  record: TodayRecord | null
  searchQuery: string
  onCardClick: () => void
  onNameClick: (e: React.MouseEvent) => void
}) {
  const rawSummary = record?.ai_summary ?? null
  const summary = rawSummary
    ? (rawSummary.trim().startsWith('{')
        ? (() => { try { return JSON.parse(rawSummary).ai_summary ?? null } catch { return null } })()
        : rawSummary)
    : null

  return (
    <div
      onClick={onCardClick}
      style={{
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: record ? 'pointer' : 'default',
        marginBottom: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* 1행: 이름 + 뱃지들 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          onClick={onNameClick}
          style={{
            fontWeight: 700, fontSize: 15, color: C.primaryDark,
            borderBottom: `1px dashed ${C.primaryDark}60`,
            paddingBottom: 1, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Highlight text={patient.name} query={searchQuery} />
        </span>
        <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, borderRadius: 5, padding: '2px 6px', fontWeight: 600 }}>
          #{String(patient.id).padStart(4, '0')}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {record ? <StatusBadge status={record.status} /> : (
            <span style={{ background: '#f3f4f6', color: C.textMuted, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>미제출</span>
          )}
          <RiskBadge level={record?.risk_level ?? null} />
        </div>
      </div>

      {/* 2행: 전화번호 + AI질문 수 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: summary ? 6 : 0 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>{patient.phone_number}</span>
        {record && record.unreviewed_ai_count > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: C.warningLight, color: C.warning,
            border: `1px solid #fcd34d`, borderRadius: 6,
            padding: '2px 7px', fontSize: 11, fontWeight: 600,
          }}>
            ⚡ AI 질문 {record.unreviewed_ai_count}건
          </span>
        )}
      </div>

      {/* 3행: AI 요약 */}
      {summary && (
        <div style={{
          fontSize: 12, color: C.textMuted,
          background: C.bg, borderRadius: 7,
          padding: '7px 10px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.5,
        }}>
          {summary}
        </div>
      )}
    </div>
  )
}

/* ═══════════════ 메인 컴포넌트 ═══════════════ */
export default function DashboardPage() {
  const navigate = useNavigate()

  const [patients,      setPatients]      = useState<PatientInfo[]>([])
  const [stats,         setStats]         = useState<DashboardStats | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [hoveredRow,    setHoveredRow]    = useState<number | null>(null)
  const [currentDate,   setCurrentDate]   = useState<Date>(new Date())
  const [searchQuery,   setSearchQuery]   = useState('')
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all')
  const [isMobile,      setIsMobile]      = useState(window.innerWidth < MOBILE_BP)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BP)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* ── 선택 날짜 데이터 fetch ── */
  const fetchData = useCallback((targetDate: Date) => {
    const token = localStorage.getItem('access_token')
    if (!token) { navigate('/login'); return }
    setLoading(true); setError('')
    const dp = toDateStr(targetDate)
    fetch(`${API}/api/v1/dashboard?record_date=${dp}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (dRes) => {
        if (dRes.status === 401) { localStorage.clear(); navigate('/login'); return }
        if (!dRes.ok) throw new Error('서버 오류')
        const dData: DashboardStats = await dRes.json()
        setPatients(dData.patients)
        setStats(dData)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => { fetchData(currentDate) }, [fetchData, currentDate])

  /* ── 날짜 선택 ── */
  const handleSelectDate = (d: Date) => {
    setCurrentDate(d)
    setStatusFilter('all')
  }

  /* ── 기록 맵 ── */
  const recordMap = useMemo(() => {
    const m = new Map<number, TodayRecord>()
    stats?.records.forEach(r => m.set(r.patient_id, r))
    return m
  }, [stats])

  /* ── 검색 필터 ── */
  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return patients
    return patients.filter(p => p.name.toLowerCase().includes(q))
  }, [patients, searchQuery])

  /* ── 상태 필터 ── */
  const statusFiltered = useMemo(() => {
    return searchFiltered.filter(p => {
      const rec = recordMap.get(p.id)
      if (statusFilter === 'submitted') return rec?.status === 'submitted'
      if (statusFilter === 'reviewed')  return rec?.status === 'reviewed'
      if (statusFilter === 'none')      return !rec
      return true
    })
  }, [searchFiltered, recordMap, statusFilter])

  /* ── 정렬 ── */
  const displayPatients = useMemo(
    () => sortedPatientList(statusFiltered, recordMap),
    [statusFiltered, recordMap]
  )

  /* ── 통계 ── */
  const totalPatients  = stats?.total_patients ?? 0
  const totalSubmitted = stats?.total_submitted ?? 0
  const pendingCount   = stats?.pending_count   ?? 0
  const approvedCount  = stats?.approved_count  ?? 0
  const allRecords     = stats?.records ?? []

  /* ── 모드 판단 ── */
  const isSearchMode   = searchQuery.trim().length > 0
  const isCombinedMode = isSearchMode && !isToday(currentDate)

  /* ── 탭별 카운트 ── */
  const tabCounts: Record<StatusFilter, number> = useMemo(() => {
    return {
      all:       searchFiltered.length,
      submitted: searchFiltered.filter(p => recordMap.get(p.id)?.status === 'submitted').length,
      reviewed:  searchFiltered.filter(p => recordMap.get(p.id)?.status === 'reviewed').length,
      none:      searchFiltered.filter(p => !recordMap.get(p.id)).length,
    }
  }, [searchFiltered, recordMap])

  /* ── 테이블 제목 ── */
  const tableTitle = () => {
    if (isCombinedMode) return `"${searchQuery}" 검색 · ${toDateStr(currentDate)} 기록`
    if (isSearchMode)   return `"${searchQuery}" 검색 결과 — 오늘 기준`
    if (isToday(currentDate)) return '오늘 기록'
    return `${toDateStr(currentDate)} 기록`
  }

  /* ── 빈 상태 메시지 ── */
  const emptyMessage = () => {
    if (isSearchMode && searchFiltered.length === 0)
      return `"${searchQuery}"와 일치하는 환자가 없습니다`
    if (statusFilter !== 'all' && displayPatients.length === 0) {
      const labels: Record<StatusFilter, string> = { all: '', submitted: '미검토', reviewed: '승인완료', none: '미제출' }
      return `${labels[statusFilter]} 상태의 환자가 없습니다`
    }
    if (patients.length === 0) return '등록된 환자가 없습니다'
    return '해당 날짜에 데이터가 없습니다'
  }

  /* ── 공통 렌더 조각 ── */
  const SearchBar = (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.textMuted, pointerEvents: 'none' }}>🔍</span>
      <input
        ref={searchRef}
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setStatusFilter('all') }}
        placeholder="환자 이름 검색..."
        style={{
          width: '100%', paddingLeft: 32, paddingRight: searchQuery ? 32 : 12,
          paddingTop: 8, paddingBottom: 8,
          border: `1px solid ${searchQuery ? 'var(--capd-primary)' : C.border}`,
          borderRadius: 9, fontSize: 13, outline: 'none',
          background: '#fff', color: C.text, fontFamily: 'inherit',
          boxSizing: 'border-box',
          boxShadow: searchQuery ? '0 0 0 3px var(--capd-primary-light)' : 'none',
          transition: 'all 0.15s',
        }}
      />
      {searchQuery && (
        <button
          onClick={() => { setSearchQuery(''); setStatusFilter('all'); searchRef.current?.focus() }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14, padding: 0 }}
        >✕</button>
      )}
    </div>
  )

  const FilterTabs = (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {FILTER_TABS.map(tab => {
        const active = statusFilter === tab.key
        const cnt = tabCounts[tab.key]
        return (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            style={{
              padding: '6px 11px', borderRadius: 8, border: `1px solid ${active ? 'var(--capd-primary)' : C.border}`,
              background: active ? 'var(--capd-primary)' : '#fff',
              color: active ? '#fff' : C.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.12s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {tab.label}
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: active ? 'rgba(255,255,255,0.25)' : C.bg,
              color: active ? '#fff' : C.textMuted,
              borderRadius: 10, padding: '1px 5px',
            }}>{cnt}</span>
          </button>
        )
      })}
    </div>
  )

  const SidePanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>📅 날짜 선택</div>
        <MiniCalendar selectedDate={currentDate} onSelect={handleSelectDate} />
      </div>
      {!isSearchMode && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>
            🎯 위험도 분포
            <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400, marginLeft: 5 }}>AI 분석 {allRecords.filter(r => r.risk_level).length}명</span>
          </div>
          <RiskBar records={allRecords} />
        </div>
      )}
      {!isSearchMode && (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>📊 기록 제출율</div>
          <SubmitGauge submitted={totalSubmitted} total={totalPatients} />
        </div>
      )}
    </div>
  )

  /* ─────────── 모바일 렌더 ─────────── */
  if (isMobile) {
    return (
      <main style={{ padding: '16px', minHeight: '100vh' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>대시보드</h1>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{formatDateKo(currentDate)}</div>
        </div>

        {/* 통계 카드 (2×2 그리드) */}
        {!isSearchMode && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <StatCard icon="📋" label="제출된 기록" value={totalSubmitted} sub="건" />
            <StatCard icon="🔍" label="미검토" value={pendingCount} sub="건" color={pendingCount > 0 ? C.warning : undefined} />
            <StatCard icon="✅" label="승인 완료" value={approvedCount} sub="건" color={C.success} />
            <StatCard icon="👥" label="총 환자 수" value={totalPatients} sub="명" />
          </div>
        )}

        {/* 검색 + 필터 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ marginBottom: 8 }}>{SearchBar}</div>
          {FilterTabs}
        </div>

        {/* 검색 모드 배너 */}
        {isSearchMode && (
          <div style={{
            background: C.primaryLight, border: `1px solid ${C.primaryDark}20`,
            borderRadius: 10, padding: '8px 12px', marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, color: C.primaryDark }}>
              {isCombinedMode
                ? <><b>{toDateStr(currentDate)}</b> · <b>"{searchQuery}"</b> {searchFiltered.length}명</>
                : <><b>"{searchQuery}"</b> {searchFiltered.length}명 (오늘 기준)</>
              }
            </div>
            <button onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
              style={{ fontSize: 12, color: C.primaryDark, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✕</button>
          </div>
        )}

        {/* 제목 + 로딩 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tableTitle()}</span>
          {loading && <span style={{ fontSize: 11, color: C.textLight }}>⏳ 불러오는 중...</span>}
        </div>

        {/* 환자 카드 목록 */}
        {error ? (
          <div style={{ padding: '16px', color: C.danger, fontSize: 13, background: '#fff', borderRadius: 12, border: `1px solid ${C.border}` }}>
            오류: {error}
          </div>
        ) : displayPatients.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: C.textMuted, fontSize: 13, background: '#fff', borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{isSearchMode ? '🔍' : '📋'}</div>
            {loading ? '불러오는 중...' : emptyMessage()}
          </div>
        ) : displayPatients.map(p => {
          const rec = recordMap.get(p.id) ?? null
          return (
            <PatientCard
              key={p.id}
              patient={p}
              record={rec}
              searchQuery={searchQuery}
              onCardClick={() => {
                if (rec) navigate('/doctor/record', { state: { recordId: rec.record_id, patientName: p.name } })
              }}
              onNameClick={e => {
                e.stopPropagation()
                navigate(`/doctor/patients/${p.id}`, { state: { patientName: p.name } })
              }}
            />
          )
        })}

        {/* 하단 사이드 패널 (캘린더/통계) */}
        <div style={{ marginTop: 16 }}>{SidePanel}</div>

      </main>
    )
  }

  /* ─────────── 데스크톱 렌더 ─────────── */
  return (
    <main style={{ padding: '28px 32px', minHeight: '100vh' }}>

      {/* ── 헤더 ── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>대시보드</h1>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>{formatDateKo(currentDate)}</div>
      </div>

      {/* ── 통계 카드 ── */}
      {!isSearchMode && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
          <StatCard icon="📋" label="제출된 기록" value={totalSubmitted} sub="건" />
          <StatCard icon="🔍" label="미검토" value={pendingCount} sub="건" color={pendingCount > 0 ? C.warning : undefined} />
          <StatCard icon="✅" label="승인 완료" value={approvedCount} sub="건" color={C.success} />
          <StatCard icon="👥" label="총 환자 수" value={totalPatients} sub="명" />
        </div>
      )}

      {/* ── 검색 모드 배너 ── */}
      {isSearchMode && (
        <div style={{
          background: C.primaryLight, border: `1px solid ${C.primaryDark}20`,
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, color: C.primaryDark }}>
            {isCombinedMode
              ? <>📅 <b>{toDateStr(currentDate)}</b> · 🔍 <b>"{searchQuery}"</b> 검색 중 — {searchFiltered.length}명 일치</>
              : <>🔍 <b>"{searchQuery}"</b> 검색 중 — 오늘 기준, {searchFiltered.length}명 일치</>
            }
          </div>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
            style={{ fontSize: 12, color: C.primaryDark, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 6px' }}
          >✕ 검색 초기화</button>
        </div>
      )}

      {/* ── 2열 레이아웃 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: 20, alignItems: 'start' }}>

        {/* ── 좌: 환자 테이블 ── */}
        <div>

          {/* 테이블 상단 바 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>

            {/* 검색 인풋 */}
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.textMuted, pointerEvents: 'none' }}>🔍</span>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setStatusFilter('all') }}
                placeholder="환자 이름 검색..."
                style={{
                  width: '100%', paddingLeft: 32, paddingRight: searchQuery ? 32 : 12,
                  paddingTop: 8, paddingBottom: 8,
                  border: `1px solid ${searchQuery ? 'var(--capd-primary)' : C.border}`,
                  borderRadius: 9, fontSize: 13, outline: 'none',
                  background: '#fff', color: C.text, fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  boxShadow: searchQuery ? '0 0 0 3px var(--capd-primary-light)' : 'none',
                  transition: 'all 0.15s',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); searchRef.current?.focus() }}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14, padding: 0 }}
                >✕</button>
              )}
            </div>

            {/* 상태 필터 탭 */}
            <div style={{ display: 'flex', gap: 4 }}>
              {FILTER_TABS.map(tab => {
                const active = statusFilter === tab.key
                const cnt = tabCounts[tab.key]
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    style={{
                      padding: '6px 11px', borderRadius: 8, border: `1px solid ${active ? 'var(--capd-primary)' : C.border}`,
                      background: active ? 'var(--capd-primary)' : '#fff',
                      color: active ? '#fff' : C.textMuted,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.12s',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    {tab.label}
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      background: active ? 'rgba(255,255,255,0.25)' : C.bg,
                      color: active ? '#fff' : C.textMuted,
                      borderRadius: 10, padding: '1px 5px',
                    }}>{cnt}</span>
                  </button>
                )
              })}
            </div>

            {/* 테이블 제목 + 로딩 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted }}>{tableTitle()}</span>
              {loading && <span style={{ fontSize: 11, color: C.textLight }}>⏳</span>}
            </div>
          </div>

          {/* 테이블 */}
          {error ? (
            <div style={{ padding: '20px 16px', color: C.danger, fontSize: 13, background: '#fff', borderRadius: 14, border: `1px solid ${C.border}` }}>
              오류: {error}
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '13%'  }} />{/* 환자명 */}
                  <col style={{ width: '9%'   }} />{/* 환자번호 */}
                  <col style={{ width: '14%'  }} />{/* 전화번호 */}
                  <col style={{ width: '10%'  }} />{/* 상태 */}
                  <col style={{ width: '10%'  }} />{/* 위험도 */}
                  <col style={{ width: '9%'   }} />{/* AI 질문 */}
                  <col style={{ width: '35%'  }} />{/* AI 요약 */}
                </colgroup>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['환자명', '환자번호', '전화번호', '상태', '위험도', 'AI 질문', 'AI 요약'].map((h, i) => (
                      <th key={i} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.textMuted, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayPatients.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px 16px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>
                          {isSearchMode ? '🔍' : '📋'}
                        </div>
                        {loading ? '불러오는 중...' : emptyMessage()}
                      </td>
                    </tr>
                  ) : displayPatients.map(p => {
                    const rec = recordMap.get(p.id) ?? null
                    const hasRecord = !!rec

                    return (
                      <tr
                        key={p.id}
                        style={{
                          borderTop: `1px solid ${C.border}`,
                          background: hoveredRow === p.id ? C.bg : '#fff',
                          transition: 'background 0.1s',
                          cursor: hasRecord ? 'pointer' : 'default',
                        }}
                        onMouseEnter={() => setHoveredRow(p.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={() => {
                          if (hasRecord) navigate('/doctor/record', { state: { recordId: rec!.record_id, patientName: p.name } })
                        }}
                      >
                        {/* 환자명 — 클릭 시 전체 기록 이동 */}
                        <td
                          style={{ padding: '12px 12px', fontWeight: 700, fontSize: 14 }}
                          onClick={e => {
                            e.stopPropagation()
                            navigate(`/doctor/patients/${p.id}`, { state: { patientName: p.name } })
                          }}
                        >
                          <span style={{
                            color: C.primaryDark, cursor: 'pointer',
                            borderBottom: `1px dashed ${C.primaryDark}60`,
                            paddingBottom: 1,
                          }}>
                            <Highlight text={p.name} query={searchQuery} />
                          </span>
                        </td>

                        {/* 환자번호 */}
                        <td style={{ padding: '12px 12px' }}>
                          <span style={{ fontSize: 11, background: C.bg, color: C.textMuted, borderRadius: 5, padding: '2px 7px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            #{String(p.id).padStart(4, '0')}
                          </span>
                        </td>

                        {/* 전화번호 */}
                        <td style={{ padding: '12px 12px', fontSize: 12, color: C.textMuted }}>{p.phone_number}</td>

                        {/* 상태 */}
                        <td style={{ padding: '12px 12px' }}>
                          {rec ? <StatusBadge status={rec.status} /> : (
                            <span style={{ background: '#f3f4f6', color: C.textMuted, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>미제출</span>
                          )}
                        </td>

                        {/* 위험도 */}
                        <td style={{ padding: '12px 12px' }}>
                          <RiskBadge level={rec?.risk_level ?? null} />
                        </td>

                        {/* 미검토 AI 질문 수 */}
                        <td style={{ padding: '12px 12px' }}>
                          {rec && rec.unreviewed_ai_count > 0 ? (
                            <span
                              onClick={e => { e.stopPropagation(); navigate('/doctor/ai-questions') }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.warningLight, color: C.warning, border: `1px solid #fcd34d`, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                            >⚡ {rec.unreviewed_ai_count}건</span>
                          ) : (
                            <span style={{ fontSize: 12, color: C.textLight }}>—</span>
                          )}
                        </td>

                        {/* AI 요약 */}
                        <td style={{ padding: '12px 12px' }}>
                          {rec?.ai_summary ? (
                            <p style={{ margin: 0, fontSize: 11, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {rec.ai_summary.trim().startsWith('{')
                                ? (() => { try { return JSON.parse(rec.ai_summary).ai_summary ?? rec.ai_summary } catch { return rec.ai_summary.replace(/\{.*?"ai_summary"\s*:\s*"/, '').slice(0, 120) } })()
                                : rec.ai_summary}
                            </p>
                          ) : (
                            <span style={{ fontSize: 12, color: C.textLight }}>—</span>
                          )}
                        </td>

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 우: 사이드 패널 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 캘린더 */}
          <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>📅 날짜 선택</div>
            <MiniCalendar selectedDate={currentDate} onSelect={handleSelectDate} />
          </div>

          {/* 위험도 분포 */}
          {!isSearchMode && (
            <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>
                🎯 위험도 분포
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400, marginLeft: 5 }}>AI 분석 {allRecords.filter(r => r.risk_level).length}명</span>
              </div>
              <RiskBar records={allRecords} />
            </div>
          )}

          {/* 제출율 */}
          {!isSearchMode && (
            <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 10 }}>📊 기록 제출율</div>
              <SubmitGauge submitted={totalSubmitted} total={totalPatients} />
            </div>
          )}

          {/* 검색 모드일 때: 안내 패널 */}
          {isSearchMode && (
            <div style={{ background: C.primaryLight, borderRadius: 14, border: `1px solid ${C.primaryDark}20`, padding: '14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primaryDark, marginBottom: 8 }}>💡 검색 팁</div>
              <div style={{ fontSize: 11, color: C.primaryDark, lineHeight: 1.7 }}>
                • 환자 이름으로 필터링됩니다<br />
                • <b>전체 기록</b> 버튼으로 해당 환자의 모든 기록을 확인할 수 있어요<br />
                • 캘린더로 날짜를 선택하면 그 날의 기록을 함께 확인할 수 있어요<br />
                • <b>환자번호(#0001)</b>로 동명이인을 구별하세요
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  )
}
