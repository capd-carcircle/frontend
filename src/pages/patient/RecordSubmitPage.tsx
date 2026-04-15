import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitRecord, DailyRecordCreate, ExchangeRecord } from '../../api/records'

// ── 행 정의 ────────────────────────────────────────────────────
const EXCHANGE_ROWS: { key: keyof ExchangeRecord; label: string }[] = [
  { key: 'exchange_time',           label: '교환 시간' },
  { key: 'drainage_volume',         label: '배액량 (g)' },
  { key: 'infusion_concentration',  label: '주입액 농도 (%)' },
  { key: 'infusion_weight',         label: '주입액 중량 (g)' },
  { key: 'ultrafiltration',         label: '제수량 (g)' },
]

type ExchangeTable = Record<keyof ExchangeRecord, string[]>

const initTable = (): ExchangeTable => ({
  session_number:       ['1', '2', '3', '4', '5'],
  exchange_time:        ['', '', '', '', ''],
  drainage_volume:      ['', '', '', '', ''],
  infusion_concentration: ['', '', '', '', ''],
  infusion_weight:      ['', '', '', '', ''],
  ultrafiltration:      ['', '', '', '', ''],
})

interface OtherFields {
  turbid_peritoneal: string
  body_weight: string
  blood_pressure: string
  urine_count: string
  total_ultrafiltration: string
  fasting_blood_glucose: string
  memo: string
}

const initOther = (): OtherFields => ({
  turbid_peritoneal: '',
  body_weight: '',
  blood_pressure: '',
  urine_count: '',
  total_ultrafiltration: '',
  fasting_blood_glucose: '',
  memo: '',
})

const getKoreanDate = (): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

const getTodayISO = (): string => new Date().toISOString().split('T')[0]

// ── 스타일 ─────────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', backgroundColor: '#eff1f5', fontFamily: "'Noto Sans KR', 'Inter', sans-serif" } as React.CSSProperties,
  header: { position: 'fixed' as const, top: 0, left: 0, right: 0, height: 52, backgroundColor: '#1b508a', display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 100 },
  headerLogo: { color: '#fff', fontWeight: 700, fontSize: 16, flex: 1 },
  headerTitle: { color: '#fff', fontSize: 13, position: 'absolute' as const, left: '50%', transform: 'translateX(-50%)' },
  body: { maxWidth: 1280, margin: '0 auto', padding: '72px 20px 40px' } as React.CSSProperties,
  dateTitle: { fontSize: 16, fontWeight: 700, color: '#1f1f1f', marginBottom: 4 } as React.CSSProperties,
  dateSub: { fontSize: 11, color: '#8c8c8c', marginBottom: 16 } as React.CSSProperties,
  card: { backgroundColor: '#fff', borderRadius: 8, padding: '20px 16px', marginBottom: 16 } as React.CSSProperties,
  cardTitle: { fontSize: 13, fontWeight: 700, color: '#1f1f1f', marginBottom: 12 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const },
  thBlue: { backgroundColor: '#1b508a', color: '#fff', fontWeight: 700, fontSize: 10, padding: '7px 8px', textAlign: 'left' as const, width: '16%' },
  thGray: { backgroundColor: '#dbdbdb', color: '#1f1f1f', fontWeight: 700, fontSize: 10, padding: '7px 8px', textAlign: 'left' as const, width: '16.8%' },
  tdLabel: { backgroundColor: '#f2f7ff', fontSize: 10, color: '#1f1f1f', padding: '7px 8px' },
  tdInput: { padding: '4px 6px' },
  tblInput: { width: '100%', height: 30, border: '1px solid #dbdbdb', borderRadius: 3, padding: '0 6px', fontSize: 11, outline: 'none', boxSizing: 'border-box' as const },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px 20px' } as React.CSSProperties,
  fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  fieldLabel: { fontSize: 11, color: '#8c8c8c' } as React.CSSProperties,
  fieldInput: { height: 32, border: '1px solid #dbdbdb', borderRadius: 4, padding: '0 10px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  notesGroup: { display: 'flex', flexDirection: 'column' as const, gap: 4, marginTop: 16 },
  notesInput: { width: '100%', height: 48, border: '1px solid #dbdbdb', borderRadius: 4, padding: '8px 10px', fontSize: 12, outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const },
  submitArea: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8, marginTop: 24 },
  submitBtn: { backgroundColor: '#1b508a', color: '#fff', border: 'none', borderRadius: 6, width: 220, height: 44, fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  submitNote: { fontSize: 10, color: '#8c8c8c' } as React.CSSProperties,
  error: { textAlign: 'center' as const, color: '#c0392b', fontSize: 12, marginBottom: 8 },
}

export default function RecordSubmitPage() {
  const navigate = useNavigate()
  const [table, setTable] = useState<ExchangeTable>(initTable)
  const [other, setOther] = useState<OtherFields>(initOther)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTableChange = (rowKey: keyof ExchangeTable, colIdx: number, value: string) => {
    setTable(prev => {
      const updated = [...prev[rowKey]]
      updated[colIdx] = value
      return { ...prev, [rowKey]: updated }
    })
  }

  const handleOtherChange = (key: keyof OtherFields, value: string) => {
    setOther(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      // 교환 기록 조합 (값이 하나라도 있는 회차만 포함)
      const exchange_records: ExchangeRecord[] = [1, 2, 3, 4, 5]
        .map((n, i) => ({
          session_number: n,
          exchange_time:           table.exchange_time[i]           || undefined,
          drainage_volume:         table.drainage_volume[i]         ? Number(table.drainage_volume[i])         : undefined,
          infusion_concentration:  table.infusion_concentration[i]  ? Number(table.infusion_concentration[i])  : undefined,
          infusion_weight:         table.infusion_weight[i]         ? Number(table.infusion_weight[i])         : undefined,
          ultrafiltration:         table.ultrafiltration[i]         ? Number(table.ultrafiltration[i])         : undefined,
        }))
        .filter(r =>
          r.exchange_time || r.drainage_volume != null ||
          r.infusion_concentration != null || r.infusion_weight != null || r.ultrafiltration != null
        )

      const payload: DailyRecordCreate = {
        record_date:           getTodayISO(),
        turbid_peritoneal:     other.turbid_peritoneal === '있음',
        weight:                other.body_weight             ? Number(other.body_weight)             : undefined,
        blood_pressure:        other.blood_pressure          || undefined,
        urine_count:           other.urine_count             ? Number(other.urine_count)             : undefined,
        total_ultrafiltration: other.total_ultrafiltration   ? Number(other.total_ultrafiltration)   : undefined,
        fasting_blood_glucose: other.fasting_blood_glucose   ? Number(other.fasting_blood_glucose)   : undefined,
        memo:                  other.memo                    || undefined,
        exchange_records,
      }

      const record = await submitRecord(payload)
      navigate('/patient/survey', { state: { recordId: record.id } })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '제출에 실패했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const focusBlue = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = '#1b508a')
  const blurGray = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = '#dbdbdb')

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <header style={s.header}>
        <span style={s.headerLogo}>CAPD</span>
        <span style={s.headerTitle}>일일 기록 제출</span>
      </header>

      <main style={s.body}>
        <p style={s.dateTitle}>{getKoreanDate()}</p>
        <p style={s.dateSub}>오늘의 CAPD 투석 기록을 입력해 주세요.</p>

        {/* 투석 교환 기록 테이블 */}
        <div style={s.card}>
          <p style={s.cardTitle}>투석 교환 기록 (회차별)</p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.thBlue}>구분</th>
                {[1, 2, 3, 4, 5].map(n => (
                  <th key={n} style={s.thGray}>{n}회차</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXCHANGE_ROWS.map(row => (
                <tr key={row.key}>
                  <td style={s.tdLabel}>{row.label}</td>
                  {[0, 1, 2, 3, 4].map(i => (
                    <td key={i} style={s.tdInput}>
                      <input
                        type={row.key === 'exchange_time' ? 'time' : 'number'}
                        style={s.tblInput}
                        value={table[row.key][i]}
                        onChange={e => handleTableChange(row.key, i, e.target.value)}
                        onFocus={focusBlue}
                        onBlur={blurGray}
                        min={row.key !== 'exchange_time' ? '0' : undefined}
                        step={row.key !== 'exchange_time' ? '0.1' : undefined}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 기타 기록 */}
        <div style={s.card}>
          <p style={s.cardTitle}>기타 기록</p>
          <div style={s.grid3}>
            {/* Row 1 */}
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>복막액 혼탁 여부</label>
              <select
                style={{ ...s.fieldInput, appearance: 'auto' } as React.CSSProperties}
                value={other.turbid_peritoneal}
                onChange={e => handleOtherChange('turbid_peritoneal', e.target.value)}
                onFocus={focusBlue}
                onBlur={blurGray}
              >
                <option value="">선택</option>
                <option value="없음">없음</option>
                <option value="있음">있음</option>
              </select>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>체중 (kg)</label>
              <input type="number" step="0.1" style={s.fieldInput}
                value={other.body_weight}
                onChange={e => handleOtherChange('body_weight', e.target.value)}
                onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>혈압 (mmHg)</label>
              <input type="text" placeholder="예: 120/80" style={s.fieldInput}
                value={other.blood_pressure}
                onChange={e => handleOtherChange('blood_pressure', e.target.value)}
                onFocus={focusBlue} onBlur={blurGray} />
            </div>

            {/* Row 2 */}
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>소변 횟수</label>
              <input type="number" min="0" style={s.fieldInput}
                value={other.urine_count}
                onChange={e => handleOtherChange('urine_count', e.target.value)}
                onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>제수량 합계 (g)</label>
              <input type="number" style={s.fieldInput}
                value={other.total_ultrafiltration}
                onChange={e => handleOtherChange('total_ultrafiltration', e.target.value)}
                onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.fieldLabel}>공복혈당 (mg/dL)</label>
              <input type="number" style={s.fieldInput}
                value={other.fasting_blood_glucose}
                onChange={e => handleOtherChange('fasting_blood_glucose', e.target.value)}
                onFocus={focusBlue} onBlur={blurGray} />
            </div>
          </div>

          {/* 메모 */}
          <div style={s.notesGroup}>
            <label style={s.fieldLabel}>메모 (특이사항)</label>
            <textarea style={s.notesInput}
              value={other.memo}
              onChange={e => handleOtherChange('memo', e.target.value)}
              onFocus={focusBlue} onBlur={blurGray} />
          </div>
        </div>

        {/* 에러 */}
        {error && <p style={s.error}>⚠ {error}</p>}

        {/* 제출 버튼 */}
        <div style={s.submitArea}>
          <button
            style={{ ...s.submitBtn, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '제출 중...' : '기록 제출하기  →'}
          </button>
          <span style={s.submitNote}>* 제출 후 후속 설문이 이어집니다</span>
        </div>
      </main>
    </div>
  )
}
