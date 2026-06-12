/**
 * AiSurveyPage — AI 맞춤 질문 SSE 스트리밍 + 답변 제출 페이지 (SSE 흐름 Step 2)
 *
 * - 마운트 즉시 EventSource로 SSE 연결 → 질문 하나씩 실시간 표시
 * - 모든 질문 수신 완료 후 답변 입력 활성화
 * - POST /surveys/{recordId}/ai → AI 요약 백그라운드 트리거 → 완료 페이지
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import client from '../../api/client'
import { getMyRecords } from '../../api/records'

const C = {
  primary:      'var(--capd-primary)',
  bg:           'var(--bg-page)',
  bgCard:       'var(--bg-card)',
  border:       'var(--border)',
  text:         'var(--text-main)',
  textMuted:    'var(--text-muted)',
  success:      'var(--success)',
  successLight: 'var(--success-light)',
  successBorder:'var(--success-border)',
  danger:       'var(--danger)',
  dangerLight:  'var(--danger-light)',
  dangerBorder: 'var(--danger-border)',
  ai:           'var(--ai-accent)',
  aiLight:      'var(--ai-accent-light)',
  aiMedium:     'var(--ai-accent-medium)',
  aiBorder:     'var(--ai-accent-border)',
  gray:         'var(--text-dark)',
  grayMid:      'var(--text-muted)',
  grayBorder:   'var(--border)',
}

// ── 타입 ──────────────────────────────────────────────────

type QuestionType = 'yes_no' | 'single_select' | 'multi_select' | 'short_text'

interface AIQuestion {
  question_id: number
  question_text: string
  question_type: QuestionType
  options: string[] | null
  reason: string | null
  existing_choice?: 'yes' | 'no' | null
  existing_text_answer?: string | null
}

interface Answer {
  choice: 'yes' | 'no' | null
  selected: string[]
  text: string
}

const emptyAnswer = (): Answer => ({ choice: null, selected: [], text: '' })

// ── AI 질문 로딩 스켈레톤 ─────────────────────────────────
const AI_STEPS = [
  'KDIGO 지침 검색 중...',
  'AI가 기록을 분석하고 있습니다...',
  '맞춤 질문을 생성하고 있습니다...',
  '거의 다 됐어요!',
]

function AILoadingSkeleton() {
  const [stepIdx, setStepIdx] = useState(0)
  const [dots, setDots] = useState('')
  const stepRef = useRef(0)

  useEffect(() => {
    const stepTimer = setInterval(() => {
      stepRef.current = Math.min(stepRef.current + 1, AI_STEPS.length - 1)
      setStepIdx(stepRef.current)
    }, 8000)
    const dotTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 600)
    return () => { clearInterval(stepTimer); clearInterval(dotTimer) }
  }, [])

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        @keyframes spin {
          to { transform: rotate(360deg) }
        }
        .ai-skeleton-bar {
          border-radius: 6px;
          background: linear-gradient(90deg, var(--ai-accent-medium) 25%, var(--ai-accent-border) 50%, var(--ai-accent-medium) 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 16, padding: '10px 14px',
        backgroundColor: C.aiLight, borderRadius: 10, border: `1px solid ${C.aiBorder}`,
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          border: `2px solid ${C.ai}`, borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, color: C.ai, fontWeight: 600 }}>
          {AI_STEPS[stepIdx]}{dots}
        </span>
      </div>

      {[70, 55, 80].map((w, i) => (
        <div key={i} style={{
          padding: '16px', borderRadius: 10,
          backgroundColor: C.aiLight, border: `1px solid ${C.aiMedium}`, marginBottom: 10,
        }}>
          <div className="ai-skeleton-bar" style={{ width: 64, height: 16, marginBottom: 10 }} />
          <div className="ai-skeleton-bar" style={{ width: `${w}%`, height: 14, marginBottom: 6 }} />
          <div className="ai-skeleton-bar" style={{ width: '40%', height: 14, marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="ai-skeleton-bar" style={{ width: 56, height: 34, borderRadius: 8 }} />
            <div className="ai-skeleton-bar" style={{ width: 72, height: 34, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </>
  )
}

// ── 공통 하위 컴포넌트 ────────────────────────────────────

function AnsweredBadge() {
  return (
    <span style={{
      position: 'absolute', top: 12, right: 12,
      fontSize: 10, fontWeight: 700, color: C.success,
      backgroundColor: C.successLight, border: `1px solid ${C.successBorder}`,
      padding: '2px 8px', borderRadius: 20,
    }}>✓ 답변 완료</span>
  )
}

function QuestionLabel({ text, hasCheck }: { text: string; hasCheck: boolean }) {
  return (
    <p style={{
      fontSize: 14, color: C.text, fontWeight: 500,
      marginBottom: 12, lineHeight: 1.5,
      paddingRight: hasCheck ? 90 : 0,
    }}>
      <span style={{ color: 'var(--capd-primary)', fontWeight: 700, marginRight: 4 }}>Q.</span>
      {text}
    </p>
  )
}

function YesNoButtons({ value, onChange, positiveLabel, negativeLabel }: {
  value: 'yes' | 'no' | null
  onChange: (v: 'yes' | 'no') => void
  positiveLabel?: string
  negativeLabel?: string
}) {
  const labels: Record<'yes' | 'no', string> = {
    yes: positiveLabel ?? '예',
    no:  negativeLabel ?? '아니오',
  }
  return (
    <>
      {(['yes', 'no'] as const).map(v => (
        <button
          key={v}
          type="button"
          style={{
            height: 34, minWidth: 64, padding: '0 14px',
            borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
            backgroundColor: value === v ? C.primary : C.grayBorder,
            color: value === v ? '#fff' : C.gray,
            boxShadow: value === v ? '0 2px 6px rgba(123,107,181,0.3)' : 'none',
          }}
          onClick={() => onChange(v)}
        >{labels[v]}</button>
      ))}
    </>
  )
}

const textInputStyle: React.CSSProperties = {
  flex: 1, minWidth: 120, height: 34,
  borderRadius: 8, border: `1px solid var(--border)`,
  backgroundColor: 'var(--bg-card)', padding: '0 12px',
  fontSize: 13, color: 'var(--text-main)', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

// ── AI 질문 개별 렌더 ────────────────────────────────────

function AIQuestionItem({ question, answer, disabled, onChange }: {
  question: AIQuestion
  answer: Answer
  disabled: boolean
  onChange: (id: number, patch: Partial<Answer>) => void
}) {
  const qType = question.question_type ?? 'yes_no'
  const answered =
    (qType === 'yes_no' && answer.choice !== null) ||
    ((qType === 'single_select' || qType === 'multi_select') && answer.selected.length > 0) ||
    (qType === 'short_text' && answer.text.trim() !== '')

  return (
    <div style={{
      padding: '16px', borderRadius: 10,
      backgroundColor: disabled ? '#fafafa' : C.aiLight,
      border: `1px solid ${disabled ? C.grayBorder : C.aiBorder}`,
      marginBottom: 10, position: 'relative',
      opacity: disabled ? 0.6 : 1,
      transition: 'opacity 0.3s',
    }}>
      {answered && <AnsweredBadge />}
      <span style={{
        fontSize: 10, fontWeight: 700, color: C.ai,
        backgroundColor: C.aiMedium, border: `1px solid ${C.aiBorder}`,
        padding: '2px 7px', borderRadius: 20, marginBottom: 6,
        display: 'inline-block',
      }}>🤖 AI 추천</span>
      <QuestionLabel text={question.question_text} hasCheck={answered} />

      {!disabled && qType === 'yes_no' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <YesNoButtons
            value={answer.choice}
            onChange={(v) => onChange(question.question_id, { choice: v })}
            positiveLabel={question.options?.[0] ?? undefined}
            negativeLabel={question.options?.[1] ?? undefined}
          />
          <input
            type="text"
            placeholder="직접 입력 (선택사항)"
            style={textInputStyle}
            value={answer.text}
            onChange={e => onChange(question.question_id, { text: e.target.value })}
            className="capd-input"
          />
        </div>
      )}

      {!disabled && qType === 'single_select' && question.options && question.options.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options.map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name={`ai_single_${question.question_id}`}
                checked={answer.selected[0] === opt}
                onChange={() => onChange(question.question_id, { selected: [opt] })}
                style={{ accentColor: 'var(--capd-primary)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, color: C.text }}>{opt}</span>
            </label>
          ))}
        </div>
      )}

      {!disabled && qType === 'multi_select' && question.options && question.options.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options.map((opt) => {
            const checked = answer.selected.includes(opt)
            return (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? answer.selected.filter(s => s !== opt)
                      : [...answer.selected, opt]
                    onChange(question.question_id, { selected: next })
                  }}
                  style={{ accentColor: 'var(--capd-primary)', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: C.text }}>{opt}</span>
              </label>
            )
          })}
        </div>
      )}

      {!disabled && (qType === 'short_text' ||
        ((qType === 'single_select' || qType === 'multi_select') && (!question.options || question.options.length === 0))
      ) && (
        <input
          type="text"
          placeholder="답변을 입력해주세요"
          style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset' }}
          value={answer.text}
          onChange={e => onChange(question.question_id, { text: e.target.value })}
          className="capd-input"
        />
      )}

      {disabled && (
        <p style={{ fontSize: 13, color: C.grayMid, marginTop: 4 }}>질문 생성 완료 후 답변 가능합니다.</p>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function AiSurveyPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const stateRecordId: number | undefined = (location.state as { recordId?: number; aiReset?: boolean })?.recordId
  const aiReset: boolean = (location.state as { aiReset?: boolean })?.aiReset === true
  // state 없으면(새로고침·직접 진입) 오늘 기록을 API로 자동 조회하는 폴백
  const [recordId, setRecordId] = useState<number | undefined>(stateRecordId)
  const [resolving, setResolving] = useState<boolean>(!stateRecordId)

  useEffect(() => {
    if (recordId) { setResolving(false); return }
    getMyRecords()
      .then(recs => {
        const today = new Date().toLocaleDateString('sv-SE')
        const todayRec = recs.find(r => r.record_date === today)
        if (todayRec) setRecordId(todayRec.id)
      })
      .catch(() => { /* 무시 */ })
      .finally(() => setResolving(false))
  }, [recordId])

  const [questions,    setQuestions]    = useState<AIQuestion[]>([])
  const [answers,      setAnswers]      = useState<Record<number, Answer>>({})
  const [sseLoading,   setSseLoading]   = useState(true)   // SSE 연결 중
  const [sseError,     setSseError]     = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')
  const esRef = useRef<EventSource | null>(null)

  const connectSSE = useCallback(() => {
    if (!recordId) return
    const token = localStorage.getItem('access_token') ?? ''
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
    const url = `${apiBase}/api/v1/surveys/${recordId}/ai-questions/stream?token=${encodeURIComponent(token)}`

    setSseLoading(true)
    setSseError('')

    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const q: AIQuestion = JSON.parse(event.data)
        setQuestions(prev => {
          // 중복 방지
          if (prev.some(p => p.question_id === q.question_id)) return prev
          return [...prev, q]
        })
        setAnswers(prev => {
          if (prev[q.question_id]) return prev
          // 기존 답변이 있으면 pre-fill
          const qType = q.question_type ?? 'yes_no'
          const existingText = q.existing_text_answer ?? ''
          let initial: Answer = emptyAnswer()
          if (qType === 'yes_no') {
            initial = { choice: q.existing_choice ?? null, selected: [], text: existingText }
          } else if (qType === 'single_select' || qType === 'multi_select') {
            initial = { choice: null, selected: existingText ? existingText.split(',').map(s => s.trim()).filter(Boolean) : [], text: '' }
          } else {
            initial = { choice: null, selected: [], text: existingText }
          }
          return { ...prev, [q.question_id]: initial }
        })
      } catch (e) {
        console.error('SSE 질문 파싱 실패:', e)
      }
    }

    es.addEventListener('done', () => {
      setSseLoading(false)
      es.close()
      esRef.current = null
    })

    es.addEventListener('error', (event) => {
      const msgEvent = event as MessageEvent
      try {
        const data = JSON.parse(msgEvent.data || '{}')
        setSseError(data.message || 'AI 질문 생성 중 오류가 발생했습니다.')
      } catch {
        setSseError('AI 질문 생성 중 오류가 발생했습니다.')
      }
      setSseLoading(false)
      es.close()
      esRef.current = null
    })

    es.onerror = () => {
      // 네트워크 레벨 연결 오류 — 서버 event: error와 구분
      // 이미 done/error 이벤트로 닫힌 경우 무시
      if (esRef.current !== es) return
      setSseError('서버와 연결이 끊겼습니다. 잠시 후 다시 시도해주세요.')
      setSseLoading(false)
      es.close()
      esRef.current = null
    }
  }, [recordId])

  useEffect(() => {
    connectSSE()
    return () => {
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
    }
  }, [connectSSE])

  function handleChange(id: number, patch: Partial<Answer>) {
    setAnswers(prev => ({ ...prev, [id]: { ...emptyAnswer(), ...prev[id], ...patch } }))
  }

  const allAnswered = !sseLoading && questions.length > 0 && questions.every(q => {
    const a = answers[q.question_id]
    const qType = q.question_type ?? 'yes_no'
    if (!a) return false
    if (qType === 'yes_no') return a.choice !== null
    if (qType === 'single_select' || qType === 'multi_select') {
      const hasOptions = q.options && q.options.length > 0
      return hasOptions ? a.selected.length > 0 : a.text.trim() !== ''
    }
    if (qType === 'short_text') return a.text.trim() !== ''
    return false
  })

  async function handleSubmit() {
    if (!recordId || submitting) return
    setSubmitting(true)
    setSubmitError('')

    const responses: object[] = []
    questions.forEach(q => {
      const a = answers[q.question_id]
      if (!a) return
      const qType = q.question_type ?? 'yes_no'
      let choice: string | null = null
      let text = ''
      if (qType === 'yes_no') {
        choice = a.choice
        text   = a.text
      } else if (qType === 'single_select' || qType === 'multi_select') {
        const hasOptions = q.options && q.options.length > 0
        text = hasOptions ? a.selected.join(', ') : a.text
      } else {
        text = a.text
      }
      if (choice !== null || text.trim() !== '') {
        responses.push({ question_id: q.question_id, question_type: 'ai', choice, text_answer: text })
      }
    })

    try {
      await client.post(`/api/v1/surveys/${recordId}/ai`, {
        record_id: recordId,
        responses,
      })
      navigate('/patient/survey/done', { state: { recordId }, replace: true })
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        // 이미 제출됨
        navigate('/patient/survey/done', { state: { recordId }, replace: true })
      } else {
        setSubmitError('제출에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        setSubmitting(false)
      }
    }
  }

  // 질문이 없고 SSE도 완료된 경우 (0개 생성)
  const noQuestions = !sseLoading && questions.length === 0 && !sseError

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* 헤더 */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        backgroundColor: 'var(--capd-primary)',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        zIndex: 100, boxShadow: '0 2px 8px rgba(123,107,181,0.25)',
      }}>
        <button
          style={{
            color: '#fff', fontSize: 14, cursor: 'pointer',
            background: 'none', border: 'none', padding: '0 10px 0 0',
            display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
          }}
          onClick={() => navigate('/patient/survey/common', { state: { recordId } })}
        >
          ← <span style={{ fontSize: 12 }}>이전</span>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>
            {localStorage.getItem('user_name') ?? ''}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginLeft: 6 }}>
            AI 맞춤 질문 (2/2)
          </span>
        </div>
        <div style={{ width: 56 }} />
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 160px' }}>
        {aiReset && (
          <div style={{
            margin: '0 0 20px', padding: '14px 16px', borderRadius: 12,
            backgroundColor: 'var(--warning-light)', border: '1.5px solid var(--warning-border)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--warning-text)' }}>
                공통 질문이 수정되어 AI 질문이 새로 생성되었습니다.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--warning-text-sub)' }}>
                아래 새 질문에 모두 답변하신 후 최종 제출해 주세요.
              </p>
            </div>
          </div>
        )}
        {resolving ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: C.textMuted, fontSize: 14 }}>⏳ 기록 정보를 불러오는 중...</p>
          </div>
        ) : !recordId ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: C.danger, fontSize: 14 }}>기록 정보가 없습니다.</p>
            <button onClick={() => navigate('/patient')} style={{
              marginTop: 16, padding: '10px 20px',
              backgroundColor: C.primary, color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>목록으로</button>
          </div>
        ) : (
          <>
            {submitError && (
              <div style={{
                padding: '10px 16px', borderRadius: 8, marginBottom: 14,
                backgroundColor: C.dangerLight, border: `1px solid ${C.dangerBorder}`,
                fontSize: 13, color: C.danger,
              }}>⚠ {submitError}</div>
            )}

            <div style={{
              backgroundColor: C.bgCard, borderRadius: 14,
              padding: '20px 18px', marginBottom: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${C.aiBorder}`,
            }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 3, height: 14, backgroundColor: C.ai, borderRadius: 2, display: 'inline-block' }} />
                  AI 추천 질문
                </p>
                <p style={{ fontSize: 12, color: C.grayMid, marginTop: 3 }}>
                  오늘 기록과 공통 질문 답변을 바탕으로 AI가 생성한 질문입니다.
                </p>
              </div>

              {/* SSE 로딩 중 스켈레톤 */}
              {sseLoading && <AILoadingSkeleton />}

              {/* 생성된 질문들 (실시간 표시) */}
              {questions.map(q => (
                <AIQuestionItem
                  key={q.question_id}
                  question={q}
                  answer={answers[q.question_id] ?? emptyAnswer()}
                  disabled={sseLoading}
                  onChange={handleChange}
                />
              ))}

              {/* SSE 에러 */}
              {sseError && (
                <div style={{
                  padding: '16px', borderRadius: 10,
                  backgroundColor: C.dangerLight, border: `1px solid ${C.dangerBorder}`,
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: 13, color: C.danger, marginBottom: 12 }}>
                    ⚠ {sseError}
                  </p>
                  <button
                    onClick={connectSSE}
                    style={{
                      padding: '8px 20px', borderRadius: 8,
                      backgroundColor: C.primary, color: '#fff',
                      border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {/* 질문 0개 */}
              {noQuestions && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: C.grayMid, fontSize: 13 }}>
                  오늘 기록에 특이사항이 없어 AI 추천 질문이 없습니다.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* 하단 버튼 */}
      {recordId && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: C.bgCard, borderTop: `1px solid ${C.grayBorder}`,
          padding: '12px 20px', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', zIndex: 100,
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <button
              style={{
                width: '100%', height: 52,
                backgroundColor: (allAnswered || noQuestions) && !submitting ? C.primary : C.grayMid,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                cursor: (allAnswered || noQuestions) && !submitting ? 'pointer' : 'not-allowed',
                boxShadow: (allAnswered || noQuestions) && !submitting ? '0 4px 12px rgba(123,107,181,0.3)' : 'none',
              }}
              onClick={handleSubmit}
              disabled={(!allAnswered && !noQuestions) || sseLoading || submitting}
            >
              {submitting
                ? '제출 중...'
                : sseLoading
                  ? '🤖 AI 질문 생성 중...'
                  : (allAnswered || noQuestions)
                    ? '✅ 설문 완료하기'
                    : '모든 질문에 답변해주세요'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
