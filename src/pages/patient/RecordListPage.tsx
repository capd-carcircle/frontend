import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyRecords, DailyRecordResponse } from '../../api/records'
import { getMe } from '../../api/auth'

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
  danger:       '#dc2626',
  dangerLight:  '#fef2f2',
  warning:      '#d97706',
  warningLight: '#fffbeb',
}

const STATUS_LABEL: Record<string, string> = {
  draft:     '작성 중',
  submitted: '검토 대기',
  reviewed:  '검토 완료',
  rejected:  '반려',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#f3f4f6',       color: '#4b5563'  },
  submitted: { bg: C.primaryLight,  color: C.primaryDark },
  reviewed:  { bg: C.successLight,  color: C.success  },
  rejected:  { bg: C.dangerLight,   color: C.danger   },
}

const SESSIONS = [1, 2, 3, 4, 5]
const DAYS = ['일','월','화','수','목','금','토']
const todayStr = () => new Date().toISOString().split('T')[0]
const formatDateFull = (s: string) => {
  const d = new Date(s + 'T00:00:00')
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}
const formatDateShort = (s: string) => {
  const d = new Date(s + 'T00:00:00')
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`
}
const monthKey = (s: string) => s.slice(0, 7)
const formatMonth = (k: string) => { const [y,m] = k.split('-'); return `${y}년 ${parseInt(m)}월` }

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function ExchangeMini({ record }: { record: DailyRecordResponse }) {
  const bySession: Record<number, (typeof record.exchange_records)[0]> = {}
  record.exchange_records.forEach(e => { bySession[e.session_number] = e })
  if (record.exchange_records.length === 0)
    return <p style={{ fontSize: 12, color: C.textLight, margin: 0 }}>교환 기록 없음</p>

  const rows = [
    { label: '시간',    key: 'exchange_time'           as const },
    { label: '농도 (%)', key: 'infusion_concentration' as const },
    { label: '주입 (g)', key: 'infusion_weight'        as const },
    { label: '배액 (g)', key: 'drainage_volume'        as const },
    { label: '제수 (g)', key: 'ultrafiltration'        as const },
  ]

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ background: C.primary, color: '#fff', padding: '6px 8px', textAlign: 'left', fontWeight: 700, width: 70 }}>항목</th>
            {SESSIONS.map(n => (
              <th key={n} style={{ background: C.primaryLight, color: C.primaryDark, padding: '6px 4px', textAlign: 'center', fontWeight: 700 }}>{n}회</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.key} style={{ background: ri % 2 === 0 ? '#fff' : C.bg }}>
              <td style={{ padding: '5px 8px', color: C.textMuted, fontWeight: 600, borderTop: `1px solid ${C.border}` }}>{row.label}</td>
              {SESSIONS.map(n => {
                const val = bySession[n]?.[row.key]
                return (
                  <td key={n} style={{ padding: '5px 4px', textAlign: 'center', color: val != null ? C.text : '#d1d5db', borderTop: `1px solid ${C.border}` }}>
                    {val != null ? String(val) : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordItem({ record, isOpen, onToggle }: {
  record: DailyRecordResponse; isOpen: boolean; onToggle: () => void
}) {
  const uf = record.total_ultrafiltration
  const summaryParts = [
    record.weight != null ? `체중 ${record.weight}kg` : null,
    uf != null ? `제수량 ${uf > 0 ? '+' : ''}${uf}g` : null,
    record.turbid_peritoneal ? '⚠ 혼탁' : null,
  ].filter(Boolean)

  return (
    <div style={{ background: '#fff', borderRadius: 12, marginBottom: 8, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', userSelect: 'none', gap: 10, background: isOpen ? C.bg : '#fff' }}
      >
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{formatDateShort(record.record_date)}</p>
          {summaryParts.length > 0 && (
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{summaryParts.join(' · ')}</p>
          )}
        </div>
        <Badge status={record.status} />
        <span style={{ fontSize: 11, color: C.textLight, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </div>

      {isOpen && (
        <div style={{ padding: '0 14px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>투석 교환 기록</p>
            <ExchangeMini record={record} />
          </div>
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>기타 기록</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 10px' }}>
              {[
                { label: '복막액 혼탁', value: record.turbid_peritoneal ? '있음 ⚠' : '없음', warn: record.turbid_peritoneal },
                { label: '체중',        value: record.weight != null ? `${record.weight} kg` : '—', warn: false },
                { label: '혈압',        value: record.blood_pressure ?? '—', warn: false },
                { label: '소변 횟수',   value: record.urine_count != null ? `${record.urine_count}회` : '—', warn: false },
                { label: '제수량 합계', value: uf != null ? `${uf} g` : '—', warn: false },
                { label: '공복혈당',    value: record.fasting_blood_glucose != null ? `${record.fasting_blood_glucose} mg/dL` : '—', warn: false },
              ].map(item => (
                <div key={item.label} style={{ background: C.bg, borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ fontSize: 10, color: C.textLight, marginBottom: 3 }}>{item.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: item.warn ? C.danger : C.text }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          {record.memo && (
            <div style={{ marginTop: 12, background: C.warningLight, borderRadius: 8, padding: '10px 12px', border: `1px solid #fde68a` }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.warning, marginBottom: 4 }}>📝 메모</p>
              <p style={{ fontSize: 13, color: C.text }}>{record.memo}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MonthGroup({ label, count, isOpen, onToggle, children }: {
  label: string; count: number; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: isOpen ? C.primary : C.primaryLight,
          borderRadius: isOpen ? '10px 10px 0 0' : 10,
          cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: isOpen ? '#fff' : C.primaryDark }}>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, background: isOpen ? 'rgba(255,255,255,0.2)' : C.primary, color: '#fff', padding: '1px 8px', borderRadius: 20 }}>{count}건</span>
        </div>
        <span style={{ fontSize: 11, color: isOpen ? '#fff' : C.primaryDark, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
      </div>
      {isOpen && (
        <div style={{ border: `1px solid ${C.primaryLight}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px 10px 4px', background: '#faf8ff' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default function RecordListPage() {
  const navigate = useNavigate()
  const [records,    setRecords]    = useState<DailyRecordResponse[]>([])
  const [loading,    setLoading]    = useState(true)
  const [openId,     setOpenId]     = useState<number | null>(null)
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())
  const [hasDoctor,  setHasDoctor]  = useState<boolean | null>(null)

  useEffect(() => {
    getMe()
      .then(me => setHasDoctor(!!me.doctor_id))
      .catch(() => setHasDoctor(null))
    getMyRecords()
      .then(data => {
        setRecords(data)
        const thisMonth = new Date().toISOString().slice(0, 7)
        setOpenMonths(new Set([thisMonth]))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const today    = todayStr()
  const todayRec = records.find(r => r.record_date === today) ?? null
  const pastRecs = records.filter(r => r.record_date !== today)

  const monthGroups: { key: string; label: string; recs: DailyRecordResponse[] }[] = []
  const seen = new Set<string>()
  for (const rec of pastRecs) {
    const key = monthKey(rec.record_date)
    if (!seen.has(key)) { seen.add(key); monthGroups.push({ key, label: formatMonth(key), recs: [] }) }
    monthGroups.find(g => g.key === key)!.recs.push(rec)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        background: C.primary, display: 'flex', alignItems: 'center',
        padding: '0 20px', zIndex: 100, boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
      }}>
        <div
          onClick={() => navigate('/patient')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>C</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: '-0.04em' }}>CAPD</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          나의 기록
        </span>
        {/* 우측 버튼 그룹 */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/patient/mypage')}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', padding: '5px 12px', fontFamily: 'inherit',
            }}
          >👤 마이페이지</button>
          <button
            onClick={() => { localStorage.clear(); navigate('/login') }}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', padding: '5px 12px', fontFamily: 'inherit',
            }}
          >↩ 로그아웃</button>
        </div>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 48px' }}>
        {/* 담당 의사 없음 배너 */}
        {hasDoctor === false && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12,
            padding: '14px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 3 }}>
                담당 의사가 없습니다
              </div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                현재 담당 의사가 지정되어 있지 않아 기록을 제출할 수 없습니다.<br />
                병원에 문의하거나 마이페이지에서 담당 연결 요청을 보내주세요.
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: C.textMuted, fontSize: 14 }}>⏳ 불러오는 중...</p>
          </div>
        ) : (
          <>
            {/* 오늘 카드 */}
            <div style={{
              background: todayRec ? '#fff' : `linear-gradient(135deg, ${C.primary} 0%, #9333ea 100%)`,
              borderRadius: 18, padding: '20px', marginBottom: 24,
              boxShadow: todayRec ? '0 2px 12px rgba(0,0,0,0.08)' : '0 4px 20px rgba(124,58,237,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              border: todayRec ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: todayRec ? C.textLight : 'rgba(255,255,255,0.7)', marginBottom: 5 }}>TODAY</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: todayRec ? C.text : '#fff', marginBottom: 6 }}>{formatDateFull(today)}</p>
                {todayRec ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge status={todayRec.status} />
                    {todayRec.total_ultrafiltration != null && (
                      <span style={{ fontSize: 12, color: C.textMuted }}>
                        제수량 {todayRec.total_ultrafiltration > 0 ? '+' : ''}{todayRec.total_ultrafiltration}g
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>아직 오늘 기록이 없어요</p>
                )}
              </div>
              <button
                onClick={() => { if (hasDoctor !== false || todayRec) navigate('/patient/record') }}
                disabled={hasDoctor === false && !todayRec}
                style={{
                  padding: '10px 18px',
                  background: (hasDoctor === false && !todayRec) ? '#d1d5db' : todayRec ? C.primary : '#fff',
                  color: (hasDoctor === false && !todayRec) ? '#6b7280' : todayRec ? '#fff' : C.primary,
                  border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700,
                  cursor: (hasDoctor === false && !todayRec) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: todayRec ? 'none' : '0 2px 6px rgba(0,0,0,0.12)',
                  fontFamily: 'inherit',
                }}
              >
                {!todayRec ? (hasDoctor === false ? '제출 불가' : '지금 기록하기') : todayRec.status === 'draft' ? '이어서 기록하기' : '기록 보기'}
              </button>
            </div>

            {/* 지난 기록 */}
            {monthGroups.length > 0 ? (
              <>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>지난 기록</p>
                {monthGroups.map(({ key, label, recs }) => (
                  <MonthGroup key={key} label={label} count={recs.length}
                    isOpen={openMonths.has(key)} onToggle={() => setOpenMonths(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })}>
                    {recs.map(rec => (
                      <RecordItem key={rec.id} record={rec} isOpen={openId === rec.id}
                        onToggle={() => setOpenId(prev => prev === rec.id ? null : rec.id)} />
                 