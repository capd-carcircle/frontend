import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
}

/* ── 환자 이름 포맷 (홍길동(36, 남)) ── */
function calcAge(birth_date: string | null): number | null {
  if (!birth_date) return null
  const today = new Date(); const birth = new Date(birth_date + 'T00:00:00')
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}
function patientLabel(name: string, birth_date: string | null, gender: string | null): string {
  const age = calcAge(birth_date)
  const g = gender === 'm' ? '남' : gender === 'f' ? '여' : null
  if (age !== null && g) return `${name}(${age}/${g})`
  if (age !== null) return `${name}(${age})`
  if (g) return `${name}(${g})`
  return name
}

interface DrawerProfile {
  id: number; name: string; phone_number: string
  birth_date: string | null; hospital_name: string | null
  doctor_name: string | null; self_memo: string | null
  joined_at: string | null; is_current_patient: boolean
}

interface TrendPoint {
  record_date: string
  weight: number | null
  total_ultrafiltration: number | null
  blood_pressure: string | null
  risk_level: string | null
}

/* ── 스파크라인 ── */
function Sparkline({ data, field, color, label, unit }: {
  data: TrendPoint[]
  field: 'weight' | 'total_ultrafiltration'
  color: string; label: string; unit: string
}) {
  const pts = data.filter(d => d[field] !== null).map(d => d[field] as number)
  if (pts.length < 2) return (
    <div style={{ fontSize: 11, color: C.textMuted, padding: '4px 0' }}>{label}: 데이터 부족</div>
  )
  const W = 200, H = 40, PAD = 4
  const minV = Math.min(...pts), maxV = Math.max(...pts)
  const rangeV = maxV - minV || 1
  const xs = pts.map((_, i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2))
  const ys = pts.map(v => H - PAD - ((v - minV) / rangeV) * (H - PAD * 2))
  const polyPts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{pts[pts.length - 1].toFixed(1)} {unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`sg-${field}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${xs[0].toFixed(1)},${H} ${polyPts} ${xs[xs.length - 1].toFixed(1)},${H}`} fill={`url(#sg-${field})`} />
        <polyline points={polyPts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3.5 : 2} fill={color} stroke="#fff" strokeWidth={1} />
        ))}
      </svg>
    </div>
  )
}

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

function formatDate(str: string | null) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ minWidth: 88, fontSize: 13, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
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
        <div style={{ marginLeft: 'auto' }}>
          {p.latest_risk_level
            ? <span style={{ background: RISK_CFG[p.latest_risk_level].bg, color: RISK_CFG[p.latest_risk_level].color, border: `1px solid ${RISK_CFG[p.latest_risk_level].border}`, borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>{RISK_CFG[p.latest_risk_level].label}</span>
            : <span style={{ fontSize: 12, color: C.textLight }}>위험도 없음</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}><Highlight text={p.phone_number} query={query} /></span>
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

function PatientDrawer({ patientId, onClose, onDischarge, navigate }: {
  patientId: number; onClose: () => void
  onDischarge: (id: number) => void; navigate: ReturnType<typeof useNavigate>
}) {
  const [profile,     setProfile]     = useState<DrawerProfile | null>(null)
  const [note,        setNote]        = useState('')
  const [origNote,    setOrigNote]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [discharging, setDischarging] = useState(false)
  const [err,         setErr]         = useState('')
  const [trend,       setTrend]       = useState<TrendPoint[]>([])
  const [showPdf,     setShowPdf]     = useState(false)
  const [pdfStart,    setPdfStart]    = useState('')
  const [pdfEnd,      setPdfEnd]      = useState('')
  const token = () => localStorage.getItem('access_token') ?? ''

  useEffect(() => {
    setLoading(true); setErr(''); setProfile(null); setTrend([])
    const t = token()
    Promise.all([
      fetch(`${API}/api/v1/patients/${patientId}/profile`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => { if (!r.ok) throw new Error('프로필 오류'); return r.json() }),
      fetch(`${API}/api/v1/patients/${patientId}/note`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => { if (!r.ok) throw new Error('메모 오류'); return r.json() }),
      fetch(`${API}/api/v1/patients/${patientId}/trend?days=14`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : []),
    ])
      .then(([profileData, noteData, trendData]) => {
        setProfile(profileData)
        const c = noteData.content ?? ''; setNote(c); setOrigNote(c)
        setTrend(trendData)
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [patientId])

  const handleSaveNote = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/v1/patients/${patientId}/note`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note }),
      })
      if (!res.ok) throw new Error('저장 실패')
      setOrigNote(note); setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const handleDischarge = async () => {
    if (!profile?.is_current_patient) return
    if (!window.confirm(`${profile.name} 환자의 담당을 해제하시겠습니까?\n\n담당 해제 후에는 이 환자가 기록을 제출할 수 없게 됩니다.`)) return
    setDischarging(true)
    try {
      const res = await fetch(`${API}/api/v1/patients/${patientId}/discharge`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? '담당 해제 실패')
      alert(data.message); onDischarge(patientId); onClose()
    } catch (e: any) { alert(e.message) } finally { setDischarging(false) }
  }

  const noteChanged = note !== origNote

  const handleExportPdf = async () => {
    const t = token()
    const params = new URLSearchParams()
    if (pdfStart) params.set('start_date', pdfStart)
    if (pdfEnd)   params.set('end_date', pdfEnd)
    const res = await fetch(`${API}/api/v1/patients/${patientId}/records-export?${params}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (!res.ok) { alert('내보내기 실패'); return }
    const d = await res.json()
    const rows = d.records.map((r: any) => `<tr>
      <td>${r.record_date}</td>
      <td>${r.weight ?? '—'}</td>
      <td>${r.blood_pressure ?? '—'}</td>
      <td>${r.total_ultrafiltration ?? '—'}</td>
      <td>${r.fasting_blood_glucose ?? '—'}</td>
      <td>${r.turbid_peritoneal ? '탁함' : '맑음'}</td>
      <td>${r.risk_level || '—'}</td>
      <td style="max-width:120px;word-break:break-all">${r.memo || '—'}</td>
    </tr>`).join('')
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>CAPD — ${d.patient.name}</title>
<style>body{font-family:'Noto Sans KR',sans-serif;font-size:12px;color:#1a1a2e;margin:24px}
h1{font-size:17px;font-weight:900;margin:0 0 4px}.info{color:#6b7280;font-size:11px;margin-bottom:16px;line-height:1.8}
table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:7px 8px;text-align:left;font-size:11px;font-weight:700;border:1px solid #e5e7eb}
td{padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;vertical-align:top}tr:nth-child(even) td{background:#f9fafb}
@media print{body{margin:0}}</style></head><body>
<h1>CAPD 일일 기록 — ${d.patient.name} 환자</h1>
<div class="info">생년월일: ${d.patient.birth_date ?? '—'} | 성별: ${d.patient.gender ?? '—'} | 전화: ${d.patient.phone_number}<br>
병원: ${d.patient.hospital ?? '—'} | 담당의: ${d.doctor_name} | 기간: ${pdfStart || '전체'} ~ ${pdfEnd || '전체'}<br>
내보내기: ${new Date().toLocaleString('ko-KR')}</div>
<table><thead><tr><th>날짜</th><th>체중(kg)</th><th>혈압</th><th>제수량(mL)</th><th>혈당(mg/dL)</th><th>투석액</th><th>위험도</th><th>메모</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(480px, 92vw)', background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.14)', zIndex: 301,
        display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.22s ease',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: C.textMuted, fontFamily: 'inherit' }}>
            ✕ 닫기
          </button>
          {profile && (
            <>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{profile.name} 환자</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{profile.is_current_patient ? '현재 담당' : '과거 담당'}</div>
              </div>
              <button
                onClick={() => { onClose(); navigate(`/doctor/patients/${patientId}/records`, { state: { patientName: profile.name } }) }}
                style={{ marginLeft: 'auto', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                기록 보기 →
              </button>
            </>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading && <p style={{ color: C.textMuted, fontSize: 13 }}>불러오는 중...</p>}
          {err     && <p style={{ color: C.danger,    fontSize: 13 }}>오류: {err}</p>}
          {!loading && !err && profile && (
            <>
              <div style={{ background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text }}>기본 정보</h3>
                  <button
                    onClick={() => setShowPdf(v => !v)}
                    style={{ background: showPdf ? C.primary : '#f3f4f6', color: showPdf ? '#fff' : C.textMuted, border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}
                  >
                    📄 PDF
                  </button>
                </div>
                <InfoRow label="이름"     value={profile.name} />
                <InfoRow label="생년월일" value={profile.birth_date ? formatDate(profile.birth_date + 'T00:00:00') : null} />
                <InfoRow label="전화번호" value={profile.phone_number} />
                <InfoRow label="통원 병원" value={profile.hospital_name} />
                <InfoRow label="담당 의사" value={profile.doctor_name} />
                <InfoRow label="가입일"   value={profile.joined_at ? formatDate(profile.joined_at) : null} />
                {showPdf && (
                  <div style={{ marginTop: 12, padding: '12px', background: '#fff', borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>기록 기간 선택</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="date" value={pdfStart} onChange={e => setPdfStart(e.target.value)}
                        style={{ flex: 1, minWidth: 120, padding: '6px 8px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', color: C.text, outline: 'none' }} />
                      <span style={{ fontSize: 11, color: C.textMuted }}>~</span>
                      <input type="date" value={pdfEnd} onChange={e => setPdfEnd(e.target.value)}
                        style={{ flex: 1, minWidth: 120, padding: '6px 8px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: 'inherit', color: C.text, outline: 'none' }} />
                    </div>
                    <button onClick={handleExportPdf}
                      style={{ marginTop: 10, width: '100%', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      📄 PDF 내보내기
                    </button>
                  </div>
                )}
              </div>

              {trend.length >= 2 && (
                <div style={{ background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 14 }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.text }}>
                    최근 추이
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: C.textMuted }}>최근 14일</span>
                  </h3>
                  <Sparkline data={trend} field="weight" color={C.primary} label="체중" unit="kg" />
                  <Sparkline data={trend} field="total_ultrafiltration" color={C.success} label="제수량" unit="mL" />
                </div>
              )}

              <div style={{ background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: 14 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: C.text }}>
                  환자 본인 메모
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: C.textMuted }}>환자 직접 작성</span>
                </h3>
                {profile.self_memo
                  ? <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{profile.self_memo}</p>
                  : <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>작성된 메모가 없습니다.</p>}
              </div>

              <div style={{ background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 18px', marginBottom: profile.is_current_patient ? 14 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text }}>의사 메모</h3>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textMuted }}>환자에게 비공개 · AI 질문 생성에 활용</p>
                  </div>
                  <button onClick={handleSaveNote} disabled={saving || !noteChanged}
                    style={{ background: saved ? C.success : noteChanged ? C.primary : '#e5e7eb', color: noteChanged || saved ? '#fff' : C.textMuted, border: 'none', borderRadius: 7, padding: '6px 14px', cursor: noteChanged ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
                  </button>
                </div>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="이 환자에 대한 임상 메모를 입력하세요." rows={4}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${noteChanged ? C.primary : C.border}`, fontSize: 13, fontFamily: 'inherit', color: C.text, resize: 'vertical', outline: 'none', background: '#fafafa', lineHeight: 1.7, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                />
              </div>

              {profile.is_current_patient && (
                <div style={{ background: C.dangerLight, borderRadius: 12, border: '1px solid #fca5a5', padding: '14px 18px' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: C.danger }}>담당 해제</h3>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                    담당을 해제하면 이 환자는 기록을 제출할 수 없게 됩니다.<br />
                    재연결은 환자의 요청 후 승인을 통해 가능합니다.
                  </p>
                  <button onClick={handleDischarge} disabled={discharging}
                    style={{ background: C.danger, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: discharging ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: discharging ? 0.6 : 1 }}>
                    {discharging ? '처리 중...' : '🔓 담당 해제'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .clickable-name { display: inline-block; cursor: pointer; transition: color 0.12s; text-underline-offset: 3px; text-decoration-thickness: 1.5px; }
        .clickable-name:hover { color: var(--capd-primary); text-decoration: underline; }
        .clickable-name:active { color: var(--capd-primary-dark); transform: scale(0.97); }
        .patient-row:hover .clickable-name { color: var(--capd-primary); text-decoration: underline; }
        .patient-card:hover .clickable-name { color: var(--capd-primary); text-decoration: underline; }
        .patient-card:hover { border-color: var(--capd-primary) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.10) !important; }
      `}</style>
    </>
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
    fetch(`${API}/api/v1/patients/overview?scope=${sc}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) { localStorage.clear(); navigate('/login'); return null }
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
        <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>담당 환자 관리</h1>
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
                      <td style={{ padding: '12px 14px', color: C.textMuted }}><Highlight text={p.phone_number} query={query} /></td>
                      <td style={{ padding: '12px 14px' }}>
                        {p.latest_risk_level
                          ? <span style={{ background: RISK_CFG[p.latest_risk_level].bg, color: RISK_CFG[p.latest_risk_level].color, border: `1px solid ${RISK_CFG[p.latest_risk_level].border}`, borderRadius: 6, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{RISK_CFG[p.latest_risk_level].label}</span>
                          : <span style={{ fontSize: 12, color: C.textLight }}>없음</span>}
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
