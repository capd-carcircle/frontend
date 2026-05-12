import { useState, useMemo } from 'react'
import type { DailyRecordCreate, DailyRecordResponse, ExchangeRecord } from '../../api/records'

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  textLight:    '#9ca3af',
}

const CONC_OPTIONS = [1.5, 2.5, 4.25]
const SESSIONS = [1, 2, 3, 4, 5]

// ── 빈 교환 기록 초기값 ────────────────────────────────────────
const emptyExchange = (session_number: number): ExchangeRecord => ({
  session_number,
  exchange_time: '',
  drainage_volume: undefined,
  infusion_concentration: undefined,
  infusion_weight: undefined,
  ultrafiltration: undefined,
})

const todayStr = () => new Date().toISOString().split('T')[0]

// 제수량 자동 계산: 배액량 - 주입량
const calcUF = (ex: ExchangeRecord): number | undefined => {
  if (ex.drainage_volume !== undefined && ex.infusion_weight !== undefined) {
    return ex.drainage_volume - ex.infusion_weight
  }
  return undefined
}

interface Props {
  onDraftSave: (data: DailyRecordCreate) => void
  onFinalSubmit: (data: DailyRecordCreate) => void
  isDraftLoading?: boolean
  isFinalLoading?: boolean
  initialData?: DailyRecordResponse
  isReadOnly?: boolean
}

export default function RecordForm({
  onDraftSave,
  onFinalSubmit,
  isDraftLoading = false,
  isFinalLoading = false,
  initialData,
  isReadOnly = false,
}: Props) {
  const [submitWarning, setSubmitWarning] = useState(false)

  // ── 교환 기록 초기화 ───────────────────────────────────────────
  const initExchanges = (): ExchangeRecord[] => {
    const base = SESSIONS.map(emptyExchange)
    if (!initialData) return base
    initialData.exchange_records.forEach((ex) => {
      const idx = ex.session_number - 1
      if (idx >= 0 && idx < 5) {
        base[idx] = {
          session_number:         ex.session_number,
          exchange_time:          ex.exchange_time ?? '',
          drainage_volume:        ex.drainage_volume,
          infusion_concentration: ex.infusion_concentration,
          infusion_weight:        ex.infusion_weight,
          ultrafiltration:        ex.ultrafiltration,
        }
      }
    })
    return base
  }

  const initBp = () => {
    if (!initialData?.blood_pressure) return { sys: '', dia: '' }
    const parts = initialData.blood_pressure.split('/')
    return { sys: parts[0] ?? '', dia: parts[1] ?? '' }
  }

  const [exchanges, setExchanges]         = useState<ExchangeRecord[]>(initExchanges)
  const [turbidPeritoneal, setTurbid]     = useState(initialData?.turbid_peritoneal ?? false)
  const [weight, setWeight]               = useState(initialData?.weight?.toString() ?? '')
  const [bpSystolic, setBpSystolic]       = useState(initBp().sys)
  const [bpDiastolic, setBpDiastolic]     = useState(initBp().dia)
  const [urineCount, setUrineCount]       = useState(initialData?.urine_count?.toString() ?? '')
  const [fastingGlucose, setFasting]      = useState(initialData?.fasting_blood_glucose?.toString() ?? '')
  const [memo, setMemo]                   = useState(initialData?.memo ?? '')

  // ── 수치 소프트 경고 (블락 아님, 참고용) ──────────────────────
  const softWarnings = useMemo(() => {
    if (isReadOnly) return []
    const warns: string[] = []
    const sys = parseInt(bpSystolic, 10)
    const dia = parseInt(bpDiastolic, 10)
    if (!isNaN(sys) && bpSystolic !== '') {
      if (sys > 200) warns.push(`수축기 혈압 ${sys} mmHg — 매우 높습니다. 값을 다시 확인해 주세요.`)
      else if (sys < 70) warns.push(`수축기 혈압 ${sys} mmHg — 매우 낮습니다. 값을 다시 확인해 주세요.`)
    }
    if (!isNaN(dia) && bpDiastolic !== '') {
      if (dia > 130) warns.push(`이완기 혈압 ${dia} mmHg — 매우 높습니다. 값을 다시 확인해 주세요.`)
      else if (dia < 40) warns.push(`이완기 혈압 ${dia} mmHg — 매우 낮습니다. 값을 다시 확인해 주세요.`)
    }
    const wt = parseFloat(weight)
    if (!isNaN(wt) && weight !== '') {
      if (wt > 200) warns.push(`체중 ${wt} kg — 값을 다시 확인해 주세요.`)
      else if (wt < 20) warns.push(`체중 ${wt} kg — 값을 다시 확인해 주세요.`)
    }
    const bg = parseFloat(fastingGlucose)
    if (!isNaN(bg) && fastingGlucose !== '') {
      if (bg > 500) warns.push(`공복혈당 ${bg} mg/dL — 매우 높습니다. 값을 다시 확인해 주세요.`)
      else if (bg < 40) warns.push(`공복혈당 ${bg} mg/dL — 매우 낮습니다. 값을 다시 확인해 주세요.`)
    }
    return warns
  }, [bpSystolic, bpDiastolic, weight, fastingGlucose, isReadOnly])

  // ── 교환 기록 셀 변경 핸들러 ──────────────────────────────────
  const handleExchange = (sessionIdx: number, field: keyof ExchangeRecord, value: string) => {
    if (isReadOnly) return
    setExchanges(prev => {
      const next = [...prev]
      const rec  = { ...next[sessionIdx] }
      if (field === 'exchange_time') {
        rec.exchange_time = value
      } else {
        const num = value === '' ? undefined : parseFloat(value)
        ;(rec as Record<string, unknown>)[field] = num
      }
      next[sessionIdx] = rec
      return next
    })
  }

  // 총 제수량 (auto-calc 합계)
  const totalUltrafiltration = exchanges.reduce((sum, ex) => sum + (calcUF(ex) ?? 0), 0)

  // ── 공통 페이로드 빌더 ─────────────────────────────────────────
  const buildPayload = (): DailyRecordCreate => {
    const validExchanges = exchanges
      .filter(ex =>
        ex.exchange_time ||
        ex.drainage_volume !== undefined ||
        ex.infusion_concentration !== undefined ||
        ex.infusion_weight !== undefined
      )
      .map(ex => ({ ...ex, ultrafiltration: calcUF(ex) }))

    return {
      record_date:           todayStr(),
      turbid_peritoneal:     turbidPeritoneal,
      weight:                weight ? parseFloat(weight) : undefined,
      blood_pressure:        bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : undefined,
      urine_count:           urineCount ? parseInt(urineCount, 10) : undefined,
      total_ultrafiltration: totalUltrafiltration || undefined,
      fasting_blood_glucose: fastingGlucose ? parseFloat(fastingGlucose) : undefined,
      memo:                  memo || undefined,
      exchange_records:      validExchanges,
    }
  }

  const filledExchangeCount = exchanges.filter(ex =>
    ex.exchange_time ||
    ex.drainage_volume !== undefined ||
    ex.infusion_concentration !== undefined ||
    ex.infusion_weight !== undefined
  ).length

  const handleDraftSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (isReadOnly) return
    onDraftSave(buildPayload())
  }

  const handleFinalSubmit = () => {
    if (isReadOnly) return
    setSubmitWarning(false)
    onFinalSubmit(buildPayload())
  }

  const handleFinalClick = () => {
    if (filledExchangeCount < 3) setSubmitWarning(true)
    else handleFinalSubmit()
  }

  // ── 셀 인풋 공통 스타일 ────────────────────────────────────────
  const cellInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '5px 1px',
    border: `1px solid ${C.border}`,
    borderRadius: 5,
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'inherit',
    color: C.text,
    background: isReadOnly ? C.bg : '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    minWidth: 0,
  }

  const thStyle: React.CSSProperties = {
    padding: '8px 2px',
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    background: C.primary,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }

  const tdLabelStyle: React.CSSProperties = {
    padding: '8px 6px',
    fontSize: 10,
    fontWeight: 600,
    color: C.textMuted,
    background: C.bg,
    borderRight: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }

  const tdCellStyle: React.CSSProperties = {
    padding: '4px 2px',
    borderRight: `1px solid ${C.border}`,
    textAlign: 'center',
    overflow: 'hidden',
  }

  const tdUFStyle = (val: number | undefined): React.CSSProperties => ({
    ...tdCellStyle,
    background: val !== undefined
      ? val >= 0 ? '#f0fdf4' : '#fef2f2'
      : C.bg,
  })

  return (
    <form onSubmit={handleDraftSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 투석 교환 기록 테이블 ───────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>투석 교환 기록</h2>
        </div>
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '22%' }} />{/* 항목 */}
              <col style={{ width: '15.6%' }} />{/* 1회차 */}
              <col style={{ width: '15.6%' }} />{/* 2회차 */}
              <col style={{ width: '15.6%' }} />{/* 3회차 */}
              <col style={{ width: '15.6%' }} />{/* 4회차 */}
              <col style={{ width: '15.6%' }} />{/* 5회차 */}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 10 }}>항목</th>
                {SESSIONS.map(n => (
                  <th key={n} style={thStyle}>{n}회차</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 교환 시간 */}
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={tdLabelStyle}>시간</td>
                {exchanges.map((ex, i) => (
                  <td key={i} style={tdCellStyle}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="--:--"
                      maxLength={5}
                      value={ex.exchange_time ?? ''}
                      onChange={e => {
                        let v = e.target.value.replace(/[^0-9:]/g, '')
                        if (v.length === 2 && !v.includes(':') && (ex.exchange_time ?? '').length < 2) v = v + ':'
                        handleExchange(i, 'exchange_time', v)
                      }}
                      readOnly={isReadOnly}
                      style={cellInputStyle}
                    />
                  </td>
                ))}
              </tr>
              {/* 농도 */}
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={tdLabelStyle}>농도 (%)</td>
                {exchanges.map((ex, i) => (
                  <td key={i} style={tdCellStyle}>
                    {isReadOnly ? (
                      <span style={{ fontSize: 13, color: C.text }}>{ex.infusion_concentration ?? '—'}</span>
                    ) : (
                      <select
                        value={ex.infusion_concentration ?? ''}
                        onChange={e => handleExchange(i, 'infusion_concentration', e.target.value)}
                        style={{ ...cellInputStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
                      >
                        <option value="">—</option>
                        {CONC_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </td>
                ))}
              </tr>
              {/* 주입량 */}
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={tdLabelStyle}>주입량 (g)</td>
                {exchanges.map((ex, i) => (
                  <td key={i} style={tdCellStyle}>
                    <input
                      type="number"
                      placeholder="—"
                      min="0"
                      value={ex.infusion_weight ?? ''}
                      onChange={e => handleExchange(i, 'infusion_weight', e.target.value)}
                      readOnly={isReadOnly}
                      style={cellInputStyle}
                    />
                  </td>
                ))}
              </tr>
              {/* 배액량 */}
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={tdLabelStyle}>배액량 (g)</td>
                {exchanges.map((ex, i) => (
                  <td key={i} style={tdCellStyle}>
                    <input
                      type="number"
                      placeholder="—"
                      min="0"
                      value={ex.drainage_volume ?? ''}
                      onChange={e => handleExchange(i, 'drainage_volume', e.target.value)}
                      readOnly={isReadOnly}
                      style={cellInputStyle}
                    />
                  </td>
                ))}
              </tr>
              {/* 제수량 (자동 계산) */}
              <tr>
                <td style={{ ...tdLabelStyle, color: C.primary, fontWeight: 700 }}>제수량 (g)</td>
                {exchanges.map((ex, i) => {
                  const uf = calcUF(ex)
                  return (
                    <td key={i} style={tdUFStyle(uf)}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: uf === undefined ? C.textLight
                          : uf >= 0 ? '#16a34a'
                          : '#dc2626',
                      }}>
                        {uf !== undefined ? uf : '—'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>
            💡 제수량 = 배액량 − 주입량 (자동 계산)
          </span>
          {totalUltrafiltration > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginLeft: 12 }}>
              총 제수량: {totalUltrafiltration}g
            </span>
          )}
        </div>
      </div>

      {/* ── 기타 기록 ───────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>기타 기록</h2>
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 14 }}>

          {/* 복막액 혼탁 */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
              복막액 혼탁 여부
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: '정상', value: false, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
                { label: '혼탁', value: true,  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
              ].map(opt => {
                const active = turbidPeritoneal === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => { if (!isReadOnly) setTurbid(opt.value) }}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      borderRadius: 9,
                      border: `1.5px solid ${active ? opt.border : C.border}`,
                      background: active ? opt.bg : '#fff',
                      color: active ? opt.color : C.textMuted,
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      cursor: isReadOnly ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 체중 */}
          <Field
            label="체중 (kg)"
            type="number"
            placeholder="예) 62.5"
            step="0.1"
            value={weight}
            onChange={e => { if (!isReadOnly) setWeight(e.target.value) }}
            readOnly={isReadOnly}
          />

          {/* 혈압 — 수축기/이완기 두 칸이라 전체 너비 사용 */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
              혈압 (mmHg)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                placeholder="수축기"
                min="0"
                value={bpSystolic}
                onChange={e => { if (!isReadOnly) setBpSystolic(e.target.value) }}
                readOnly={isReadOnly}
                style={{
                  flex: 1, padding: '10px 10px', borderRadius: 9,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  fontFamily: 'inherit', color: C.text, outline: 'none',
                  background: isReadOnly ? C.bg : '#fff', textAlign: 'center',
                }}
              />
              <span style={{ color: C.textMuted, fontWeight: 700 }}>/</span>
              <input
                type="number"
                placeholder="이완기"
                min="0"
                value={bpDiastolic}
                onChange={e => { if (!isReadOnly) setBpDiastolic(e.target.value) }}
                readOnly={isReadOnly}
                style={{
                  flex: 1, padding: '10px 10px', borderRadius: 9,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  fontFamily: 'inherit', color: C.text, outline: 'none',
                  background: isReadOnly ? C.bg : '#fff', textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* 소변 횟수 */}
          <Field
            label="소변 횟수"
            type="number"
            placeholder="예) 3"
            value={urineCount}
            onChange={e => { if (!isReadOnly) setUrineCount(e.target.value) }}
            readOnly={isReadOnly}
          />

          {/* 공복혈당 */}
          <Field
            label="공복혈당 (mg/dL)"
            type="number"
            placeholder="예) 105"
            value={fastingGlucose}
            onChange={e => { if (!isReadOnly) setFasting(e.target.value) }}
            readOnly={isReadOnly}
          />

          {/* 총 제수량 (읽기 전용 자동 계산) */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
              총 제수량 (g)
            </label>
            <input
              type="text"
              value={totalUltrafiltration > 0 ? `${totalUltrafiltration}g` : ''}
              placeholder="교환 기록에서 자동 계산"
              readOnly
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 9,
                border: `1.5px solid ${C.border}`, fontSize: 13,
                fontFamily: 'inherit', color: C.primary, fontWeight: 700,
                background: C.bg, outline: 'none',
              }}
            />
          </div>

        </div>

        {/* 메모 */}
        <div style={{ padding: '0 16px 16px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>
            메모 (특이사항)
          </label>
          <textarea
            placeholder="특이사항이 있으면 입력해 주세요."
            rows={3}
            value={memo}
            onChange={e => { if (!isReadOnly) setMemo(e.target.value) }}
            readOnly={isReadOnly}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 9,
              border: `1.5px solid ${C.border}`, fontSize: 13,
              fontFamily: 'inherit', color: C.text, outline: 'none',
              background: isReadOnly ? C.bg : '#fff', resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* ── 수치 소프트 경고 배너 ────────────────────────────────── */}
      {!isReadOnly && softWarnings.length > 0 && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 12,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', margin: 0 }}>
            ⚠ 입력값 확인
          </p>
          {softWarnings.map((w, i) => (
            <p key={i} style={{ fontSize: 13, color: '#b45309', margin: 0 }}>• {w}</p>
          ))}
          <p style={{ fontSize: 12, color: '#92400e', margin: 0, marginTop: 2 }}>
            실제 측정값이 맞다면 그대로 제출하셔도 됩니다.
          </p>
        </div>
      )}

      {/* ── 버튼 영역 ─────────────────────────────────────────────── */}
      {!isReadOnly && (
        <div>
          {/* 경고 메시지 */}
          {submitWarning && (
            <div style={{
              marginBottom: 14, padding: '14px 16px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fcd34d',
              borderRadius: 12, fontSize: 13, color: '#92400e',
            }}>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>⚠ 교환 기록이 {filledExchangeCount}회차만 입력되었어요</p>
              <p style={{ marginBottom: 12 }}>
                하루 3회 미만은 투석이 부족할 수 있습니다.<br />
                그래도 지금 최종 제출하시겠어요?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isFinalLoading}
                  style={{
                    flex: 1, padding: '9px 0',
                    background: '#d97706', color: '#fff',
                    border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    cursor: isFinalLoading ? 'not-allowed' : 'pointer',
                    opacity: isFinalLoading ? 0.6 : 1,
                  }}
                >
                  {isFinalLoading ? '제출 중...' : '그래도 제출하기'}
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitWarning(false)}
                  style={{
                    flex: 1, padding: '9px 0',
                    background: '#fff', color: C.textMuted,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  계속 입력하기
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {/* 임시저장 */}
            <button
              type="submit"
              disabled={isDraftLoading || isFinalLoading}
              style={{
                flex: 1, padding: '13px 0',
                background: '#fff', color: C.primary,
                border: `1.5px solid ${C.primary}`, borderRadius: 11,
                fontSize: 14, fontWeight: 700,
                cursor: isDraftLoading ? 'not-allowed' : 'pointer',
                opacity: isDraftLoading ? 0.6 : 1,
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              className="capd-btn-outline-hover"
            >
              {isDraftLoading ? '저장 중...' : '오늘 기록 저장'}
            </button>

            {/* 최종 제출 */}
            <button
              type="button"
              onClick={handleFinalClick}
              disabled={isDraftLoading || isFinalLoading}
              style={{
                flex: 2, padding: '13px 0',
                background: C.primary, color: '#fff',
                border: 'none', borderRadius: 11,
                fontSize: 14, fontWeight: 700,
                cursor: isFinalLoading ? 'not-allowed' : 'pointer',
                opacity: isFinalLoading ? 0.6 : 1,
                fontFamily: 'inherit', transition: 'opacity 0.15s',
              }}
              className="capd-btn-hover"
            >
              {isFinalLoading ? '제출 중...' : '최종 제출하기 →'}
            </button>
          </div>

          <p style={{ margin: '10px 0 0', fontSize: 12, color: C.textLight, textAlign: 'center' }}>
            * 최종 제출 후 후속 설문이 이어집니다.
          </p>
        </div>
      )}
    </form>
  )
}

// ── 재사용 필드 컴포넌트 ──────────────────────────────────────────
function Field({
  label, type, placeholder, step, value, onChange, readOnly,
}: {
  label: string
  type?: string
  placeholder?: string
  step?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  readOnly?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
        {label}
      </label>
      <input
        type={type ?? 'text'}
        placeholder={placeholder}
        step={step}
        min="0"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 9,
          border: `1.5px solid ${focused ? 'var(--capd-primary)' : 'var(--capd-border)'}`,
          fontSize: 13, fontFamily: 'inherit', color: '#1a1a2e',
          background: readOnly ? 'var(--capd-bg)' : '#fff',
          outline: 'none', transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
