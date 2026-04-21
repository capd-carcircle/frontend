import { useState } from 'react'
import type { DailyRecordCreate, DailyRecordResponse, ExchangeRecord } from '../../api/records'
import styles from './RecordForm.module.css'

// ── 빈 교환 기록 초기값 ──────────────────────────────────────
const emptyExchange = (session_number: number): ExchangeRecord => ({
  session_number,
  exchange_time: '',
  drainage_volume: undefined,
  infusion_concentration: undefined,
  infusion_weight: undefined,
  ultrafiltration: undefined,
})

const SESSIONS = [1, 2, 3, 4, 5]

// ── 오늘 날짜 YYYY-MM-DD ─────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0]

interface Props {
  onSubmit: (data: DailyRecordCreate) => void
  isLoading: boolean
  initialData?: DailyRecordResponse   // 이미 제출된 기록
  isEditing?: boolean                  // true면 initialData가 있어도 편집 가능
}

export default function RecordForm({ onSubmit, isLoading, initialData, isEditing = false }: Props) {
  // initialData가 있고 편집 모드가 아니면 읽기 전용
  const isReadOnly = !!initialData && !isEditing

  // ── 교환 기록 초기화 ─────────────────────────────────────────
  const initExchanges = (): ExchangeRecord[] => {
    const base = SESSIONS.map(emptyExchange)
    if (!initialData) return base
    initialData.exchange_records.forEach((ex) => {
      const idx = ex.session_number - 1
      if (idx >= 0 && idx < 5) {
        base[idx] = {
          session_number:        ex.session_number,
          exchange_time:         ex.exchange_time ?? '',
          drainage_volume:       ex.drainage_volume,
          infusion_concentration: ex.infusion_concentration,
          infusion_weight:       ex.infusion_weight,
          ultrafiltration:       ex.ultrafiltration,
        }
      }
    })
    return base
  }

  // ── 기타 기록 초기화 ─────────────────────────────────────────
  const initBp = () => {
    if (!initialData?.blood_pressure) return { sys: '', dia: '' }
    const parts = initialData.blood_pressure.split('/')
    return { sys: parts[0] ?? '', dia: parts[1] ?? '' }
  }

  const [exchanges, setExchanges] = useState<ExchangeRecord[]>(initExchanges)
  const [turbidPeritoneal, setTurbidPeritoneal] = useState(initialData?.turbid_peritoneal ?? false)
  const [weight, setWeight]               = useState(initialData?.weight?.toString() ?? '')
  const [bpSystolic, setBpSystolic]       = useState(initBp().sys)
  const [bpDiastolic, setBpDiastolic]     = useState(initBp().dia)
  const [urineCount, setUrineCount]       = useState(initialData?.urine_count?.toString() ?? '')
  const [fastingGlucose, setFastingGlucose] = useState(initialData?.fasting_blood_glucose?.toString() ?? '')
  const [memo, setMemo]                   = useState(initialData?.memo ?? '')

  // ── 교환 기록 셀 변경 핸들러 ────────────────────────────────
  const handleExchange = (
    sessionIdx: number,
    field: keyof ExchangeRecord,
    value: string
  ) => {
    if (isReadOnly) return
    setExchanges((prev) => {
      const next = [...prev]
      const rec = { ...next[sessionIdx] }
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

  // ── 제수량 합계 자동 계산 ────────────────────────────────────
  const totalUltrafiltration = exchanges.reduce(
    (sum, ex) => sum + (ex.ultrafiltration ?? 0),
    0
  )

  // ── 제출 ─────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isReadOnly) return

    const validExchanges = exchanges.filter(
      (ex) =>
        ex.exchange_time ||
        ex.drainage_volume !== undefined ||
        ex.infusion_concentration !== undefined ||
        ex.infusion_weight !== undefined ||
        ex.ultrafiltration !== undefined
    )

    const payload: DailyRecordCreate = {
      record_date: todayStr(),
      turbid_peritoneal: turbidPeritoneal,
      weight: weight ? parseFloat(weight) : undefined,
      blood_pressure:
        bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic}` : undefined,
      urine_count: urineCount ? parseInt(urineCount, 10) : undefined,
      total_ultrafiltration: totalUltrafiltration || undefined,
      fasting_blood_glucose: fastingGlucose ? parseFloat(fastingGlucose) : undefined,
      memo: memo || undefined,
      exchange_records: validExchanges,
    }

    onSubmit(payload)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>

      {/* ── 교환 기록 테이블 ──────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>투석 교환 기록</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.rowHeader}>항목</th>
                {SESSIONS.map((n) => (
                  <th key={n} className={styles.colHeader}>{n}회차</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 교환 시간 */}
              <tr>
                <td className={styles.rowLabel}>교환 시간</td>
                {exchanges.map((ex, i) => (
                  <td key={i} className={styles.cell}>
                    <input
                      type="time"
                      className={styles.cellInput}
                      value={ex.exchange_time ?? ''}
                      onChange={(e) => handleExchange(i, 'exchange_time', e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </td>
                ))}
              </tr>
              {/* 배액량 */}
              <tr>
                <td className={styles.rowLabel}>배액량 (g)</td>
                {exchanges.map((ex, i) => (
                  <td key={i} className={styles.cell}>
                    <input
                      type="number"
                      className={styles.cellInput}
                      placeholder="—"
                      min="0"
                      value={ex.drainage_volume ?? ''}
                      onChange={(e) => handleExchange(i, 'drainage_volume', e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </td>
                ))}
              </tr>
              {/* 주입액 농도 */}
              <tr>
                <td className={styles.rowLabel}>주입액 농도 (%)</td>
                {exchanges.map((ex, i) => (
                  <td key={i} className={styles.cell}>
                    <input
                      type="number"
                      className={styles.cellInput}
                      placeholder="—"
                      step="0.5"
                      min="0"
                      max="5"
                      value={ex.infusion_concentration ?? ''}
                      onChange={(e) =>
                        handleExchange(i, 'infusion_concentration', e.target.value)
                      }
                      readOnly={isReadOnly}
                    />
                  </td>
                ))}
              </tr>
              {/* 주입액 중량 */}
              <tr>
                <td className={styles.rowLabel}>주입액 중량 (g)</td>
                {exchanges.map((ex, i) => (
                  <td key={i} className={styles.cell}>
                    <input
                      type="number"
                      className={styles.cellInput}
                      placeholder="—"
                      min="0"
                      value={ex.infusion_weight ?? ''}
                      onChange={(e) => handleExchange(i, 'infusion_weight', e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </td>
                ))}
              </tr>
              {/* 제수량 */}
              <tr>
                <td className={styles.rowLabel}>제수량 (g)</td>
                {exchanges.map((ex, i) => (
                  <td key={i} className={styles.cell}>
                    <input
                      type="number"
                      className={styles.cellInput}
                      placeholder="—"
                      value={ex.ultrafiltration ?? ''}
                      onChange={(e) => handleExchange(i, 'ultrafiltration', e.target.value)}
                      readOnly={isReadOnly}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 기타 기록 ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>기타 기록</h2>
        <div className={styles.otherGrid}>

          {/* 복막액 혼탁 여부 */}
          <div className={styles.field}>
            <label className={styles.label}>복막액 혼탁 여부</label>
            <div className={styles.toggleRow}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${!turbidPeritoneal ? styles.toggleActive : ''}`}
                onClick={() => { if (!isReadOnly) setTurbidPeritoneal(false) }}
                style={isReadOnly ? { cursor: 'default' } : {}}
              >
                정상
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${turbidPeritoneal ? styles.toggleActiveWarn : ''}`}
                onClick={() => { if (!isReadOnly) setTurbidPeritoneal(true) }}
                style={isReadOnly ? { cursor: 'default' } : {}}
              >
                혼탁
              </button>
            </div>
          </div>

          {/* 체중 */}
          <div className={styles.field}>
            <label className={styles.label}>체중 (kg)</label>
            <input
              type="number"
              className={styles.input}
              placeholder="예) 62.5"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => { if (!isReadOnly) setWeight(e.target.value) }}
              readOnly={isReadOnly}
            />
          </div>

          {/* 혈압 */}
          <div className={styles.field}>
            <label className={styles.label}>혈압 (mmHg)</label>
            <div className={styles.bpRow}>
              <input
                type="number"
                className={styles.bpInput}
                placeholder="수축기"
                min="0"
                value={bpSystolic}
                onChange={(e) => { if (!isReadOnly) setBpSystolic(e.target.value) }}
                readOnly={isReadOnly}
              />
              <span className={styles.bpSlash}>/</span>
              <input
                type="number"
                className={styles.bpInput}
                placeholder="이완기"
                min="0"
                value={bpDiastolic}
                onChange={(e) => { if (!isReadOnly) setBpDiastolic(e.target.value) }}
                readOnly={isReadOnly}
              />
            </div>
          </div>

          {/* 소변 횟수 */}
          <div className={styles.field}>
            <label className={styles.label}>소변 횟수</label>
            <input
              type="number"
              className={styles.input}
              placeholder="예) 3"
              min="0"
              value={urineCount}
              onChange={(e) => { if (!isReadOnly) setUrineCount(e.target.value) }}
              readOnly={isReadOnly}
            />
          </div>

          {/* 제수량 합계 (자동 계산) */}
          <div className={styles.field}>
            <label className={styles.label}>제수량 합계 (g)</label>
            <input
              type="number"
              className={`${styles.input} ${styles.readOnly}`}
              value={totalUltrafiltration || ''}
              placeholder="교환 기록에서 자동 계산"
              readOnly
            />
          </div>

          {/* 공복혈당 */}
          <div className={styles.field}>
            <label className={styles.label}>공복혈당 (mg/dL)</label>
            <input
              type="number"
              className={styles.input}
              placeholder="예) 105"
              min="0"
              value={fastingGlucose}
              onChange={(e) => { if (!isReadOnly) setFastingGlucose(e.target.value) }}
              readOnly={isReadOnly}
            />
          </div>

        </div>

        {/* 메모 */}
        <div className={`${styles.field} ${styles.memoField}`}>
          <label className={styles.label}>메모 (특이사항)</label>
          <textarea
            className={styles.textarea}
            placeholder="특이사항이 있으면 입력해 주세요."
            rows={3}
            value={memo}
            onChange={(e) => { if (!isReadOnly) setMemo(e.target.value) }}
            readOnly={isReadOnly}
          />
        </div>
      </section>

      {/* ── 버튼 영역 ────────────────────────────────────────── */}
      {!isReadOnly && (
        <div className={styles.submitArea}>
          <button type="submit" className={styles.submitBtn} disabled={isLoading}>
            {isLoading
              ? (isEditing ? '저장 중...' : '제출 중...')
              : (isEditing ? '수정 저장하기 →' : '기록 제출하기 →')}
          </button>
          {!isEditing && (
            <p className={styles.submitNote}>* 제출 후 후속 설문이 이어집니다.</p>
          )}
        </div>
      )}
    </form>
  )
}
