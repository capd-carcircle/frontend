import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyRecords, DailyRecordResponse } from '../../api/records'

// ── 상수 ──────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  submitted: '검토 대기',
  reviewed:  '검토 완료',
  rejected:  '반려',
}
const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  submitted: { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6' },
  reviewed:  { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
  rejected:  { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
}
const SESSIONS = [1, 2, 3, 4, 5]

// ── 유틸 ──────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]

const formatDateFull = (dateStr: string) => {
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

const formatDateShort = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

// ── 배지 컴포넌트 ──────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      backgroundColor: c.bg, color: c.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.dot, flexShrink: 0 }} />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ── 교환 기록 소형 테이블 ──────────────────────────────────────
function ExchangeTable({ record }: { record: DailyRecordResponse }) {
  const bySession: Record<number, (typeof record.exchange_records)[0]> = {}
  record.exchange_records.forEach((e) => { bySession[e.session_number] = e })
  if (record.exchange_records.length === 0)
    return <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>교환 기록 없음</p>

  const rows = [
    { label: '교환 시간',   key: 'exchange_time' as const },
    { label: '배액량 (g)',  key: 'drainage_volume' as const },
    { label: '농도 (%)',    key: 'infusion_concentration' as const },
    { label: '주입 (g)',    key: 'infusion_weight' as const },
    { label: '제수량 (g)',  key: 'ultrafiltration' as const },
  ]

  return (
    <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 78 }} />
          {SESSIONS.map((n) => <col key={n} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={{ backgroundColor: '#1b508a', color: '#fff', padding: '7px 6px', textAlign: 'left', fontWeight: 600 }}>항목</th>
            {SESSIONS.map((n) => (
              <th key={n} style={{ backgroundColor: '#e8f0f9', color: '#1b508a', padding: '7px 4px', textAlign: 'center', fontWeight: 600 }}>{n}회차</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.key} style={{ backgroundColor: ri % 2 === 0 ? '#fff' : '#f9fafb' }}>
              <td style={{ padding: '6px 6px', color: '#374151', fontWeight: 500, borderTop: '1px solid #f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</td>
              {SESSIONS.map((n) => {
                const val = bySession[n]?.[row.key]
                return (
                  <td key={n} style={{ padding: '6px 4px', textAlign: 'center', color: val != null ? '#1a1a2e' : '#d1d5db', borderTop: '1px solid #f0f0f0' }}>
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

// ── 기록 아이템 (아코디언) ──────────────────────────────────────
function RecordItem({ record, isOpen, onToggle }: {
  record: DailyRecordResponse
  isOpen: boolean
  onToggle: () => void
}) {
  const uf = record.total_ultrafiltration
  const summaryParts = [
    record.weight != null ? `체중 ${record.weight}kg` : null,
    uf != null ? `한외여과 ${uf > 0 ? '+' : ''}${uf}g` : null,
    record.turbid_peritoneal ? '⚠ 혼탁' : null,
  ].filter(Boolean)

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: 12,
      marginBottom: 8,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      border: '1px solid #f0f0f0',
      transition: 'box-shadow 0.15s',
    }}>
      {/* 헤더 행 */}
      <div
        style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 16px', cursor: 'pointer',
          userSelect: 'none', gap: 10,
          backgroundColor: isOpen ? '#fafbfc' : '#fff',
        }}
        onClick={onToggle}
      >
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 2 }}>
            {formatDateShort(record.record_date)}
          </p>
          {summaryParts.length > 0 && (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {summaryParts.join(' · ')}
            </p>
          )}
        </div>
        <Badge status={record.status} />
        <span style={{
          fontSize: 11, color: '#9ca3af',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          marginLeft: 4,
          display: 'inline-block',
        }}>▼</span>
      </div>

      {/* 펼쳐진 상세 */}
      {isOpen && (
        <div style={{ padding: '0 14px 16px', borderTop: '1px solid #f0f0f0' }}>
          {/* 교환 기록 테이블 */}
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              투석 교환 기록
            </p>
            <ExchangeTable record={record} />
          </div>

          {/* 기타 바이탈 */}
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              기타 기록
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 10px' }}>
              {[
                { label: '복막액 혼탁', value: record.turbid_peritoneal ? '있음 ⚠' : '없음', warn: record.turbid_peritoneal },
                { label: '체중',        value: record.weight != null ? `${record.weight} kg` : '—', warn: false },
                { label: '혈압',        value: record.blood_pressure ?? '—', warn: false },
                { label: '소변 횟수',   value: record.urine_count != null ? `${record.urine_count}회` : '—', warn: false },
                { label: '제수량 합계', value: uf != null ? `${uf} g` : '—', warn: false },
                { label: '공복혈당',    value: record.fasting_blood_glucose != null ? `${record.fasting_blood_glucose} mg/dL` : '—', warn: false },
              ].map((item) => (
                <div key={item.label} style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>{item.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: item.warn ? '#dc2626' : '#1a1a2e' }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 메모 */}
          {record.memo && (
            <div style={{ marginTop: 12, backgroundColor: '#fffbeb', borderRadius: 8, padding: '10px 12px', border: '1px solid #fde68a' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>📝 메모</p>
              <p style={{ fontSize: 13, color: '#374151' }}>{record.memo}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────
export default function RecordListPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState<DailyRecordResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId]   = useState<number | null>(null)

  useEffect(() => {
    getMyRecords()
      .then(setRecords)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const today    = todayStr()
  const todayRec = records.find((r) => r.record_date === today) ?? null
  const pastRecs = records.filter((r) => r.record_date !== today)

  const toggleOpen = (id: number) => setOpenId((prev) => (prev === id ? null : id))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa' }}>
      {/* ── 헤더 ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        backgroundColor: '#1b508a',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(27,80,138,0.25)',
      }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px', flex: 1 }}>CAPD</span>
        <span style={{
          color: '#fff', fontSize: 13, fontWeight: 600,
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        }}>나의 기록</span>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 48px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>기록을 불러오는 중...</p>
          </div>
        ) : (
          <>
            {/* ── 오늘 카드 ── */}
            <div style={{
              background: todayRec
                ? '#fff'
                : 'linear-gradient(135deg, #1b508a 0%, #2563eb 100%)',
              borderRadius: 16,
              padding: '20px 20px',
              marginBottom: 24,
              boxShadow: todayRec
                ? '0 2px 12px rgba(0,0,0,0.08)'
                : '0 4px 20px rgba(27,80,138,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              border: todayRec ? '1px solid #e5e7eb' : 'none',
            }}>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: todayRec ? '#9ca3af' : 'rgba(255,255,255,0.7)',
                  marginBottom: 5,
                }}>TODAY</p>
                <p style={{
                  fontSize: 16, fontWeight: 700,
                  color: todayRec ? '#1a1a2e' : '#fff',
                  marginBottom: 6,
                }}>
                  {formatDateFull(today)}
                </p>
                {todayRec ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge status={todayRec.status} />
                    {todayRec.total_ultrafiltration != null && (
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        한외여과 {todayRec.total_ultrafiltration > 0 ? '+' : ''}{todayRec.total_ultrafiltration}g
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                    아직 오늘 기록이 없어요
                  </p>
                )}
              </div>
              <button
                style={{
                  padding: '10px 18px',
                  backgroundColor: todayRec ? '#1b508a' : '#fff',
                  color: todayRec ? '#fff' : '#1b508a',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: todayRec ? 'none' : '0 2px 6px rgba(0,0,0,0.12)',
                  transition: 'opacity 0.15s',
                }}
                onClick={() => navigate('/patient/record')}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {todayRec ? '보기 / 수정' : '지금 기록하기'}
              </button>
            </div>

            {/* ── 과거 기록 목록 ── */}
            {pastRecs.length > 0 ? (
              <>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: 10,
                }}>지난 기록</p>
                {pastRecs.map((rec) => (
                  <RecordItem
                    key={rec.id}
                    record={rec}
                    isOpen={openId === rec.id}
                    onToggle={() => toggleOpen(rec.id)}
                  />
                ))}
              </>
            ) : (
              !loading && records.length <= (todayRec ? 1 : 0) && (
                <div style={{ textAlign: 'center', paddingTop: 32 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>지난 기록이 없어요</p>
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  )
}
