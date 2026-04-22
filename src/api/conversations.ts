import client from './client'

export interface AIMessage {
  conversation_id: number
  type: 'question' | 'urgent' | 'done'
  content: string
  is_done: boolean
}

export interface ConversationMessageItem {
  id: number
  role: 'ai' | 'user'
  content: string
  is_urgent_flag: boolean
  created_at: string
}

export interface ConversationDetail {
  conversation_id: number
  status: string
  started_at: string
  ended_at: string | null
  messages: ConversationMessageItem[]
}

/** 문진 시작 — 첫 번째 AI 질문 반환 */
export async function startConversation(recordId: number): Promise<AIMessage> {
  const res = await client.post('/api/v1/conversations/start', { record_id: recordId })
  return res.data
}

/** 환자 답변 전송 → 다음 AI 질문 반환 */
export async function sendMessage(conversationId: number, patientAnswer: string): Promise<AIMessage> {
  const res = await client.post('/api/v1/conversations/message', {
    conversation_id: conversationId,
    patient_answer: patientAnswer,
  })
  return res.data
}

/** 대화 내용 전체 조회 */
export async function getConversationMessages(conversationId: number): Promise<ConversationDetail> {
  const res = await client.get(`/api/v1/conversations/${conversationId}/messages`)
  return res.data
}

/** 기록 ID로 대화 세션 조회 */
export async function getConversationByRecord(recordId: number) {
  const res = await client.get(`/api/v1/conversations/by-record/${recordId}`)
  return res.data
}
