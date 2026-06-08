import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useToast } from '../../hooks/useToast'
import { getHospitals, getDoctors } from '../../api/auth'
import type { Hospital, DoctorSummary } from '../../types'
import { formatPhone } from '../../utils/helpers'

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

function Sparkline({ data, field, color, label, unit }: {
  data: TrendPoint[]
  field: 'weight' | 'total_ultrafiltration'
  color: string; label: string; unit: string
}) {
  const [tooltip, setTooltip] = useState<{ idx: number } | null>(null)

  const filtered = data
    .filter(d => d[field] !== null)
    .map(d => ({ value: d[field] as number, date: d.record_date }))

  if (filtered.length < 2) return (
    <div style={{ fontSize: 11, color: C.textMuted, padding: '4px 0' }}>{label}: 데이터 부족</div>
  )

  const pts = filtered.map(d => d.value)
  const avg = pts.reduce((a, b) => a + b, 0) / pts.length
  const W = 200, CHART_H = 42, DATE_H = 14, PAD = 4
  const TOTAL_H = CHART_H + DATE_H

  const minV = Math.min(...pts), maxV = Math.max(...pts)
  const rangeV = maxV - minV || 1
  const xs = pts.map((_, i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2))
  const ys = pts.map(v => CHART_H - PAD - ((v - minV) / rangeV) * (CHART_H - PAD * 2))
  const polyPts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')

  // 날짜 눈금: 시작·중간·끝
  const axisIndices = filtered.length <= 2
    ? [0, filtered.length - 1]
    : [0, Math.round((filtered.length - 1) / 2), filtered.length - 1]
  const uniqueAxisIndices = [...new Set(axisIndices)]

  const fmtDate = (s: string) => {
    const p = s.split('-')
    return p.length >= 3 ? `${parseInt(p[1])}/${parseInt(p[2])}` : s
  }

  // 툴팁 계산
  const ttIdx = tooltip?.idx
  const ttX = ttIdx !== undefined ? xs[ttIdx] : null
  const ttY = ttIdx !== undefined ? ys[ttIdx] : null
  const ttVal = ttIdx !== undefined ? filtered[ttIdx].value : null
  const ttDate = ttIdx !== undefined ? filtered[ttIdx].date : null

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          <span style={{ fontSize: 10, fontWeight: 500, color: C.textMuted, marginRight: 2 }}>평균</span>
          {avg.toFixed(1)} {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${TOTAL_H}`} style={{ width: '100%', height: TOTAL_H, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`sg-${field}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 차트 영역 */}
        <polygon points={`${xs[0].toFixed(1)},${CHART_H} ${polyPts} ${xs[xs.length - 1].toFixed(1)},${CHART_H}`} fill={`url(#sg-${field})`} />
        <polyline points={polyPts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />

        {/* 날짜 눈금 */}
        {uniqueAxisIndices.map(idx => {
          const anchor = idx === 0 ? 'start' : idx === filtered.length - 1 ? 'end' : 'middle'
          return (
            <g key={`tick-${idx}`}>
              <line x1={xs[idx]} y1={CHART_H} x2={xs[idx]} y2={CHART_H + 3} stroke="#d1d5db" strokeWidth={0.8} />
              <text x={xs[idx]} y={TOTAL_H - 1} textAnchor={anchor} fontSize={10} fill="#6b7280" fontWeight={500}>
                {fmtDate(filtered[idx].date)}
              </text>
            </g>
          )
        })}

        {/* 데이터 포인트 (hover 영역 포함) */}
        {xs.map((x, i) => (
          <g key={i} onMouseEnter={() => setTooltip({ idx: i })} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'crosshair' }}>
            <circle cx={x} cy={ys[i]} r={10} fill="transparent" />
            <circle cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3.5 : 2} fill={color} stroke="#fff" strokeWidth={1} />
          </g>
        ))}

        {/* 툴팁 */}
        {tooltip !== null && ttX !== null && ttY !== null && ttVal !== null && ttDate !== null && (() => {
          const valStr = `${ttVal.toFixed(1)} ${unit}`
          const dateStr = fmtDate(ttDate)
          const BOX_W = 62, BOX_H = 28
          let bx = ttX - BOX_W / 2
          if (bx < 0) bx = 0
          if (bx + BOX_W > W) bx = W - BOX_W
          const by = Math.max(2, ttY - BOX_H - 7)
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={ttX} y1={by + BOX_H + 1} x2={ttX} y2={ttY - 4} stroke={color} strokeWidth={0.8} strokeDasharray="2,2" opacity={0.55} />
              <rect x={bx} y={by} width={BOX_W} height={BOX_H} rx={4} fill="rgba(26,26,46,0.88)" />
              <text x={bx + BOX_W / 2} y={by + 11} textAnchor="middle" fontSize={9.5} fill="#fff" fontWeight="700">{valStr}</text>
              <text x={bx + BOX_W / 2} y={by + 22} textAnchor="middle" fontSize={11} fill="rgba(200,210,230,0.95)">{dateStr}</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

export function PatientDrawer({ patientId, onClose, onDischarge, navigate }: {
  patientId: number; onClose: () => void
  onDischarge: (id: number) => void; navigate: ReturnType<typeof useNavigate>
}) {
  const [profile,     setProfile]     = useState<DrawerProfile | null>(null)
  const [note,        setNote]        = useState('')
  const [origNote,    setOrigNote]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const saveToast     = useToast(2000)
  const errToast      = useToast(3000)
  const handoverToast = useToast(2500)
  const [discharging, setDischarging] = useState(false)
  const [err,         setErr]         = useState('')
  const [trend,       setTrend]       = useState<TrendPoint[]>([])
  const [showPdf,     setShowPdf]     = useState(false)
  const [pdfStart,    setPdfStart]    = useState('')
  const [pdfEnd,      setPdfEnd]      = useState('')
  // 인수인계
  const [showHandover,    setShowHandover]    = useState(false)
  const [handoverHospitals, setHandoverHospitals] = useState<Hospital[]>([])
  const [handoverDoctors,   setHandoverDoctors]   = useState<DoctorSummary[]>([])
  const [handoverHosp,      setHandoverHosp]      = useState<number | ''>('')
  const [handoverDoc,       setHandoverDoc]        = useState<number | ''>('')
  const [handoverLoading,   setHandoverLoading]    = useState(false)
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
      setOrigNote(note); saveToast.show('saved')
    } catch (e: any) { errToast.show(e.message) } finally { setSaving(false) }
  }

  const openHandover = async () => {
    setShowHandover(true)
    if (handoverHospitals.length === 0) {
      const h = await getHospitals().catch(() => [])
      setHandoverHospitals(h)
    }
  }

  const handleHandoverHosp = async (id: number | '') => {
    setHandoverHosp(id); setHandoverDoc('')
    if (!id) { setHandoverDoctors([]); return }
    const docs = await getDoctors(Number(id)).catch(() => [])
    setHandoverDoctors(docs)
  }

  const handleHandover = async () => {
    if (!handoverDoc) { errToast.show('인수할 의사를 선택해주세요.'); return }
    if (!window.confirm(`${profile?.name} 환자를 선택한 의사에게 인수인계하시겠습니까?\n이 작업은 즉시 적용됩니다.`)) return
    setHandoverLoading(true)
    try {
      const res = await fetch(`${API}/api/v1/patients/${patientId}/handover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_doctor_id: handoverDoc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? '인수인계 실패')
      handoverToast.show(`✓ ${data.message ?? '인수인계 완료'}`)
      setTimeout(() => { onDischarge(patientId); onClose() }, 1200)
    } catch (e: any) { errToast.show(e.message) } finally { setHandoverLoading(false) }
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
      onDischarge(patientId); onClose()
    } catch (e: any) { errToast.show(e.message) } finally { setDischarging(false) }
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
    if (!res.ok) { errToast.show('내보내기 실패'); return }
    const d = await res.json()

    const labels   = d.records.map((r: any) => r.record_date)
    const weights  = d.records.map((r: any) => r.weight ?? null)
    const systolic = d.records.map((r: any) => {
      if (!r.blood_pressure) return null
      const m = String(r.blood_pressure).match(/^(\d+)/)
      return m ? Number(m[1]) : null
    })
    const uf      = d.records.map((r: any) => r.total_ultrafiltration ?? null)
    const glucose = d.records.map((r: any) => r.fasting_blood_glucose ?? null)

    const riskCount = { 긴급: 0, 주의: 0, 정상: 0 }
    d.records.forEach((r: any) => {
      if (r.risk_level === '긴급') riskCount.긴급++
      else if (r.risk_level === '주의') riskCount.주의++
      else if (r.risk_level === '정상') riskCount.정상++
    })

    const chartDataJson = JSON.stringify({ labels, weights, systolic, uf, glucose })

    const rows = d.records.map((r: any) => `<tr>
      <td>${r.record_date}</td>
      <td>${r.weight ?? '—'}</td>
      <td>${r.blood_pressure ?? '—'}</td>
      <td>${r.total_ultrafiltration ?? '—'}</td>
      <td>${r.fasting_blood_glucose ?? '—'}</td>
      <td>${r.turbid_peritoneal ? '탁함' : '맑음'}</td>
      <td class="risk-${r.risk_level}">${r.risk_level || '—'}</td>
      <td style="max-width:120px;word-break:break-all">${r.memo || '—'}</td>
    </tr>`).join('')

    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>CAPD — ${d.patient.name}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
*{box-sizing:border-box}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:12px;color:#1a1a2e;margin:28px 32px}
h1{font-size:18px;font-weight:900;margin:0 0 2px;color:#3b0764}
.subtitle{color:#7c3aed;font-size:12px;font-weight:700;margin-bottom:10px}
.info{color:#6b7280;font-size:11px;margin-bottom:20px;line-height:2;border-left:3px solid #7c3aed;padding-left:10px}
.section-title{font-size:13px;font-weight:800;color:#1a1a2e;margin:24px 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:4px}
.risk-summary{display:flex;gap:12px;margin-bottom:20px}
.risk-card{flex:1;border-radius:8px;padding:10px 14px;text-align:center}
.risk-card .num{font-size:22px;font-weight:900;line-height:1.2}
.risk-card .lbl{font-size:10px;font-weight:700;margin-top:2px}
.risk-card.urgent{background:#fef2f2;color:#dc2626}
.risk-card.caution{background:#fffbeb;color:#d97706}
.risk-card.normal{background:#f0fdf4;color:#16a34a}
.risk-card.none{background:#f3f4f6;color:#6b7280}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.chart-box{border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa}
.chart-label{font-size:10px;font-weight:700;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
canvas{width:100%!important;height:120px!important}
table{width:100%;border-collapse:collapse}
th{background:#f3f4f6;padding:7px 8px;text-align:left;font-size:11px;font-weight:700;border:1px solid #e5e7eb}
td{padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;vertical-align:top}
tr:nth-child(even) td{background:#f9fafb}
.risk-긴급{color:#dc2626;font-weight:700}
.risk-주의{color:#d97706;font-weight:700}
.risk-정상{color:#16a34a}
.footer{margin-top:16px;color:#9ca3af;font-size:10px;text-align:right}
@media print{
  body{margin:12px 16px}
  .charts{grid-template-columns:1fr 1fr 1fr}
  @page{size:A4;margin:15mm}
}
</style>
</head><body>
<h1>CAPD 일일 기록 요약지</h1>
<div class="subtitle">${d.patient.name} 환자</div>
<div class="info">
  생년월일: ${d.patient.birth_date ?? '—'} &nbsp;|&nbsp; 성별: ${d.patient.gender ?? '—'} &nbsp;|&nbsp; 전화: ${d.patient.phone_number}<br>
  병원: ${d.patient.hospital ?? '—'} &nbsp;|&nbsp; 담당의: ${d.doctor_name}<br>
  조회 기간: ${pdfStart || '전체'} ~ ${pdfEnd || '전체'} &nbsp;|&nbsp; 기록 수: ${d.records.length}건
</div>

<div class="section-title">위험도 분포</div>
<div class="risk-summary">
  <div class="risk-card urgent">
    <div class="num">${riskCount.긴급}</div>
    <div class="lbl">🔴 긴급</div>
  </div>
  <div class="risk-card caution">
    <div class="num">${riskCount.주의}</div>
    <div class="lbl">🟠 주의</div>
  </div>
  <div class="risk-card normal">
    <div class="num">${riskCount.정상}</div>
    <div class="lbl">🟢 정상</div>
  </div>
  <div class="risk-card none">
    <div class="num">${d.records.length - riskCount.긴급 - riskCount.주의 - riskCount.정상}</div>
    <div class="lbl">— 미분류</div>
  </div>
</div>

<div class="section-title">추세 그래프</div>
<div class="charts">
  <div class="chart-box">
    <div class="chart-label">체중 (kg)</div>
    <canvas id="chartWeight"></canvas>
  </div>
  <div class="chart-box">
    <div class="chart-label">혈압 수축기 (mmHg)</div>
    <canvas id="chartBP"></canvas>
  </div>
  <div class="chart-box">
    <div class="chart-label">제수량 (mL)</div>
    <canvas id="chartUF"></canvas>
  </div>
  <div class="chart-box">
    <div class="chart-label">공복혈당 (mg/dL)</div>
    <canvas id="chartGlucose"></canvas>
  </div>
</div>

<div class="section-title">상세 기록</div>
<table>
  <thead><tr>
    <th>날짜</th><th>체중(kg)</th><th>혈압</th><th>제수량(mL)</th>
    <th>혈당(mg/dL)</th><th>투석액</th><th>위험도</th><th>메모</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">내보내기: ${new Date().toLocaleString('ko-KR')}</div>

<script>
(function() {
  var data = ${chartDataJson};
  var labels = data.labels;
  var commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
      y: { ticks: { font: { size: 9 } }, grid: { color: '#f0f0f0' } }
    },
    elements: { point: { radius: 3, hitRadius: 5 }, line: { tension: 0.3 } }
  };
  function mkChart(id, label, vals, color) {
    new Chart(document.getElementById(id), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: label, data: vals, borderColor: color, backgroundColor: color + '22',
          fill: true, spanGaps: true, borderWidth: 2 }]
      },
      options: commonOpts
    });
  }
  mkChart('chartWeight',  '체중',     data.weights,  '#7c3aed');
  mkChart('chartBP',      '수축기혈압', data.systolic, '#dc2626');
  mkChart('chartUF',      '제수량',   data.uf,       '#2563eb');
  mkChart('chartGlucose', '공복혈당', data.glucose,  '#d97706');
  setTimeout(function(){ window.print(); }, 800);
})();
<\/script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close() }
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
                <InfoRow label="전화번호" value={formatPhone(profile.phone_number)} />
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
                    style={{ background: saveToast.message ? C.success : noteChanged ? C.primary : '#e5e7eb', color: noteChanged || saveToast.message ? '#fff' : C.textMuted, border: 'none', borderRadius: 7, padding: '6px 14px', cursor: noteChanged ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                    {saving ? '저장 중...' : saveToast.message ? '✓ 저장됨' : '저장'}
                  </button>
                </div>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="이 환자에 대한 임상 메모를 입력하세요." rows={4}
                  style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${noteChanged ? C.primary : C.border}`, fontSize: 13, fontFamily: 'inherit', color: C.text, resize: 'vertical', outline: 'none', background: '#fafafa', lineHeight: 1.7, boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                />
              </div>

              {profile.is_current_patient && (
                <>
                  {/* 인수인계 */}
                  <div style={{ background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', padding: '14px 18px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#1d4ed8' }}>인수인계</h3>
                    <p style={{ margin: '0 0 12px', fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                      다른 의사에게 이 환자를 즉시 이관합니다.<br />
                      이관 후 현재 담당이 자동으로 해제됩니다.
                    </p>
                    {!showHandover ? (
                      <button onClick={openHandover}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                        🔄 인수인계
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>병원 선택</label>
                          <select value={handoverHosp} onChange={e => handleHandoverHosp(Number(e.target.value) || '')}
                            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit' }}>
                            <option value="">병원을 선택하세요</option>
                            {handoverHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>인수할 의사</label>
                          <select value={handoverDoc} onChange={e => setHandoverDoc(Number(e.target.value) || '')}
                            disabled={!handoverHosp}
                            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', opacity: !handoverHosp ? 0.6 : 1 }}>
                            <option value="">{handoverHosp ? '의사를 선택하세요' : '먼저 병원을 선택하세요'}</option>
                            {handoverDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setShowHandover(false); setHandoverHosp(''); setHandoverDoc('') }}
                            style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12, fontWeight: 600, color: C.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
                            취소
                          </button>
                          <button onClick={handleHandover} disabled={handoverLoading || !handoverDoc}
                            style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none', background: (!handoverDoc || handoverLoading) ? '#e5e7eb' : '#2563eb', color: (!handoverDoc || handoverLoading) ? C.textMuted : '#fff', fontSize: 12, fontWeight: 700, cursor: (!handoverDoc || handoverLoading) ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                            {handoverLoading ? '처리 중...' : '이관하기'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 담당 해제 */}
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
                </>
              )}
            </>
          )}
        </div>

        {/* 토스트 알림 */}
        {(errToast.message || handoverToast.message) && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: handoverToast.message ? C.success : '#1f2937',
            color: '#fff', borderRadius: 10, padding: '10px 20px',
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,0.22)', zIndex: 10,
            animation: 'fadeInUp 0.2s ease',
          }}>
            {handoverToast.message || errToast.message}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeInUp { from { transform: translateX(-50%) translateY(10px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
      `}</style>
    </>
  )
}
