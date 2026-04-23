import React, { useEffect, useState, useCallback } from "react";
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

/* ── 타입 ── */
interface PatientInfo {
  id:           number
  name:         string
  phone_number: string
}

interface TodayRecord {
  record_id:       number
  patient_id:      number
  patient_name:    string
  status:          string
  risk_level:      'urgent' | 'caution' | 'normal' | null
  ai_summary:      string | null
  conversation_id: number | null
}

interface DashboardStats {
  total_submitted: number
  pending_count:   number
  approved_count:  number
  total_patients:  number
  records:         TodayRecord[]
  patients:        PatientInfo[]
}

/* ── 위험도 설정 ── */
const RISK_CONFIG = {
  urgent:  { label: '🚨 긴급', bg: C.dangerLight,  color: C.danger,  border: '#fca5a5' },
  caution: { label: '⚠️ 주의', bg: C.warningLight, color: C.warning, border: '#fcd34d' },
  normal:  { label: '✓ 정상',  bg: C.successLight, color: C.success, border: '#bbf7d0' },
} as const

/* ── 대화 보기 모달 ── */
function ConversationModal({ conversationId, onClose }: { conversationId: number; onClose: () => void }) {
  const [messages, setMessages] = React.useState<Array<{ role: string; content: string; is_urgent_flag: boolean }>>([])
  const [loading,  setLoading]  = React.useState(true)

  React.useEffect(() => {
    const token = localStorage.getItem('access_token')
    fetch(`${API}/api/v1/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conversationId])

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>🤖 AI 문진 대화 내용</p>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: C.textLight }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>불러오는 중...</p>
          ) : messages.length === 0 ? (
            <p style={{ color: C.textMuted, fontSize: 13, textAlign: 'center' }}>대화 내용이 없습니다.</p>
          ) : messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'ai' ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '75%', padding: '10px 14px',
                borderRadius: m.role === 'ai' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                backgroundColor: m.is_urgent_flag ? C.dangerLight : m.role === 'ai' ? C.primaryLight : C.primary,
                color: m.is_urgent_flag ? C.danger : m.role === 'ai' ? C.text : '#fff',
                fontSize: 13, lineHeight: 1.6,
                border: m.is_urgent_flag ? `1px solid #fca5a5` : 'none',
              }}>
                <span style={{ fontSize: 10, opacity: 0.6, display: 'block', marginBottom: 2 }}>
                  {m.role === 'ai' ? 'AI' : '환자'}
                </span>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── 상태 뱃지 ── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    submitted: { label: '미검토',   bg: C.dangerLight,  color: C.danger  },
    reviewed:  { label: '승인 완료', bg: C.successLight, color: C.success },
    rejected:  { label: '반려',     bg: '#f3f4f6',       color: C.textMuted },
  }
  const cfg = map[status] ?? { label: status, bg: '#f3f4f6', color: C.textMuted }
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
      {cfg.label}
    </span>
  )
}

/* ── 위험도 뱃지 ── */
function RiskBadge({ level }: { level: 'urgent' | 'caution' | 'normal' | null }) {
  if (!level) return <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>
  const cfg = RISK_CONFIG[level]
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
      {cfg.label}
    </span>
  )
}

/* ── 통계 카드 ── */
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: color ?? C.text, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

/* ── 메인 ── */
export default function DashboardPage() {
  const navigate = useNavigate()
  const [patients,  setPatients]  = useState<PatientInfo[]>([])
  const [stats,     setStats]     = useState<DashboardStats | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [convModal, setConvModal] = useState<number | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const fetchData = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { navigate('/login'); return }
    setLoading(true); setError('')

    Promise.all([
      fetch(`${API}/api/v1/patients`,  { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/v1/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(async ([pRes, dRes]) => {
        if (pRes.status === 401 || dRes.status === 401) { localStorage.clear(); navigate('/login'); return }
        if (!pRes.ok || !dRes.ok) throw new Error('서버 오류')
        const [pData, dData] = await Promise.all([pRes.json(), dRes.json()])
        setPatients(pData as PatientInfo[])
        setStats(dData as DashboardStats)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  /* 오늘 기록 맵 */
  const todayRecordMap = new Map<number, TodayRecord>()
  stats?.records.forEach(r => todayRecordMap.set(r.patient_id, r))

  /* 정렬: 긴급 → 미검토 → 승인됨 → 미제출 */
  const sortedPatients = [...patients].sort((a, b) => {
    const ra = todayRecordMap.get(a.id)
    const rb = todayRecordMap.get(b.id)
    const rank = (r: TodayRecord | undefined) => {
      if (!r) return 3
      if (r.risk_level === 'urgent') return 0
      if (r.status === 'submitted') return 1
      return 2
    }
    return rank(ra) - rank(rb) || a.name.localeCompare(b.name, 'ko')
  })

  const pendingCount  = stats?.pending_count  ?? 0
  const approvedCount = stats?.approved_count ?? 0
  const totalPatients = patients.length
  const totalSubmitted = stats?.total_submitted ?? 0

  if (loading) return <div style={{ padding: 32, color: C.textMuted, fontSize: 13 }}>불러오는 중...</div>
  if (error)   return <div style={{ padding: 32, color: C.danger,    fontSize: 13 }}>오류: {error}</div>

  return (
    <main style={{ padding: 32 }}>
      {convModal && (
        <ConversationModal conversationId={convModal} onClose={() => setConvModal(null)} />
      )}

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>{todayStr}</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>대시보드</h1>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label="오늘 제출" value={totalSubmitted} sub="건" />
        <StatCard label="미검토"   value={pendingCount}   sub="건" color={pendingCount > 0 ? C.warning : undefined} />
        <StatCard label="승인 완료" value={approvedCount}  sub="건" color={C.success} />
        <StatCard label="총 환자 수" value={totalPatients} sub="명" />
      </div>

      {/* 환자 테이블 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>오늘 제출된 기록</h2>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {['환자명', '전화번호', '상태', '위험도', 'AI 요약', ''].map((h, i) => (
                <th key={i} style={{
                  padding: '12px 16px', textAlign: 'left',
                  fontSize: 12, fontWeight: 700, color: C.textMuted,
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPatients.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                  등록된 환자가 없습니다.
                </td>
              </tr>
            ) : sortedPatients.map(p => {
              const rec = todayRecordMap.get(p.id) ?? null
              return (
                <tr
                  key={p.id}
                  style={{
                    borderTop: `1px solid ${C.border}`,
                    background: hoveredRow === p.id ? C.bg : '#fff',
                    transition: 'background 0.1s',
                    cursor: rec ? 'pointer' : 'default',
                  }}
                  onMouseEnter={() => setHoveredRow(p.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => {
                    if (rec) navigate('/doctor/record', { state: { recordId: rec.record_id, patientName: p.name } })
                  }}
                >
                  {/* 환자명 */}
                  <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: 14, color: C.text }}>
                    {p.name}
                  </td>
                  {/* 전화번호 */}
                  <td style={{ padding: '14px 16px', fontSize: 13, color: C.textMuted }}>
                    {p.phone_number}
                  </td>
                  {/* 상태 */}
                  <td style={{ padding: '14px 16px' }}>
                    {rec ? <StatusBadge status={rec.status} /> : <span style={{ fontSize: 12, color: C.textLight }}>미제출</span>}
                  </td>
                  {/* 위험도 */}
                  <td style={{ padding: '14px 16px' }}>
                    <RiskBadge level={rec?.risk_level ?? null} />
                  </td>
                  {/* AI 요약 */}
                  <td style={{ padding: '14px 16px', maxWidth: 280 }}>
                    {rec?.ai_summary ? (
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                          {rec.ai_summary}
                        </p>
                        {rec.conversation_id && (
                          <button
                            style={{ marginTop: 4, fontSize: 11, color: C.primary, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            onClick={e => { e.stopPropagation(); setConvModal(rec.conversation_id!) }}
                          >
                            대화 내용 보기 →
                          </button>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: C.textLight }}>—</span>
                    )}
                  </td>
                  {/* 보기 버튼 */}
                  <td style={{ padding: '14px 16px' }}>
                    {rec && (
                      <button
                        style={{
                          padding: '6px 14px', border: `1px solid ${C.border}`,
                          borderRadius: 8, background: C.primaryLight, color: C.primaryDark,
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onClick={e => { e.stopPropagation(); navigate('/doctor/record', { state: { recordId: rec.record_id, patientName: p.name } }) }}
                      >
                        보기
                      </button>
                    )}
                    {!rec && (
                      <button
                        style={{
                          padding: '6px 14px', border: `1px solid ${C.border}`,
                          borderRadius: 8, background: '#f9fafb', color: C.textMuted,
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onClick={e => { e.stopPropagation(); navigate(`/doctor/patients/${p.id}`, { state: { patientName: p.name } }) }}
                      >
                        과거 기록
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </main>
  )
}
