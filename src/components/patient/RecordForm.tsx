import { useState, useMemo } from 'react'
import type { DailyRecordCreate, DailyRecordResponse, ExchangeRecord } from '../../api/records'

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  bgCard:       'var(--bg-card)',
  border:       'var(--capd-border)',
  text:         'var(--text-main)',
  textMuted:    'var(--text-sub)',
  textLight:    'var(--text-muted)',
  success:      'var(--success)',
  successLight: 'var(--success-light)',
  warning:      'var(--warning)',
  warningLight: 'var(--warning-light)',
  danger:       'var(--danger)',
  dangerLight:  'var(--danger-light)',
}

const SESSIONS = [1, 2, 3, 4, 5]

const emptyExchange = (session_number: number): ExchangeRecord => ({
  session_number,
  exchange_time: '',
  drainage_volume: undefined,
  infusion_concentration: undefined,
  infusion_weight: undefined,
  ultrafiltration: undefined,
})

const todayStr = () => new Date().toISOString().split('T')[0]

const calcUF = (ex: ExchangeRecord): number | undefined => {
  if (ex.drainage_volume !== undefined && ex.infusion_weight !== undefined)
    return ex.drainage_volume - ex.infusion_weight
  return undefined
}

const nowTimeStr = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Props {
  onDraftSave: (data: DailyRecordCreate) => void
  onFinalSubmit: (data: DailyRecordCreate) => void
  isDraftLoading?: boolean
  isFinalLoading?: boolean
  initialData?: DailyRecordResponse
  isReadOnly?: boolean
}

// ── 스테퍼 컴포넌트 (직접 입력 + 버튼 병행) ─────────────────────
function Stepper({
  label, value, onChange, step, min, max, unit, readOnly, isDecimal, startAt,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  step: number
  min: number
  max?: number
  unit: string
  readOnly?: boolean
  isDecimal?: boolean
  startAt?: number
}) {
  const [raw, setRaw] = useState(value !== undefined ? String(value) : '')

  // 외부 값이 바뀌면 raw도 동기화
  const displayStr = value !== undefined ? String(value) : ''
  if (raw !== displayStr && document.activeElement?.tagName !== 'INPUT') {
    // 포커스 없을 때만 동기화 (타이핑 중 방해 방지)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setRaw(v)
    if (v === '' || v === '-') { onChange(undefined); return }
    const num = isDecimal ? parseFloat(v) : parseInt(v, 10)
    if (!isNaN(num)) {
      const clamped = max !== undefined ? Math.min(num, max) : num
      onChange(clamped)
      if (clamped !== num) setRaw(String(clamped))
    }
  }

  const handleBlur = () => {
    // 포커스 벗어날 때 값 정리
    if (value !== undefined) setRaw(String(value))
    else setRaw('')
  }

  const stepDown = () => {
    const cur = value ?? startAt ?? 0
    const next = Math.round((cur - step) * 100) / 100
    const clamped = Math.max(min, next)
    onChange(clamped === 0 && min === 0 ? undefined : clamped)
    setRaw(clamped === 0 && min === 0 ? '' : String(clamped))
  }

  const stepUp = () => {
    const cur = value ?? startAt ?? (min > 0 ? min - step : 0)
    const next = Math.round((cur + step) * 100) / 100
    const clamped = max !== undefined ? Math.min(next, max) : next
    onChange(clamped)
    setRaw(String(clamped))
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!readOnly && (
          <button type="button" onClick={stepDown} style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            border: `1.5px solid ${C.border}`, background: '#fff',
            fontSize: step >= 10 ? 13 : 24, fontWeight: step >= 10 ? 700 : 300, color: C.textMuted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>−{step >= 10 ? step : ''}</button>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            inputMode={isDecimal ? 'decimal' : 'numeric'}
            pattern={isDecimal ? '[0-9.]*' : '[0-9]*'}
            value={readOnly ? (value !== undefined ? String(value) : '—') : raw}
            onChange={handleInput}
            onBlur={handleBlur}
            readOnly={readOnly}
            placeholder={startAt !== undefined ? String(startAt) : '—'}
            style={{
              width: '100%', height: 52, borderRadius: 12, boxSizing: 'border-box',
              border: `1.5px solid ${C.border}`,
              background: readOnly ? C.bg : '#fff',
              fontSize: 18, fontWeight: 700, color: value !== undefined ? C.text : C.textLight,
              textAlign: 'center', outline: 'none', fontFamily: 'inherit',
              paddingRight: unit ? `${unit.length * 14 + 8}px` : '12px',
              paddingLeft: '12px',
            }}
          />
          {unit && (
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: C.textMuted, pointerEvents: 'none',
            }}>{unit}</span>
          )}
        </div>
        {!readOnly && (
          <button type="button" onClick={stepUp} style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            border: `1.5px solid ${C.primary}`, background: C.primary,
            fontSize: step >= 10 ? 13 : 24, fontWeight: step >= 10 ? 700 : 300, color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+{step >= 10 ? step : ''}</button>
        )}
      </div>
    </div>
  )
}

// 유효한 농도값 (CAPD 투석액: 1.5 / 2.5 / 4.25 %)
const VALID_CONCENTRATIONS = [1.5, 2.5, 4.25]
const MAX_CONCENTRATION = 6

// 시간 문자열 유효성 검사 (HH:MM, 00:00~23:59)
const isValidTime = (t: string): boolean => {
  if (!/^\d{2}:\d{2}$/.test(t)) return false
  const [h, m] = t.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

// ── 농도 입력 필드 ───────────────────────────────────────────────
function ConcInput({
  value, onChange, readOnly,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  readOnly?: boolean
}) {
  const [raw, setRaw] = useState(value !== undefined ? String(value) : '')
  const [warn, setWarn] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    setRaw(v)
    setWarn('')
    if (v === '' || v === '.') { onChange(undefined); return }
    const num = parseFloat(v)
    if (!isNaN(num)) {
      if (num > MAX_CONCENTRATION) {
        setWarn(`농도는 ${MAX_CONCENTRATION}% 이하여야 합니다.`)
        return // 값 적용 안 함
      }
      onChange(num)
    }
  }

  const handleBlur = () => {
    if (value !== undefined) {
      setRaw(String(value))
      // 권장 농도가 아닌 경우 경고 (부드러운 안내)
      if (!VALID_CONCENTRATIONS.includes(value)) {
        setWarn(`일반적인 CAPD 농도는 1.5 / 2.5 / 4.25 % 입니다.`)
      } else {
        setWarn('')
      }
    } else {
      setRaw('')
      setWarn('')
    }
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
        농도 (%)
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9.]*"
          placeholder="예) 1.5 / 2.5 / 4.25"
          value={readOnly ? (value !== undefined ? String(value) : '—') : raw}
          onChange={handleChange}
          onBlur={handleBlur}
          readOnly={readOnly}
          style={{
            width: '100%', height: 60, borderRadius: 12, boxSizing: 'border-box',
            border: `1.5px solid ${warn ? C.danger : value !== undefined ? C.primary : C.border}`,
            background: readOnly ? C.bg : '#fff',
            fontSize: 22, fontWeight: 700,
            color: value !== undefined ? C.text : C.textLight,
            textAlign: 'center', outline: 'none', fontFamily: 'inherit',
            paddingRight: '40px', paddingLeft: '12px',
          }}
        />
        <span style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, color: C.textMuted, pointerEvents: 'none',
        }}>%</span>
      </div>
      {warn && !readOnly && (
        <p style={{ margin: '5px 0 0', fontSize: 12, color: C.warning }}>{warn}</p>
      )}
    </div>
  )
}

// ── 큰 입력 필드 ─────────────────────────────────────────────────
function BigField({
  label, placeholder, value, onChange, readOnly, unit,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  readOnly?: boolean
  unit?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, height: 52, padding: '0 14px', borderRadius: 12,
            border: `1.5px solid ${focused ? 'var(--capd-primary)' : 'var(--capd-border)'}`,
            fontSize: 16, fontFamily: 'inherit', color: C.text,
            background: readOnly ? C.bg : '#fff',
            outline: 'none', transition: 'border-color 0.15s',
            boxSizing: 'border-box',
          }}
        />
        {unit && <span style={{ fontSize: 14, color: C.textMuted, flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  )
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
  const [activeSession, setActiveSession] = useState(0)

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

  const [exchanges, setExchanges]     = useState<ExchangeRecord[]>(initExchanges)
  const [resetKeys, setResetKeys]     = useState<Record<number, number>>({})
  const [turbidPeritoneal, setTurbid] = useState(initialData?.turbid_peritoneal ?? false)
  const [weight, setWeight]           = useState<number | undefined>(initialData?.weight ?? undefined)
  const [bpSystolic, setBpSystolic]   = useState(initBp().sys)
  const [bpDiastolic, setBpDiastolic] = useState(initBp().dia)
  const [urineCount, setUrineCount]   = useState<number | undefined>(initialData?.urine_count ?? undefined)
  const [fastingGlucose, setFasting]  = useState(initialData?.fasting_blood_glucose?.toString() ?? '')
  const [memo, setMemo]               = useState(initialData?.memo ?? '')

  // 교환 기록 필드 업데이트
  const updateExchange = (idx: number, patch: Partial<ExchangeRecord>) => {
    if (isReadOnly) return
    setExchanges(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  const totalUltrafiltration = exchanges.reduce((sum, ex) => sum + (calcUF(ex) ?? 0), 0)

  // 한 개라도 입력됐으면 true (탭 점 표시용)
  const isFilled = (ex: ExchangeRecord) =>
    !!(ex.exchange_time || ex.drainage_volume !== undefined ||
       ex.infusion_concentration !== undefined || ex.infusion_weight !== undefined)

  // 4개 필수 필드 모두 입력됐을 때만 true (실제 제출 포함 여부)
  const isComplete = (ex: ExchangeRecord) =>
    !!(ex.exchange_time &&
       isValidTime(ex.exchange_time) &&
       ex.infusion_concentration !== undefined &&
       ex.infusion_concentration <= MAX_CONCENTRATION &&
       ex.infusion_weight !== undefined &&
       ex.drainage_volume !== undefined)

  const softWarnings = useMemo(() => {
    if (isReadOnly) return []
    const warns: string[] = []
    const sys = parseInt(bpSystolic, 10)
    const dia = parseInt(bpDiastolic, 10)
    if (!isNaN(sys) && bpSystolic !== '') {
      if (sys > 200) warns.push(`수축기 혈압 ${sys} mmHg — 매우 높습니다.`)
      else if (sys < 70) warns.push(`수축기 혈압 ${sys} mmHg — 매우 낮습니다.`)
    }
    if (!isNaN(dia) && bpDiastolic !== '') {
      if (dia > 130) warns.push(`이완기 혈압 ${dia} mmHg — 매우 높습니다.`)
      else if (dia < 40) warns.push(`이완기 혈압 ${dia} mmHg — 매우 낮습니다.`)
    }
    if (weight !== undefined) {
      if (weight > 200) warns.push(`체중 ${weight} kg — 값을 다시 확인해 주세요.`)
      else if (weight < 20) warns.push(`체중 ${weight} kg — 값을 다시 확인해 주세요.`)
    }
    const bg = parseFloat(fastingGlucose)
    if (!isNaN(bg) && fastingGlucose !== '') {
      if (bg > 500) warns.push(`공복혈당 ${bg} mg/dL — 매우 높습니다.`)
      else if (bg < 40) warns.push(`공복혈당 ${bg} mg/dL — 매우 낮습니다.`)
    }
    return warns
  }, [bpSystolic, bpDiastolic, weight, fastingGlucose, isReadOnly])

  const buildPayload = (): DailyRecordCreate => {
    const validExchanges = exchanges
      .filter(isComplete)
      .map(ex => ({ ...ex, ultrafiltration: calcUF(ex) }))
    return {
      record_date:           todayStr(),
      turbid_peritoneal:     turbidPeritoneal,
      weight:                weight,
      blood_pressure:        bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : undefined,
      urine_count:           urineCount,
      total_ultrafiltration: totalUltrafiltration || undefined,
      fasting_blood_glucose: fastingGlucose ? parseFloat(fastingGlucose) : undefined,
      memo:                  memo || undefined,
      exchange_records:      validExchanges,
    }
  }

  const completeCount = exchanges.filter(isComplete).length  // 실제 제출될 회차 수
  const partialCount  = exchanges.filter(ex => isFilled(ex) && !isComplete(ex)).length  // 미완성 회차 수

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
    if (completeCount < 3) setSubmitWarning(true)
    else handleFinalSubmit()
  }

  const ex = exchanges[activeSession]
  const uf = calcUF(ex)

  return (
    <form onSubmit={handleDraftSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 투석 교환 기록 — 탭 카드 ─────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}>
        {/* 섹션 헤더 */}
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>투석 교환 기록</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.textMuted }}>
            완성 {completeCount}회 제출 예정
            {partialCount > 0 && (
              <span style={{ marginLeft: 8, color: C.warning, fontWeight: 700 }}>
                · {partialCount}회 미완성 (제외됨)
              </span>
            )}
            {totalUltrafiltration > 0 && (
              <span style={{ marginLeft: 8, color: C.primary, fontWeight: 700 }}>
                · 총 제수량 {totalUltrafiltration}g
              </span>
            )}
          </p>
        </div>

        {/* 회차 탭 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
          {SESSIONS.map((n, i) => {
            const filled   = isFilled(exchanges[i])
            const complete = isComplete(exchanges[i])
            const partial  = filled && !complete
            const active   = activeSession === i
            const dotColor = active ? C.primary : complete ? '#22c55e' : '#f59e0b'
            return (
              <button
                key={n}
                type="button"
                onClick={() => setActiveSession(i)}
                style={{
                  flex: 1, padding: '12px 4px',
                  background: active ? '#fff' : 'transparent',
                  border: 'none',
                  borderBottom: active ? `2.5px solid ${C.primary}` : '2.5px solid transparent',
                  color: active ? C.primary : C.textMuted,
                  fontSize: 14, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', position: 'relative',
                  transition: 'all 0.15s',
                }}
              >
                {n}회
                {filled && (
                  <span style={{
                    position: 'absolute', top: 8, right: '50%', transform: 'translateX(8px)',
                    width: 7, height: 7, borderRadius: '50%',
                    background: dotColor,
                    boxShadow: partial && !active ? '0 0 0 1.5px #fbbf24' : 'none',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* 현재 회차 입력 카드 */}
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 시간 */}
          <div>
            <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
              교환 시간
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="07:30"
                maxLength={5}
                value={ex.exchange_time ?? ''}
                onChange={e => {
                  if (isReadOnly) return
                  let v = e.target.value.replace(/[^0-9:]/g, '')
                  if (v.length === 2 && !v.includes(':') && (ex.exchange_time ?? '').length < 2) v += ':'
                  updateExchange(activeSession, { exchange_time: v })
                }}
                onBlur={e => {
                  const v = e.target.value
                  if (v && !isValidTime(v)) {
                    // 잘못된 시간 입력 시 초기화
                    updateExchange(activeSession, { exchange_time: '' })
                  }
                }}
                readOnly={isReadOnly}
                style={{
                  flex: 1, minWidth: 0, height: 52, borderRadius: 12, boxSizing: 'border-box',
                  border: `1.5px solid ${ex.exchange_time && !isValidTime(ex.exchange_time) && ex.exchange_time.length === 5 ? C.danger : C.border}`,
                  background: isReadOnly ? C.bg : '#fff',
                  fontSize: 20, fontWeight: 700, color: C.text,
                  textAlign: 'center', outline: 'none', fontFamily: 'inherit',
                }}
              />
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => updateExchange(activeSession, { exchange_time: nowTimeStr() })}
                  style={{
                    width: 60, height: 52, borderRadius: 12, flexShrink: 0,
                    background: C.primary, color: '#fff',
                    border: 'none', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >지금</button>
              )}
            </div>
            {ex.exchange_time && ex.exchange_time.length === 5 && !isValidTime(ex.exchange_time) && !isReadOnly && (
              <p style={{ margin: '5px 0 0', fontSize: 12, color: C.danger }}>올바른 시간을 입력해주세요. (00:00 ~ 23:59)</p>
            )}
          </div>

          {/* 농도 */}
          <ConcInput
            key={`conc_${activeSession}_${resetKeys[activeSession] ?? 0}`}
            value={ex.infusion_concentration}
            onChange={v => updateExchange(activeSession, { infusion_concentration: v })}
            readOnly={isReadOnly}
          />

          {/* 주입량 */}
          <Stepper
            key={`infusion_weight_${activeSession}_${resetKeys[activeSession] ?? 0}`}
            label="주입량 (g)"
            value={ex.infusion_weight}
            onChange={v => updateExchange(activeSession, { infusion_weight: v })}
            step={50}
            min={0}
            max={5000}
            unit="g"
            readOnly={isReadOnly}
            startAt={2000}
          />

          {/* 배액량 */}
          <Stepper
            key={`drainage_volume_${activeSession}_${resetKeys[activeSession] ?? 0}`}
            label="배액량 (g)"
            value={ex.drainage_volume}
            onChange={v => updateExchange(activeSession, { drainage_volume: v })}
            step={50}
            min={0}
            max={6000}
            unit="g"
            readOnly={isReadOnly}
          />

          {/* 제수량 자동 계산 결과 */}
          <div>
            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted }}>
              제수량 (자동 계산)
            </label>
            <div style={{
              marginTop: 10, height: 52, borderRadius: 12,
              background: uf === undefined ? C.bg : uf >= 0 ? C.successLight : C.dangerLight,
              border: `1.5px solid ${uf === undefined ? C.border : uf >= 0 ? '#bbf7d0' : '#fecaca'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700,
              color: uf === undefined ? C.textLight : uf >= 0 ? C.success : C.danger,
            }}>
              {uf !== undefined ? `${uf}g` : '—'}
            </div>
          </div>

          {/* 이 회차 초기화 */}
          {!isReadOnly && isFilled(ex) && (
            <button
              type="button"
              onClick={() => {
                updateExchange(activeSession, emptyExchange(activeSession + 1))
                setResetKeys(prev => ({ ...prev, [activeSession]: (prev[activeSession] ?? 0) + 1 }))
              }}
              style={{
                padding: '10px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: '#fff',
                color: C.textMuted, fontSize: 13, cursor: 'pointer',
              }}
            >이 회차 초기화</button>
          )}
        </div>

        {/* 회차 간 이동 버튼 */}
        {!isReadOnly && (
          <div style={{
            padding: '12px 18px 16px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex', justifyContent: 'space-between', gap: 10,
          }}>
            <button
              type="button"
              onClick={() => setActiveSession(s => Math.max(0, s - 1))}
              disabled={activeSession === 0}
              style={{
                flex: 1, padding: '12px', borderRadius: 11,
                border: `1.5px solid ${C.border}`, background: '#fff',
                color: activeSession === 0 ? C.textLight : C.text,
                fontSize: 15, fontWeight: 600, cursor: activeSession === 0 ? 'default' : 'pointer',
              }}
            >← 이전 회차</button>
            <button
              type="button"
              onClick={() => setActiveSession(s => Math.min(4, s + 1))}
              disabled={activeSession === 4}
              style={{
                flex: 1, padding: '12px', borderRadius: 11,
                border: `1.5px solid ${C.primary}`, background: C.primary,
                color: activeSession === 4 ? 'rgba(255,255,255,0.4)' : '#fff',
                fontSize: 15, fontWeight: 600, cursor: activeSession === 4 ? 'default' : 'pointer',
              }}
            >다음 회차 →</button>
          </div>
        )}
      </div>

      {/* ── 기타 기록 ───────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 16,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>기타 기록</h2>
        </div>
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* 복막액 혼탁 */}
          <div>
            <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
              복막액 혼탁 여부
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: '정상', value: false, color: C.success,    bg: C.successLight, border: '#bbf7d0' },
                { label: '혼탁', value: true,  color: C.danger,     bg: C.dangerLight,  border: '#fecaca' },
              ].map(opt => {
                const active = turbidPeritoneal === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => { if (!isReadOnly) setTurbid(opt.value) }}
                    style={{
                      flex: 1, height: 56, borderRadius: 12,
                      border: `2px solid ${active ? opt.border : C.border}`,
                      background: active ? opt.bg : '#fff',
                      color: active ? opt.color : C.textMuted,
                      fontSize: 16, fontWeight: active ? 700 : 500,
                      cursor: isReadOnly ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >{opt.label}</button>
                )
              })}
            </div>
          </div>

          {/* 체중 */}
          <Stepper
            label="체중 (kg)"
            value={weight}
            onChange={v => { if (!isReadOnly) setWeight(v) }}
            step={0.5}
            min={0}
            max={300}
            unit="kg"
            readOnly={isReadOnly}
            isDecimal
            startAt={60}
          />

          {/* 혈압 */}
          <div>
            <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
              혈압 (mmHg)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="수축기"
                value={bpSystolic}
                onChange={e => { if (!isReadOnly) setBpSystolic(e.target.value.replace(/[^0-9]/g, '')) }}
                readOnly={isReadOnly}
                style={{
                  flex: '1 1 0', minWidth: 0, height: 52, padding: '0 10px',
                  borderRadius: 12, border: `1.5px solid ${C.border}`,
                  fontSize: 16, fontFamily: 'inherit', color: C.text,
                  background: isReadOnly ? C.bg : '#fff',
                  textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 20, color: C.textMuted, fontWeight: 700, flexShrink: 0 }}>/</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="이완기"
                value={bpDiastolic}
                onChange={e => { if (!isReadOnly) setBpDiastolic(e.target.value.replace(/[^0-9]/g, '')) }}
                readOnly={isReadOnly}
                style={{
                  flex: '1 1 0', minWidth: 0, height: 52, padding: '0 10px',
                  borderRadius: 12, border: `1.5px solid ${C.border}`,
                  fontSize: 16, fontFamily: 'inherit', color: C.text,
                  background: isReadOnly ? C.bg : '#fff',
                  textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* 소변 횟수 */}
          <Stepper
            label="소변 횟수"
            value={urineCount}
            onChange={v => { if (!isReadOnly) setUrineCount(v) }}
            step={1}
            min={0}
            max={99}
            unit="회"
            readOnly={isReadOnly}
          />

          {/* 공복혈당 */}
          <BigField
            label="공복혈당 (mg/dL)"
            placeholder="예) 105"
            value={fastingGlucose}
            onChange={e => { if (!isReadOnly) setFasting(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)) }}
            readOnly={isReadOnly}
          />

          {/* 총 제수량 */}
          <div>
            <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
              총 제수량 (자동 계산)
            </label>
            <div style={{
              height: 52, borderRadius: 12,
              border: `1.5px solid ${C.border}`,
              background: C.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700,
              color: totalUltrafiltration > 0 ? C.primary : C.textLight,
            }}>
              {totalUltrafiltration > 0 ? `${totalUltrafiltration}g` : '교환 기록에서 자동 계산'}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label style={{ display: 'block', fontSize: 17, fontWeight: 600, color: C.textMuted, marginBottom: 10 }}>
              메모 (특이사항)
            </label>
            <textarea
              placeholder="특이사항이 있으면 입력해 주세요."
              rows={3}
              value={memo}
              onChange={e => { if (!isReadOnly) setMemo(e.target.value) }}
              readOnly={isReadOnly}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                border: `1.5px solid ${C.border}`, fontSize: 15,
                fontFamily: 'inherit', color: C.text, outline: 'none',
                background: isReadOnly ? C.bg : '#fff', resize: 'vertical',
                boxSizing: 'border-box', lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 수치 소프트 경고 ─────────────────────────────────────── */}
      {!isReadOnly && softWarnings.length > 0 && (
        <div style={{
          padding: '14px 18px', backgroundColor: C.warningLight,
          border: '1px solid #fcd34d', borderRadius: 14,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#92400e', margin: 0 }}>⚠ 입력값 확인</p>
          {softWarnings.map((w, i) => (
            <p key={i} style={{ fontSize: 14, color: '#b45309', margin: 0 }}>• {w}</p>
          ))}
          <p style={{ fontSize: 13, color: '#92400e', margin: 0 }}>
            실제 측정값이 맞다면 그대로 제출하셔도 됩니다.
          </p>
        </div>
      )}

      {/* ── 버튼 영역 ────────────────────────────────────────────── */}
      {!isReadOnly && (
        <div>
          {submitWarning && (
            <div style={{
              marginBottom: 16, padding: '16px 18px',
              backgroundColor: C.warningLight, border: '1px solid #fcd34d',
              borderRadius: 14, fontSize: 14, color: '#92400e',
            }}>
              <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>
                ⚠ 완성된 교환 기록이 {completeCount}회차뿐이에요
              </p>
              <p style={{ marginBottom: 14, lineHeight: 1.6 }}>
                하루 3회 미만은 투석이 부족할 수 있습니다.<br />
                그래도 지금 최종 제출하시겠어요?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isFinalLoading}
                  style={{
                    flex: 1, padding: '12px 0', background: C.warning, color: '#fff',
                    border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: isFinalLoading ? 'not-allowed' : 'pointer',
                    opacity: isFinalLoading ? 0.6 : 1,
                  }}
                >{isFinalLoading ? '제출 중...' : '그래도 제출하기'}</button>
                <button
                  type="button"
                  onClick={() => setSubmitWarning(false)}
                  style={{
                    flex: 1, padding: '12px 0', background: '#fff', color: C.textMuted,
                    border: `1px solid ${C.border}`, borderRadius: 10,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >계속 입력하기</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={isDraftLoading || isFinalLoading}
              style={{
                flex: 1, padding: '15px 0',
                background: '#fff', color: C.primary,
                border: `2px solid ${C.primary}`, borderRadius: 12,
                fontSize: 16, fontWeight: 700,
                cursor: isDraftLoading ? 'not-allowed' : 'pointer',
                opacity: isDraftLoading ? 0.6 : 1,
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              className="capd-btn-outline-hover"
>{isDraftLoading ? '저장 중...' : '기록 저장'}</button>

            <button
              type="button"
              onClick={handleFinalClick}
              disabled={isDraftLoading || isFinalLoading}
              style={{
                flex: 2, padding: '15px 0',
                background: C.primary, color: '#fff',
                border: 'none', borderRadius: 12,
                fontSize: 16, fontWeight: 700,
                cursor: isFinalLoading ? 'not-allowed' : 'pointer',
                opacity: isFinalLoading ? 0.6 : 1,
                fontFamily: 'inherit', transition: 'opacity 0.15s',
              }}
              className="capd-btn-hover"
            >{isFinalLoading ? '제출 중...' : '최종 제출하기 →'}</button>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 13, color: C.textLight, textAlign: 'center' }}>
            * 최종 제출 후 후속 설문이 이어집니다.
          </p>
        </div>
      )}
    </form>
  )
}
