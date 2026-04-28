import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";

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
interface ExchangeRecord {
  session_number:         number
  exchange_time:          string | null
  drainage_volume:        number | null
  infusion_concentration: number | null
  infusion_weight:        number | null
  ultrafiltration:        number | null
}
interface SurveyResponse {
  question_type:      string
  question_text:      string
  question_item_type: string | null   // yes_no | single_select | multi_select | short_text
  reason:             string | null
  choice:             string | null
  text_answer:        string | null
  answered:           boolean
}
interface EMR { S: string; O: string; A: string; P: string }
interface RecordDetail {
  record_id:             number
  patient_name:          string
  record_date:           string
  submitted_at:          string
  status:                string
  turbid_peritoneal:     boolean
  weight:                number | null
  blood_pressure:        string | null
  urine_count:           number | null
  total_ultrafiltration: number | null
  fasting_blood_glucose: number | null
  memo:                  string | null
  exchange_records:      ExchangeRecord[]
  survey_responses:      SurveyResponse[]
  ai_summary:            string
  emr:                   EMR
}

/* ── Card ── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

/* ── 교환 기록 테이블 ── */
const EXCHANGE_ROWS = [
  { label: '시간',       key: 'exchange_time'          },
  { label: '농도 (%)',   key: 'infusion_concentration' },
  { label: '주입량 (g)', key: 'infusion_weight'        },
  { label: '배액량 (g)', key: 'drainage_volume'        },
] as const

function ExchangeTable({ exchanges }: { exchanges: ExchangeRecord[] }) {
  const bySession: Record<number, ExchangeRecord> = {}
  exchanges.forEach(e => { bySession[e.session_number] = e })
  const thS: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left' as const,
    fontSize: 12, fontWeight: 700, color: C.textMuted, whiteSpace: 'nowrap' as const,
  }
  const tdS: React.CSSProperties = { padding: '12px 14px', fontSize: 13, color: C.text }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: C.bg }}>
          <th style={{ ...thS, width: 100 }}>항목</th>
          {[1,2,3,4,5].map(n => <th key={n} style={thS}>{n}회차</th>)}
        </tr>
      </thead>
      <tbody>
        {EXCHANGE_ROWS.map(row => (
          <tr key={row.key} style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ ...tdS, fontSize: 11, fontWeight: 700, color: C.textMuted }}>{row.label}</td>
            {[1,2,3,4,5].map(n => {
              const val = bySession[n]?.[row.key]
              return <td key={n} style={tdS}>{val != null ? String(val) : '—'}</td>
            })}
          </tr>
        ))}
        {/* 제수량 행 (자동 계산) */}
        <tr style={{ borderTop: `1.5px solid ${C.border}`, background: C.bg }}>
          <td style={{ ...tdS, fontSize: 11, fontWeight: 700, color: C.textMuted }}>제수량 (g)</td>
          {[1,2,3,4,5].map(n => {
            const ex = bySession[n]
            const uf = ex?.ultrafiltration ?? (
              ex?.drainage_volume != null && ex?.infusion_weight != null
                ? ex.drainage_volume - ex.infusion_weight
                : null
            )
            return (
              <td key={n} style={{
                ...tdS, fontWeight: 700,
                color: uf == null ? C.textMuted : uf < 0 ? C.danger : C.success,
              }}>
                {uf != null ? (uf > 0 ? `+${uf}` : String(uf)) : '—'}
              </td>
            )
          })}
        </tr>
      </tbody>
    </table>
  )
}

/* ── 설문 응답 ── */
function SurveySection({ responses, type }: { responses: SurveyResponse[]; type: 'common' | 'ai' }) {
  const filtered = responses.filter(r => r.question_type === type)
  if (filtered.length === 0)
    return <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>질문 없음</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {filtered.map((item, i) => (
        <div key={i} style={{
          background: C.bg, borderRadius: 10, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{item.question_text}</div>
          {item.answered ? (
            <span style={{
              background: item.choice === 'no' ? C.successLight : C.primaryLight,
              color: item.choice === 'no' ? C.success : C.primaryDark,
              borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600,
            }}>
              {item.choice === 'yes' ? '예' : item.choice === 'no' ? '아니오' : '—'}
              {item.text_answer ? ` — ${item.text_answer}` : ''}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: C.warning, fontWeight: 600 }}>⏳ 미답변</span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── AI 요약 파싱 헬퍼 (DB에 JSON 문자열이 저장된 경우 대응) ── */
function parseAiSummary(raw: string): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  // JSON 형태로 시작하면 파싱 시도
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.ai_summary) return parsed.ai_summary
    } catch {
      // 파싱 실패 시 regex로 ai_summary 값 추출 시도
      const m = trimmed.match(/"ai_summary"\s*:\s*"([\s\S]*?)"(?:\s*,|\s*\})/)
      if (m) return m[1].replace(/\\n/g, '\n')
    }
  }
  return trimmed
}

/* ── 메인 ── */
export default function RecordDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { recordId, patientName, patientBirthDate, patientGender } = (location.state ?? {}) as { recordId?: number; patientName?: string; patientBirthDate?: string | null; patientGender?: string | null }
  const calcAge = (b: string | null | undefined, ref?: string) => {
    if (!b) return null
    const refD  = ref ? new Date(ref + 'T00:00:00') : new Date()
    const birth = new Date(b + 'T00:00:00')
    let age = refD.getFullYear() - birth.getFullYear()
    const m = refD.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && refD.getDate() < birth.getDate())) age--
    return age
  }
  // 기록 날짜 기준으로 나이 계산 (detail 로드 후 사용)
  const patientLabel = (name: string, recordDate?: string) => {
    const age = calcAge(patientBirthDate, recordDate); const g = patientGender === 'm' ? '남' : patientGender === 'f' ? '여' : null
    if (age !== null && g) return `${name}(${age}/${g})`
    if (age !== null) return `${name}(${age})`
    if (g) return `${name}(${g})`
    return name
  }

  const [detail,    setDetail]    = useState<RecordDetail | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [approving, setApproving] = useState(false)
  const [reverting, setReverting] = useState(false)

  useEffect(() => {
    if (!recordId) return
    const token = localStorage.getItem('access_token')
    if (!token) { navigate('/login'); return }
    fetch(`${API}/api/v1/records/${recordId}/detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (res.status === 401) { localStorage.clear(); navigate('/login'); return null }
        if (!res.ok) throw new Error('서버 오류')
        return res.json()
      })
      .then(json => { if (json) setDetail(json) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [recordId, navigate])

  const handleApprove = async () => {
    if (!recordId || approving) return
    const token = localStorage.getItem('access_token')
    setApproving(true)
    try {
      const res = await fetch(`${API}/api/v1/records/${recordId}/approve`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const err = await res.json(); alert(err.detail ?? '승인 실패'); return }
      setDetail(prev => prev ? { ...prev, status: 'reviewed' } : prev)
    } catch { alert('승인 중 오류가 발생했습니다.') }
    finally { setApproving(false) }
  }

  const handleRevert = async () => {
    if (!recordId || reverting) return
    if (!window.confirm('승인을 취소하고 검토 중 상태로 되돌릴까요?')) return
    const token = localStorage.getItem('access_token')
    setReverting(true)
    try {
      const res = await fetch(`${API}/api/v1/records/${recordId}/revert`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { const err = await res.json(); alert(err.detail ?? '되돌리기 실패'); return }
      setDetail(prev => prev ? { ...prev, status: 'submitted' } : prev)
    } catch { alert('되돌리기 중 오류가 발생했습니다.') }
    finally { setReverting(false) }
  }

  if (!recordId) return (
    <main style={{ padding: 32 }}>
      <p style={{ color: C.textMuted }}>기록을 찾을 수 없습니다.</p>
      <button onClick={() => navigate('/doctor')} style={{ marginTop: 12, padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: C.textMuted }}>← 대시보드로</button>
    </main>
  )

  if (loading) return <div style={{ padding: 32, color: C.textMuted, fontSize: 13 }}>불러오는 중...</div>
  if (error)   return <div style={{ padding: 32, color: C.danger,    fontSize: 13 }}>오류: {error}</div>
  if (!detail) return null

  const isApproved = detail.status === 'reviewed'
  const submitTime = new Date(detail.submitted_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  const vitals = [
    ['복막액 혼탁', detail.turbid_peritoneal ? '있음 ⚠️' : '없음', detail.turbid_peritoneal ? 'danger' : 'success'],
    ['체중',        detail.weight != null ? `${detail.weight} kg` : '—', null],
    ['혈압',        detail.blood_pressure ?? '—', detail.blood_pressure?.startsWith('14') ? 'danger' : null],
    ['소변 횟수',   detail.urine_count != null ? `${detail.urine_count}회` : '—', null],
    ['공복혈당',    detail.fasting_blood_glucose != null ? `${detail.fasting_blood_glucose} mg/dL` : '—', null],
    ['총 제수량',   detail.total_ultrafiltration != null ? `${detail.total_ultrafiltration} g` : '—',
      detail.total_ultrafiltration != null && detail.total_ultrafiltration < 0 ? 'danger' : null],
  ] as const

  return (
    <main style={{ padding: 32 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '7px 14px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: C.textMuted, fontFamily: 'inherit' }}
        >
          ← 목록
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>
            {patientLabel(detail.patient_name, detail.record_date)} 환자 — {detail.record_date}
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: C.textMuted, marginTop: 2 }}>제출 시간: {submitTime}</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {isApproved ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                background: C.successLight, color: C.success,
                borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700,
              }}>✅ 승인 완료</span>
              <button
                onClick={handleRevert} disabled={reverting}
                style={{ padding: '6px 14px', border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: C.textMuted, fontFamily: 'inherit' }}
              >
                {reverting ? '처리 중...' : '↩ 되돌리기'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleApprove} disabled={approving}
              style={{ padding: '10px 20px', background: C.success, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: approving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: approving ? 0.7 : 1 }}
            >
              {approving ? '처리 중...' : '✅ 기록 승인'}
            </button>
          )}
        </div>
      </div>

      {/* 2열 레이아웃: 투석 기록 + 바이탈 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* 투석 기록 테이블 */}
        <Card>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontWeight: 800, fontSize: 14, color: C.text }}>
            CAPD 투석 기록
          </div>
          <ExchangeTable exchanges={detail.exchange_records} />
          {detail.memo && (
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>메모: </span>
              <span style={{ fontSize: 13, color: C.text }}>{detail.memo}</span>
            </div>
          )}
        </Card>

        {/* 바이탈 사이드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vitals.map(([label, value, col]) => (
            <Card key={label} style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: col ? (C as any)[col] : C.text }}>{value}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* EMR + AI 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* EMR */}
        <Card style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 14 }}>📄 EMR 형식 요약</div>
          {(['S','O','A','P'] as const).map(k => (
            <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: C.primary, width: 16, flexShrink: 0 }}>{k}:</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{detail.emr[k]}</div>
            </div>
          ))}
        </Card>

        {/* AI 요약 */}
        <Card style={{ background: C.primaryLight, border: `1px solid ${C.primaryDark}20`, padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.primaryDark, marginBottom: 12 }}>
            ✦ AI 요약 ({patientLabel(detail.patient_name, detail.record_date)})
          </div>
          <div style={{ fontSize: 13, color: C.primaryDark, lineHeight: 1.8 }}>{parseAiSummary(detail.ai_summary)}</div>
        </Card>
      </div>

      {/* 공통 질문 응답 */}
      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 14 }}>💬 공통 질문 응답</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {detail.survey_responses
            .filter(r => r.question_type === 'common')
            .map((item, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{item.question_text}</div>
                {item.answered ? (() => {
                  // yes_no: choice 기준 표시
                  if (item.choice === 'yes' || item.choice === 'no') {
                    return (
                      <span style={{
                        background: item.choice === 'no' ? C.successLight : C.dangerLight,
                        color: item.choice === 'no' ? C.success : C.danger,
                        borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600,
                      }}>
                        {item.choice === 'yes' ? '예' : '아니오'}
                        {item.text_answer ? ` — ${item.text_answer}` : ''}
                      </span>
                    )
                  }
                  // single_select / multi_select / short_text: text_answer 표시
                  if (item.text_answer) {
                    return (
                      <span style={{
                        background: C.primaryLight, color: C.primaryDark,
                        borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600,
                        display: 'inline-block', wordBreak: 'break-word' as const,
                      }}>
                        {item.text_answer}
                      </span>
                    )
                  }
                  return <span style={{ fontSize: 12, color: C.textMuted }}>—</span>
                })() : (
                  <span style={{ fontSize: 12, color: C.warning, fontWeight: 600 }}>⏳ 미답변</span>
                )}
              </div>
            ))}
        </div>
        {detail.survey_responses.filter(r => r.question_type === 'common').length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>설문 응답이 없습니다.</p>
        )}
      </Card>

      {/* AI 맞춤 질문 응답 */}
      {detail.survey_responses.filter(r => r.question_type === 'ai').length > 0 && (
        <Card style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.primaryDark, marginBottom: 14 }}>✦ AI 맞춤 질문 응답</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {detail.survey_responses
              .filter(r => r.question_type === 'ai')
              .map((item, i) => {
                // 답변 텍스트: yes_no는 choice, 나머지는 text_answer
                const answerText = item.choice === 'yes' ? '예'
                  : item.choice === 'no' ? '아니오'
                  : item.text_answer || null
                const isYes = item.choice === 'yes' || (item.text_answer && item.choice !== 'no')
                return (
                  <div key={i} style={{ background: C.bg, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{item.question_text}</div>
                    {item.reason && (
                      <div style={{ fontSize: 11, color: C.primary, marginBottom: 6, fontStyle: 'italic' }}>
                        💡 {item.reason}
                      </div>
                    )}
                    {item.answered ? (
                      <span style={{
                        background: isYes ? C.primaryLight : C.successLight,
                        color: isYes ? C.primaryDark : C.success,
                        borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600,
                        display: 'inline-block', wordBreak: 'break-word' as const,
                      }}>
                        {answerText ?? '—'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: C.warning, fontWeight: 600 }}>⏳ 미답변</span>
                    )}
                  </div>
                )
              })}
          </div>
        </Card>
      )}
    </main>
  )
}
