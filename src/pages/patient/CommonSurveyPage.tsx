/**
 * CommonSurveyPage — 공통질문 답변 페이지 (SSE 흐름 Step 1)
 *
 * - 공통질문 0개: 자동으로 AiSurveyPage로 redirect
 * - 공통질문 답변 제출: POST /surveys/{recordId}/common → AiSurveyPage로 이동
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import client from '../../api/client'

// ── 타입 ──────────────────────────────────────────────────

type QuestionType = 'yes_no' | 'single_select' | 'multi_select' | 'short_text'

interface CommonQuestion {
  question_id: number
  question_text: string
  question_type: QuestionType
  options: string[] | null
  choice: 'yes' | 'no' | null
  text_answer: string | null
  answered: boolean
}

interface Answer {
  choice: 'yes' | 'no' | null
  selected: string[]
  text: string
}

const emptyAnswer = (): Answer => ({ choice: null, selected: [], text: '' })

// ── 공통 하위 컴포넌트 ────────────────────────────────────

function AnsweredBadge() {
  return (
    <span style={{
      position: 'absolute', top: 12, right: 12,
      fontSize: 10, fontWeight: 700, color: '#16a34a',
      backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
      padding: '2px 8px', borderRadius: 20,
    }}>✓ 답변 완료</span>
  )
}

function QuestionLabel({ text, hasCheck }: { text: string; hasCheck: boolean }) {
  return (
    <p style={{
      fontSize: 14, color: '#1a1a2e', fontWeight: 500,
      marginBottom: 12, lineHeight: 1.5,
      paddingRight: hasCheck ? 90 : 0,
    }}>
      <span style={{ color: 'var(--capd-primary)', fontWeight: 700, marginRight: 4 }}>Q.</span>
      {text}
    </p>
  )
}

function YesNoButtons({ value, onChange }: {
  value: 'yes' | 'no' | null
  onChange: (v: 'yes' | 'no') => void
}) {
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
            backgroundColor: value === v ? 'var(--capd-primary)' : '#e5e7eb',
            color: value === v ? '#fff' : '#374151',
            boxShadow: value === v ? '0 2px 6px rgba(123,107,181,0.3)' : 'none',
          }}
          onClick={() => onChange(v)}
        >{v === 'yes' ? '예' : '아니오'}</button>
      ))}
    </>
  )
}

const textInputStyle: React.CSSProperties = {
  flex: 1, minWidth: 120, height: 34,
  borderRadius: 8, border: '1px solid #e5e7eb',
  backgroundColor: '#fff', padding: '0 12px',
  fontSize: 13, color: '#1a1a2e', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

// ── 개별 질문 컴포넌트 ────────────────────────────────────

function CommonQuestionItem({ question, answer, onChange }: {
  question: CommonQuestion
  answer: Answer
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
      backgroundColor: '#f9fafb', border: '1px solid #e5e7eb',
      marginBottom: 10, position: 'relative',
    }}>
      {answered && <AnsweredBadge />}
      <QuestionLabel text={question.question_text} hasCheck={answered} />

      {qType === 'yes_no' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <YesNoButtons value={answer.choice} onChange={(v) => onChange(question.question_id, { choice: v })} />
          <input
            type="text"
            placeholder="비고 (선택사항)"
            style={textInputStyle}
            value={answer.text}
            onChange={e => onChange(question.question_id, { text: e.target.value })}
            className="capd-input"
          />
        </div>
      )}

      {qType === 'single_select' && question.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options.map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name={`single_${question.question_id}`}
                checked={answer.selected[0] === opt}
                onChange={() => onChange(question.question_id, { selected: [opt] })}
                style={{ accentColor: 'var(--capd-primary)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, color: '#1a1a2e' }}>{opt}</span>
            </label>
          ))}
          <input
            type="text" placeholder="비고 (선택사항)"
            style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset', marginTop: 4 }}
            value={answer.text}
            onChange={e => onChange(question.question_id, { text: e.target.value })}
            className="capd-input"
          />
        </div>
      )}

      {qType === 'multi_select' && question.options && (
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
                <span style={{ fontSize: 14, color: '#1a1a2e' }}>{opt}</span>
              </label>
            )
          })}
          <input
            type="text" placeholder="비고 (선택사항)"
            style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset', marginTop: 4 }}
            value={answer.text}
            onChange={e => onChange(question.question_id, { text: e.target.value })}
            className="capd-input"
          />
        </div>
      )}

      {qType === 'short_text' && (
        <input
          type="text" placeholder="답변을 입력해주세요"
          style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset' }}
          value={answer.text}
          onChange={e => onChange(question.question_id, { text: e.target.value })}
          className="capd-input"
        />
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────

export default function CommonSurveyPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const recordId: number | undefined = (location.state as { recordId?: number })?.recordId

  const [questions,  setQuestions]  = useState<CommonQuestion[]>([])
  const [answers,    setAnswers]    = useState<Record<number, Answer>>({})
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const loadQuestions = useCallback(async () => {
    if (!recordId) return
    try {
      const res = await client.get(`/api/v1/surveys/my-responses/${recordId}`)
      const cqs: CommonQuestion[] = (res.data.common_questions ?? [])
      setQuestions(cqs)

      // 기존 답변 초기화
      const initial: Record<number, Answer> = {}
      cqs.forEach(q => {
        const qType = q.question_type ?? 'yes_no'
        const isSelect = qType === 'single_select' || qType === 'multi_select'
        initial[q.question_id] = {
          choice:   qType === 'yes_no' ? (q.choice ?? null) : null,
          selected: isSelect && q.text_answer
            ? q.text_answer.split(',').map(s => s.trim()).filter(Boolean)
            : [],
          text: qType === 'short_text' ? (q.text_answer ?? '') : '',
        }
      })
      setAnswers(initial)

      // 공통질문 없으면 바로 AI 질문 페이지로 이동
      if (cqs.length === 0) {
        navigate('/patient/survey/ai', { state: { recordId }, replace: true })
      }
    } catch (e) {
      console.error('공통질문 로드 실패:', e)
      setError('질문을 불러오는 데 실패했습니다.')
    }
  }, [recordId, navigate])

  useEffect(() => {
    if (!recordId) { setLoading(false); return }
    loadQuestions().finally(() => setLoading(false))
  }, [recordId, loadQuestions])

  function handleChange(id: number, patch: Partial<Answer>) {
    setAnswers(prev => ({ ...prev, [id]: { ...emptyAnswer(), ...prev[id], ...patch } }))
  }

  const allAnswered = questions.every(q => {
    const a = answers[q.question_id]
    const qType = q.question_type ?? 'yes_no'
    if (!a) return false
    if (qType === 'yes_no') return a.choice !== null
    if (qType === 'single_select' || qType === 'multi_select') return a.selected.length > 0
    if (qType === 'short_text') return a.text.trim() !== ''
    return false
  })

  async function handleSubmit() {
    if (!recordId || submitting) return
    setSubmitting(true)
    setError('')

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
        text = a.selected.join(', ')
      } else {
        text = a.text
      }
      if (choice !== null || text.trim() !== '') {
        responses.push({ question_id: q.question_id, question_type: 'common', choice, text_answer: text })
      }
    })

    try {
      await client.post(`/api/v1/surveys/${recordId}/common`, {
        record_id: recordId,
        responses,
      })
      navigate('/patient/survey/ai', { state: { recordId } })
    } catch {
      setError('제출에 실패했습니다. 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa' }}>
      {/* 헤더 */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        backgroundColor: 'var(--capd-primary)',
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
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>
            {localStorage.getItem('user_name') ?? ''}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginLeft: 6 }}>
            공통 질문 (1/2)
          </span>
        </div>
        <div style={{ width: 56 }} />
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 160px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>⏳ 질문을 불러오는 중...</p>
          </div>
        ) : !recordId ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: '#dc2626', fontSize: 14 }}>기록 정보가 없습니다.</p>
            <button onClick={() => navigate('/patient')} style={{
              marginTop: 16, padding: '10px 20px',
              backgroundColor: 'var(--capd-primary)', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>목록으로</button>
          </div>
        ) : (
          <>
            {error && (
              <div style={{
                padding: '10px 16px', borderRadius: 8, marginBottom: 14,
                backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                fontSize: 13, color: '#dc2626',
              }}>⚠ {error}</div>
            )}

            <div style={{
              backgroundColor: '#fff', borderRadius: 14,
              padding: '20px 18px', marginBottom: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb',
            }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 3, height: 14, backgroundColor: 'var(--capd-primary)', borderRadius: 2, display: 'inline-block' }} />
                  공통 질문
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>담당 의사 선생님이 설정한 질문입니다.</p>
              </div>

              {questions.map(q => (
                <CommonQuestionItem
                  key={q.question_id}
                  question={q}
                  answer={answers[q.question_id] ?? emptyAnswer()}
                  onChange={handleChange}
                />
              ))}
            </div>

            {/* 진행 안내 */}
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              backgroundColor: '#f0f4ff', border: '1px solid #c7d2fe',
              fontSize: 13, color: '#3730a3', marginBottom: 8,
            }}>
              💡 공통 질문 완료 후 AI가 맞춤 질문을 생성합니다.
            </div>
          </>
        )}
      </main>

      {/* 하단 버튼 */}
      {!loading && recordId && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff', borderTop: '1px solid #e5e7eb',
          padding: '12px 20px', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)', zIndex: 100,
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <button
              style={{
                width: '100%', height: 52,
                backgroundColor: allAnswered && !submitting ? 'var(--capd-primary)' : '#9ca3af',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                cursor: allAnswered && !submitting ? 'pointer' : 'not-allowed',
                boxShadow: allAnswered && !submitting ? '0 4px 12px rgba(123,107,181,0.3)' : 'none',
              }}
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
            >
              {submitting ? '저장 중...' : allAnswered ? 'AI 질문 받으러 가기 →' : '모든 질문에 답변해주세요'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
