import client from './client'

export type QuestionType = 'yes_no' | 'single_select' | 'multi_select' | 'short_text'

export interface CommonQuestion {
  id: number
  question_text: string
  question_type: QuestionType
  options: string | null   // JSON 문자열 또는 null
  is_active: boolean
  created_at: string
  updated_at: string
}

/** options JSON 파싱 헬퍼 */
export const parseOptions = (options: string | null): string[] => {
  if (!options) return []
  try { return JSON.parse(options) } catch { return [] }
}

/** 공통 질문 목록 조회 (active 필터 선택적) */
export const listCommonQuestions = (active?: boolean): Promise<CommonQuestion[]> =>
  client
    .get<CommonQuestion[]>('/api/v1/questions/common', {
      params: active !== undefined ? { active } : {},
    })
    .then((r) => r.data)

/** 공통 질문 생성 */
export const createCommonQuestion = (data: {
  question_text: string
  question_type: QuestionType
  options?: string[]
}): Promise<CommonQuestion> =>
  client
    .post<CommonQuestion>('/api/v1/questions/common', data)
    .then((r) => r.data)

/** 공통 질문 수정 */
export const updateCommonQuestion = (
  id: number,
  data: {
    question_text?: string
    question_type?: QuestionType
    options?: string[]
    is_active?: boolean
  },
): Promise<CommonQuestion> =>
  client.patch<CommonQuestion>(`/api/v1/questions/common/${id}`, data).then((r) => r.data)

/** 공통 질문 삭제 */
export const deleteCommonQuestion = (id: number): Promise<void> =>
  client.delete(`/api/v1/questions/common/${id}`).then(() => undefined)

/** 활성 / 비활성 토글 */
export const toggleCommonQuestion = (id: number): Promise<CommonQuestion> =>
  client
    .patch<CommonQuestion>(`/api/v1/questions/common/${id}/toggle`)
    .then((r) => r.data)

// ── AI 질문 관련 ──────────────────────────────────────────

export interface AIQuestionRow {
  id: number
  patient_id: number
  patient_name: string
  record_id: number
  record_date: string
  question_text: string
  question_type: string
  reason: string | null
  status: string
  created_at: string
}

/** AI 질문 목록 조회 (의사용, 환자 필터 선택적) */
export const listAIQuestions = (patient_id?: number): Promise<AIQuestionRow[]> =>
  client
    .get<AIQuestionRow[]>('/api/v1/questions/ai', {
      params: patient_id !== undefined ? { patient_id } : {},
    })
    .then((r) => r.data)

/** AI 질문 거절 */
export const rejectAIQuestion = (
  id: number,
  scope: 'patient' | 'global',
): Promise<void> =>
  client
    .post(`/api/v1/questions/ai/${id}/reject`, { scope })
    .then(() => undefined)
