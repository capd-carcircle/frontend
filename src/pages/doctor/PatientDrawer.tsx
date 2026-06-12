import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useToast } from '../../hooks/useToast'
import { getHospitals, getDoctors } from '../../api/auth'
import type { Hospital, DoctorSummary } from '../../types'
import { formatPhone } from '../../utils/helpers'
import { apiFetch } from '../../api/apiFetch'

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
  birth_date: string | null; gender: string | null
  hospital_name: string | null
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
  const [showPdf,          setShowPdf]          = useState(false)
  const [pdfStart,         setPdfStart]         = useState('')
  const [pdfEnd,           setPdfEnd]           = useState('')
  const [lastReportEndDate, setLastReportEndDate] = useState<string | null>(null)
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
      apiFetch(`${API}/api/v1/patients/${patientId}/profile`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => { if (!r.ok) throw new Error('프로필 오류'); return r.json() }),
      apiFetch(`${API}/api/v1/patients/${patientId}/note`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => { if (!r.ok) throw new Error('메모 오류'); return r.json() }),
      apiFetch(`${API}/api/v1/patients/${patientId}/trend?days=14`, { headers: { Authorization: `Bearer ${t}` } })
        .then(r => r.ok ? r.json() : []),
    ])
      .then(([profileData, noteData, trendData]) => {
        setProfile(profileData)
        const c = noteData.content ?? ''; setNote(c); setOrigNote(c)
        setLastReportEndDate(noteData.last_report_end_date ?? null)
        setTrend(trendData)
        // 기본 날짜: 종료=오늘, 시작=환자 가입일
        const today = new Date().toISOString().slice(0, 10)
        setPdfEnd(today)
        if (profileData.joined_at) setPdfStart(profileData.joined_at.slice(0, 10))
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [patientId])

  const handleSaveNote = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`${API}/api/v1/patients/${patientId}/note`, {
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
      const res = await apiFetch(`${API}/api/v1/patients/${patientId}/handover`, {
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
      const res = await apiFetch(`${API}/api/v1/patients/${patientId}/discharge`, {
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
    const res = await apiFetch(`${API}/api/v1/patients/${patientId}/records-export?${params}`, {
      headers: { Authorization: `Bearer ${t}` },
    })
    if (!res.ok) { errToast.show('요약지 생성 실패'); return }
    const d = await res.json()

    // 요약지 생성 날짜 서버에 저장
    const saveEnd = pdfEnd || new Date().toISOString().slice(0, 10)
    apiFetch(`${API}/api/v1/patients/${patientId}/report-end-date`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_date: saveEnd }),
    }).then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.last_report_end_date) setLastReportEndDate(data.last_report_end_date) })
      .catch(() => {})

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
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3/dist/chartjs-adapter-date-fns.bundle.min.js"><\/script>
<style>
*{box-sizing:border-box}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;color:#1a1a2e;margin:28px 32px}
.header-block{background:linear-gradient(135deg,#3b0764 0%,#6d28d9 100%);color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:24px}
.header-block .doc-label{font-size:12px;font-weight:600;letter-spacing:1.5px;opacity:.75;margin-bottom:6px;text-transform:uppercase}
.header-block h1{font-size:24px;font-weight:900;margin:0 0 4px;color:#fff;letter-spacing:-.02em}
.header-block .patient-name{font-size:18px;font-weight:700;color:#e9d5ff;margin-bottom:14px}
.header-block .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px}
.header-block .info-item{font-size:13px;color:rgba(255,255,255,.82);line-height:1.7}
.header-block .info-item span{font-weight:700;color:#fff}
.section-title{font-size:16px;font-weight:800;color:#1a1a2e;margin:24px 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:4px}
.risk-summary{display:flex;gap:12px;margin-bottom:20px}
.risk-card{flex:1;border-radius:8px;padding:10px 14px;text-align:center}
.risk-card .num{font-size:26px;font-weight:900;line-height:1.2}
.risk-card .lbl{font-size:13px;font-weight:700;margin-top:2px}
.risk-card.urgent{background:#fef2f2;color:#dc2626}
.risk-card.caution{background:#fffbeb;color:#d97706}
.risk-card.normal{background:#f0fdf4;color:#16a34a}
.risk-card.none{background:#f3f4f6;color:#6b7280}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.chart-box{border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa}
.chart-label{font-size:13px;font-weight:700;color:#6b7280;margin-bottom:6px;letter-spacing:.3px}
canvas{width:100%!important;height:200px!important}
table{width:100%;border-collapse:collapse}
th{background:#f3f4f6;padding:8px 10px;text-align:left;font-size:14px;font-weight:700;border:1px solid #e5e7eb}
td{padding:8px 10px;border:1px solid #e5e7eb;font-size:14px;vertical-align:top}
tr:nth-child(even) td{background:#f9fafb}
.risk-긴급{color:#dc2626;font-weight:700}
.risk-주의{color:#d97706;font-weight:700}
.risk-정상{color:#16a34a}
.footer{margin-top:16px;color:#9ca3af;font-size:13px;text-align:right}
.print-bar{position:sticky;top:0;z-index:10;background:#fff;border-bottom:1px solid #e5e7eb;padding:10px 0 10px;margin-bottom:20px;display:flex;gap:8px;align-items:center}
.print-btn{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:9px 22px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
.print-btn:hover{background:#6d28d9}
@media print{
  body{margin:12px 16px}
  .print-bar{display:none}
  .charts{grid-template-columns:1fr 1fr}
  .chart-box{break-inside:avoid}
  canvas{width:100%!important;height:200px!important;max-height:200px!important}
  @page{size:A4;margin:15mm}
}
</style>
</head><body>
<div class="print-bar">
  <button class="print-btn" onclick="window.print()">🖨️ PDF 내보내기</button>
  <span style="color:#6b7280;font-size:13px">미리보기 — 인쇄하거나 PDF로 저장하세요</span>
</div>
<div class="header-block">
  <div class="doc-label">CAPD 일일 기록 요약지</div>
  <h1>${d.patient.name} 환자</h1>
  <div class="info-grid">
    <div class="info-item">생년월일 <span>${d.patient.birth_date ?? '—'}</span></div>
    <div class="info-item">성별 <span>${d.patient.gender ?? '—'}</span></div>
    <div class="info-item">연락처 <span>${formatPhone(d.patient.phone_number)}</span></div>
    <div class="info-item">병원 <span>${d.patient.hospital ?? '—'}</span></div>
    <div class="info-item">담당의 <span>${d.doctor_name}</span></div>
    <div class="info-item">기록 수 <span>${d.records.length}건</span></div>
    <div class="info-item" style="grid-column:1/-1">조회 기간 <span>${pdfStart || '전체'} ~ ${pdfEnd || '전체'}</span></div>
  </div>
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

  // 평균값을 점선 오른쪽 끝 + 왼쪽 Y축에 색깔로 표기하는 플러그인
  var avgLabelPlugin = {
    id: 'avgLabel',
    afterDraw: function(chart) {
      var ctx = chart.ctx;
      chart.data.datasets.forEach(function(ds, i) {
        if (!ds._isAvg || !ds.data.length) return;
        var meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        var yVal = ds.data[0].y;
        var yPixel = chart.scales.y.getPixelForValue(yVal);
        var xLeft  = chart.chartArea.left;
        var xRight = chart.chartArea.right;
        ctx.save();
        ctx.font = 'bold 11px Apple SD Gothic Neo, Malgun Gothic, sans-serif';
        ctx.fillStyle = ds.borderColor;
        // 오른쪽 끝 레이블
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('평균 ' + yVal.toFixed(1), xRight - 2, yPixel - 2);
        // 왼쪽 Y축 레이블
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(yVal.toFixed(1), xLeft - 4, yPixel);
        ctx.restore();
      });
    }
  };
  Chart.register(avgLabelPlugin);

  var commonOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        bodyFont: { size: 12 },
        titleFont: { size: 12 },
        filter: function(item) { return !item.dataset._isAvg; },
        callbacks: {
          title: function(items) {
            if (!items.length) return '';
            var d = new Date(items[0].parsed.x);
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
          },
          label: function(item) {
            var unit = item.dataset._unit || '';
            return item.dataset.label + ': ' + item.parsed.y + unit;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day', displayFormats: { day: 'M/d' } },
        ticks: { font: { size: 11 }, maxRotation: 60, autoSkip: false },
        grid: { display: false }
      },
      y: {
        ticks: { font: { size: 12 } },
        grid: { color: '#f0f0f0' }
      }
    },
    elements: { point: { radius: 4, hitRadius: 12, hoverRadius: 6 }, line: { tension: 0 } }
  };

  function mkChart(id, label, vals, color, unit) {
    var points = labels.map(function(d, i) {
      return (vals[i] !== null && vals[i] !== undefined) ? { x: d, y: vals[i] } : null;
    }).filter(Boolean);

    var sum = points.reduce(function(a, p) { return a + p.y; }, 0);
    var avg = points.length ? sum / points.length : null;

    var datasets = [{
      label: label,
      data: points,
      borderColor: color,
      backgroundColor: 'transparent',
      fill: false,
      spanGaps: false,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 7,
      _unit: unit,
      _isAvg: false
    }];

    if (avg !== null) {
      datasets.push({
        label: '',
        data: labels.map(function(d) { return { x: d, y: avg }; }),
        borderColor: color,
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
        spanGaps: true,
        _isAvg: true,
        _unit: unit
      });
    }

    new Chart(document.getElementById(id), {
      type: 'line',
      data: { datasets: datasets },
      options: commonOpts
    });
  }

  mkChart('chartWeight',  '체중',     data.weights,  '#7c3aed', 'kg');
  mkChart('chartBP',      '수축기혈압', data.systolic, '#dc2626', 'mmHg');
  mkChart('chartUF',      '제수량',   data.uf,       '#2563eb', 'mL');
  mkChart('chartGlucose', '공복혈당', data.glucose,  '#d97706', 'mg/dL');

  // 프린트 시 Chart.js 캔버스 비율 깨짐 방지
  window.addEventListener('beforeprint', function() {
    Object.values(Chart.instances).forEach(function(chart) {
      chart.canvas.style.height = '200px';
      chart.canvas.height = 200;
      chart.resize(chart.canvas.offsetWidth, 200);
    });
  });
  window.addEventListener('afterprint', function() {
    Object.values(Chart.instances).forEach(function(chart) {
      chart.resize();
    });
  });
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
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button
                  onClick={() => { onClose(); navigate(`/doctor/patients/${patientId}/records`, { state: { patientName: profile.name, patientBirthDate: profile.birth_date, patientGender: profile.gender, patientPhone: profile.phone_number } }) }}
                  style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                >
                  기록 보기 →
                </button>
              </div>
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
                    style={{ background: showPdf ? C.primary : C.primaryLight, color: showPdf ? '#fff' : C.primary, border: `1.5px solid ${C.primary}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
                  >
                    📋 기간별 요약
                  </button>
                </div>
                <InfoRow label="이름"     value={profile.name} />
                <InfoRow label="생년월일" value={profile.birth_date ? formatDate(profile.birth_date + 'T00:00:00') : null} />
                <InfoRow label="전화번호" value={formatPhone(profile.phone_number)} />
                <InfoRow label="통원 병원" value={profile.hospital_name} />
                <InfoRow label="담당 의사" value={profile.doctor_name} />
                <InfoRow label="가입일"   value={profile.joined_at ? formatDate(profile.joined_at) : null} />
                {showPdf && (
                  <div style={{ marginTop: 12, padding: '14px', background: '#faf5ff', borderRadius: 10, border: `1.5px solid ${C.primary}22` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>기록 기간 선택</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="date" value={pdfStart} onChange={e => setPdfStart(e.target.value)}
                        style={{ flex: 1, minWidth: 120, padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', color: C.text, outline: 'none', background: '#fff' }} />
                      <span style={{ fontSize: 12, color: C.textMuted }}>~</span>
                      <input type="date" value={pdfEnd} onChange={e => setPdfEnd(e.target.value)}
                        style={{ flex: 1, minWidth: 120, padding: '7px 9px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', color: C.text, outline: 'none', background: '#fff' }} />
                    </div>
                    {lastReportEndDate && (() => {
                      // 마지막 생성 end_date 다음날 계산
                      const next = new Date(lastReportEndDate)
                      next.setDate(next.getDate() + 1)
                      const nextStr = next.toISOString().slice(0, 10)
                      const today = new Date().toISOString().slice(0, 10)
                      if (nextStr > today) return null
                      return (
                        <button
                          onClick={() => { setPdfStart(nextStr); setPdfEnd(today) }}
                          style={{ marginTop: 8, background: 'none', border: `1px solid ${C.primary}`, color: C.primary, borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          ↩ 이어서 ({nextStr} ~ {today})
                        </button>
                      )
                    })()}
                    {lastReportEndDate && (
                      <div style={{ marginTop: 6, fontSize: 11, color: C.textMuted }}>
                        마지막 요약지 생성: ~{lastReportEndDate}
                      </div>
                    )}
                    <button onClick={handleExportPdf}
                      style={{ marginTop: 12, width: '100%', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                      📋 요약지 생성
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
                  <div style={{ background: C.dangerLight, borderRadius: 12, border: '1px solid #fca5a5', padding: '14px 18px', marginTop: 16 }}>
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
