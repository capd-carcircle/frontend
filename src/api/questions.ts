import client from './client'

export interface CommonQuestion {
  id: number
  question_text: string
  is_active: boolean
  created_at: string
  updated_at: string
}

/** 공통 질문 목록 조회 (active 필터 선택적) */
export const listCommonQuestions = (active?: boolean): Promise<CommonQuestion[]> =>
  client
    .get<CommonQuestion[]>('/api/v1/questions/common', {
      params: active !== undefined ? { active } : {},
    })
    .then((r) => r.data)

/** 공통 질문 생성 */
export const createCommonQuestion = (question_text: string): Promise<CommonQuestion> =>
  client
    .post<CommonQuestion>('/api/v1/questions/common', { question_text })
    .then((r) => r.data)

/** 공통 질문 수정 (text / is_active 부분 수정 가능) */
export const updateCommonQuestion = (
  id: number,
  data: { question_text?: string; is_active?: boolean },
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
