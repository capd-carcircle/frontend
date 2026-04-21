import client from './client'

// ── 타입 ──────────────────────────────────────────────────────

export interface ExchangeRecord {
  session_number: number          // 1~5
  exchange_time?: string          // "HH:MM"
  drainage_volume?: number        // 배액량 (g)
  infusion_concentration?: number // 주입액 농도 (%)
  infusion_weight?: number        // 주입액 중량 (g)
  ultrafiltration?: number        // 제수량 (g)
}

export interface DailyRecordCreate {
  record_date: string             // "YYYY-MM-DD"
  turbid_peritoneal: boolean      // 복막액 혼탁 여부
  weight?: number                 // 체중 (kg)
  blood_pressure?: string         // 혈압 "120/80"
  urine_count?: number            // 소변 횟수
  total_ultrafiltration?: number  // 제수량 합계 (g)
  fasting_blood_glucose?: number  // 공복혈당 (mg/dL)
  memo?: string
  exchange_records: ExchangeRecord[]
}

export interface ExchangeRecordResponse extends ExchangeRecord {
  id: number
  daily_record_id: number
  created_at: string
}

export interface DailyRecordResponse {
  id: number
  patient_id: number
  record_date: string
  turbid_peritoneal: boolean
  weight?: number
  blood_pressure?: string
  urine_count?: number
  total_ultrafiltration?: number
  fasting_blood_glucose?: number
  memo?: string
  status: 'submitted' | 'reviewed' | 'rejected'
  submitted_at?: string
  exchange_records: ExchangeRecordResponse[]
  created_at: string
}

// ── API 함수 ──────────────────────────────────────────────────

export const submitRecord = async (data: DailyRecordCreate): Promise<DailyRecordResponse> => {
  const res = await client.post('/api/v1/records', data)
  return res.data
}

export const getMyRecords = async (): Promise<DailyRecordResponse[]> => {
  const res = await client.get('/api/v1/records')
  return res.data
}

export const getRecord = async (id: number): Promise<DailyRecordResponse> => {
  const res = await client.get(`/api/v1/records/${id}`)
  return res.data
}

export interface DailyRecordUpdate {
  turbid_peritoneal?: boolean
  weight?: number
  blood_pressure?: string
  urine_count?: number
  total_ultrafiltration?: number
  fasting_blood_glucose?: number
  memo?: string
  exchange_records?: ExchangeRecord[]
}

export const updateRecord = async (
  id: number,
  data: DailyRecordUpdate
): Promise<DailyRecordResponse> => {
  const res = await client.patch(`/api/v1/records/${id}`, data)
  return res.data
}

export const deleteRecord = async (id: number): Promise<void> => {
  await client.delete(`/api/v1/records/${id}`)
}
