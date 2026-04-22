import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import client from '../../api/client'

// ── 타입 ──────────────────────────────────────────────────
interface QuestionWithAnswer {
  question_id: number
  question_text: string
  type: 'common' | 'ai'
  reason?: string | null
  choice: 'yes' | 'no' | null
  text_answer: string | null
  answered: boolean
}

interface Answer {
  choice: 'yes' | 'no' | null
  text: string
}

const MAX_POLLS     = 10
const POLL_INTERVAL = 3000

// ── 단일 질문 컴포넌트 ────────────────────────────────────
function QuestionItem({ question, answer, onChange }: {
  question: QuestionWithAnswer
  answer: Answer
  onChange: (id: number, choice: 'yes' | 'no' | null, text: string) => void
}) {
  const isAI     = question.type === 'ai'
  const answered = answer.choice !== null || answer.text.trim() !== ''

  return (
    <div style={{
      padding: '16px',
      borderRadius: 10,
      backgroundColor: isAI ? '#edf5ff' : '#f9fafb',
      border: isAI ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
      marginBottom: 10,
      position: 'relative',
    }}>
      {/* 답변 완료 뱃지 */}
      {answered && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          fontSize: 10, fontWeight: 700,
          color: '#16a34a', backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          padding: '2px 8px', borderRadius: 20,
        }}>✓ 답변 완료</span>
      )}

      {isAI && (
        <span style={{
          display: 'inline-block', marginBottom: 6,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          color: '#2563eb', backgroundColor: '#dbeafe',
          padding: '2px 8px', borderRadius: 20,
        }}>🤖 AI 맞춤 질문</span>
      )}

      <p style={{
        fontSize: 14, color: '#1a1a2e', fontWeight: 500,
        marginBottom: isAI && question.reason ? 6 : 12,
        lineHeight: 1.5,
        paddingRight: answered ? 90 : 0,
      }}>
        {!isAI && (
          <span style={{ color: '#1b508a', fontWeight: 700, marginRight: 4 }}>Q.</span>
        )}
        {question.question_text}
      </p>

      {isAI && question.reason && (
        <p style={{
          fontSize: 12, color: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.06)',
          padding: '6px 10px', borderRadius: 6,
          marginBottom: 12,
        }}>
          💡 {question.reason}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* 예 */}
        <button
          type="button"
          style={{
            height: 34, minWidth: 64, padding: '0 14px',
            borderRadius: 8, border: 'none',
            cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
            backgroundColor: answer.choice === 'yes' ? '#1b508a' : '#e5e7eb',
            color: answer.choice === 'yes' ? '#fff' : '#374151',
            boxShadow: answer.choice === 'yes' ? '0 2px 6px rgba(27,80,138,0.3)' : 'none',
          }}
          onClick={() => onChange(question.question_id, 'yes', answer.text)}
        >
          예
        </button>

        {/* 아니오 */}
        <button
          type="button"
          style={{
            height: 34, minWidth: 80, padding: '0 14px',
            borderRadius: 8, border: 'none',
            cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
            backgroundColor: answer.choice === 'no' ? '#1b508a' : '#e5e7eb',
            color: answer.choice === 'no' ? '#fff' : '#374151',
            boxShadow: answer.choice === 'no' ? '0 2px 6px rgba(27,80,138,0.3)' : 'none',
          }}
          onClick={() => onChange(question.question_id, 'no', answer.text)}
        >
          아니오
        </button>

        {/* 직접 입력 */}
        <input
          type="text"
          placeholder="직접 입력 (선택사항)"
          style={{
            flex: 1, minWidth: 120, height: 34,
            borderRadius: 8, border: '1px solid #e5e7eb',
            backgroundColor: '#fff',
            padding: '0 12px',
            fontSize: 13, color: '#1a1a2e', outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          value={answer.text}
          onChange={e => onChange(question.question_id, answer.choice, e.target.value)}
          onFocus={e => {
            e.target.style.borderColor = '#1b508a'
            e.target.style.boxShadow   = '0 0 0 3px rgba(27,80,138,0.10)'
          }}
          onBlur={e => {
            e.target.style.borderColor = '#e5e7eb'
            e.target.style.boxShadow   = 'none'
          }}
        />
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function SurveyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const recordId: number | undefined = (location.state as { recordId?: number })?.recordId

  const [commonQs, setCommonQs]   = useState<QuestionWithAnswer[]>([])
  const [aiQs, setAiQs]           = useState<QuestionWithAnswer[]>([])
  const [answers, setAnswers]     = useState<Record<number, Answer>>({})
  const [loading, setLoading]     = useState(true)
  const [aiPending, setAiPending] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState<'success' | 'error' | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollCountRef = useRef(0)

  // ── 전체 질문 + 기존 답변 로드 ─────────────────────────
  const loadAll = useCallback(async () => {
    if (!recordId) return
    try {
      const res = await client.get(`/api/v1/surveys/my-responses/${recordId}`)
      const data = res.data

      // 공통 질문
      const cqs: QuestionWithAnswer[] = data.common_questions.map((q: QuestionWithAnswer) => ({
        ...q, type: 'common' as const,
      }))
      // AI 질문
      const aqs: QuestionWithAnswer[] = data.ai_questions.map((q: QuestionWithAnswer) => ({
        ...q, type: 'ai' as const,
      }))

      setCommonQs(cqs)
      setAiQs(aqs)
      setAiPending(data.ai_pending ?? false)

      // 기존 답변으로 answers 초기화 (이미 설정된 것은 덮어쓰지 않음)
      setAnswers(prev => {
        const next = { ...prev }
        ;[...cqs, ...aqs].forEach(q => {
          if (!(q.question_id in next)) {
            next[q.question_id] = {
              choice: q.choice ?? null,
              text:   q.text_answer ?? '',
            }
          }
        })
        return next
      })

      return data.ai_pending
    } catch (e) {
      console.error('질문 로드 실패:', e)
      return false
    }
  }, [recordId])

  // ── 초기 로드 + AI 폴링 ────────────────────────────────
  useEffect(() => {
    if (!recordId) { setLoading(false); return }

    let cancelled = false

    const poll = async (isFirst: boolean) => {
      const pending = await loadAll()
      if (cancelled) return
      if (isFirst) setLoading(false)

      if (pending && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current++
        pollRef.current = setTimeout(() => poll(false), POLL_INTERVAL)
      } else {
        setAiPending(false)
      }
    }

    poll(true)
    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [recordId, loadAll])

  function handleChange(id: number, choice: 'yes' | 'no' | null, text: string) {
    setAnswers(prev => ({ ...prev, [id]: { choice, text } }))
  }

  // ── 저장 ─────────────────────────────────────────────────
  async function handleSave() {
    if (!recordId) return
    setSaving(true)
    setSaveMsg(null)

    const allQs = [...commonQs, ...aiQs]
    const responses = allQs
      .map(q => ({
        question_id:   q.question_id,
        question_type: q.type,
        choice:        answers[q.question_id]?.choice ?? null,
        text_answer:   answers[q.question_id]?.text ?? '',
      }))
      .filter(r => r.choice !== null || r.text_answer.trim() !== '')

    try {
      await client.post('/api/v1/surveys/responses', {
        record_id: recordId,
        responses,
      })
      setSaveMsg('success')
      // 저장 후 answered 상태 갱신을 위해 재로드
      await loadAll()
      setTimeout(() => setSaveMsg(null), 3000)
    } catch (e: unknown) {
      console.error('저장 실패:', e)
      setSaveMsg('error')
    } finally {
      setSaving(false)
    }
  }

  // ── 진행률 계산 ───────────────────────────────────────────
  const allQs   = [...commonQs, ...aiQs]
  const total   = allQs.length
  const answered = allQs.filter(q => {
    const a = answers[q.question_id]
    return a?.choice !== null || (a?.text ?? '').trim() !== ''
  }).length
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0

  // 현재 새로 입력한 답변이 있는지 (저장 버튼 활성화 여부)
  const hasNewAnswers = allQs.some(q => {
    const cur = answers[q.question_id]
    const hasAnswer = cur?.choice !== null || (cur?.text ?? '').trim() !== ''
    return hasAnswer && !q.answered // 새로 답변한 항목
  }) || allQs.some(q => {
    // 기존 답변에서 변경된 항목
    const cur = answers[q.question_id]
    if (!q.answered) return false
    const choiceChanged = cur?.choice !== q.choice
    const textChanged   = (cur?.text ?? '') !== (q.text_answer ?? '')
    return choiceChanged || textChanged
  })

  // 공통 질문 전체 답변 완료 여부 (AI 문진 시작 버튼 활성화)
  const allCommonAnswered = commonQs.length > 0 && commonQs.every(q => {
    const a = answers[q.question_id]
    return a?.choice !== null
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa' }}>
      {/* 헤더 */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        backgroundColor: '#1b508a',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        zIndex: 100, boxShadow: '0 2px 8px rgba(27,80,138,0.25)',
      }}>
        <button
          style={{
            color: '#fff', fontSize: 14, cursor: 'pointer',
            background: 'none', border: 'none', padding: '0 10px 0 0',
            display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
          }}
          onClick={() => navigate('/patient')}
        >
          ← <span style={{ fontSize: 12 }}>목록</span>
        </button>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, flex: 1, textAlign: 'center' }}>
          후속 설문
        </span>
        <div style={{ width: 56 }} />
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 80px' }}>

        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>⏳ 질문을 불러오는 중...</p>
          </div>
        ) : !recordId ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: '#dc2626', fontSize: 14 }}>기록 정보가 없습니다.</p>
            <button onClick={() => navigate('/patient')} style={{
              marginTop: 16, padding: '10px 20px',
              backgroundColor: '#1b508a', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>목록으로</button>
          </div>
        ) : (
          <>
            {/* 진행률 카드 */}
            <div style={{
              backgroundColor: '#fff', borderRadius: 14,
              padding: '16px 18px', marginBottom: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
                  설문 답변 현황
                </p>
                <span style={{ fontSize: 13, fontWeight: 600, color: answered === total && total > 0 ? '#16a34a' : '#1b508a' }}>
                  {answered} / {total}
                </span>
              </div>
              {/* 프로그레스 바 */}
              <div style={{
                height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: answered === total && total > 0 ? '#16a34a' : '#1b508a',
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              {total > 0 && answered < total && (
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  미답변 {total - answered}개 — 언제든지 답변을 추가할 수 있습니다.
                </p>
              )}
              {answered === total && total > 0 && (
                <p style={{ fontSize: 12, color: '#16a34a', marginTop: 8, fontWeight: 600 }}>
                  ✓ 모든 질문에 답변하셨습니다!
                </p>
              )}
            </div>

            {/* 저장 성공/실패 메시지 */}
            {saveMsg === 'success' && (
              <div style={{
                padding: '10px 16px', borderRadius: 8, marginBottom: 14,
                backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                fontSize: 13, color: '#16a34a', fontWeight: 500,
              }}>
                ✓ 답변이 저장되었습니다. 나중에 미답변 항목을 추가할 수 있습니다.
              </div>
            )}
            {saveMsg === 'error' && (
              <div style={{
                padding: '10px 16px', borderRadius: 8, marginBottom: 14,
                backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                fontSize: 13, color: '#dc2626',
              }}>
                ⚠ 저장에 실패했습니다. 다시 시도해 주세요.
              </div>
            )}

            {/* 공통 질문 카드 */}
            <div style={{
              backgroundColor: '#fff', borderRadius: 14,
              padding: '20px 18px', marginBottom: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 3, height: 14, backgroundColor: '#1b508a', borderRadius: 2, display: 'inline-block' }} />
                  공통 질문
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>담당 의사 선생님이 설정한 질문입니다.</p>
              </div>

              {commonQs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>
                  등록된 공통 질문이 없습니다.
                </div>
              ) : (
                commonQs.map(q => (
                  <QuestionItem
                    key={q.question_id}
                    question={q}
                    answer={answers[q.question_id] ?? { choice: null, text: '' }}
                    onChange={handleChange}
                  />
                ))
              )}
            </div>

            {/* AI 맞춤 질문 카드 */}
            <div style={{
              backgroundColor: '#fff', borderRadius: 14,
              padding: '20px 18px', marginBottom: 20,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 3, height: 14, backgroundColor: '#2563eb', borderRadius: 2, display: 'inline-block' }} />
                    AI 맞춤 질문
                  </p>
                  <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>오늘 기록을 AI가 분석하여 생성한 개인화 질문입니다.</p>
                </div>
                {aiPending && (
                  <span style={{
                    fontSize: 11, color: '#2563eb', fontWeight: 600,
                    backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: 10,
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                  }}>
                    ⏳ 분석 중
                  </span>
                )}
              </div>

              {aiPending && aiQs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
                  <p style={{ color: '#6b7280', fontSize: 13, fontWeight: 500 }}>AI가 맞춤 질문을 생성하고 있습니다...</p>
                  <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>잠시만 기다려 주세요</p>
                </div>
              ) : aiQs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
                  오늘은 AI 맞춤 질문이 생성되지 않았습니다.
                </div>
              ) : (
                <>
                  {aiQs.map(q => (
                    <QuestionItem
                      key={q.question_id}
                      question={q}
                      answer={answers[q.question_id] ?? { choice: null, text: '' }}
                      onChange={handleChange}
                    />
                  ))}
                  {aiPending && (
                    <div style={{
                      fontSize: 12, color: '#6b7280', textAlign: 'center',
                      padding: '8px 0 2px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      <span>⏳</span> AI가 추가 질문을 분석 중입니다...
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* 하단 고정 버튼 */}
      {!loading && recordId && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e7eb',
          padding: '12px 20px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
          zIndex: 100,
          maxWidth: 680, margin: '0 auto',
        }}>
          {/* 공통질문 미완료: 저장 버튼 */}
          {!allCommonAnswered && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{
                  flex: 1, height: 48,
                  backgroundColor: '#f3f4f6', color: '#6b7280',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
                onClick={() => navigate('/patient')}
              >
                나중에 하기
              </button>
              <button
                style={{
                  flex: 2, height: 48,
                  backgroundColor: saving ? '#9ca3af' : (hasNewAnswers ? '#1b508a' : '#9ca3af'),
                  color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 700,
                  cursor: saving || !hasNewAnswers ? 'not-allowed' : 'pointer',
                }}
                onClick={handleSave}
                disabled={saving || !hasNewAnswers}
              >
                {saving ? '저장 중...' : '답변 저장하기'}
              </button>
            </div>
          )}

          {/* 공통질문 완료: AI 문진 시작 버튼 */}
          {allCommonAnswered && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hasNewAnswers && (
                <button
                  style={{
                    width: '100%', height: 40,
                    backgroundColor: saving ? '#9ca3af' : '#f3f4f6',
                    color: '#6b7280',
                    border: 'none', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '변경 사항 저장'}
                </button>
              )}
              <button
                style={{
                  width: '100%', height: 52,
                  backgroundColor: '#1b508a', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 4px 12px rgba(27,80,138,0.3)',
                }}
                onClick={async () => {
                  if (hasNewAnswers) await handleSave()
                  navigate('/patient/conversation', { state: { recordId } })
                }}
              >
                🤖 AI 문진 시작하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
