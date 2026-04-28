import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import client from '../../api/client'

// ── 타입 ──────────────────────────────────────────────────

type QuestionType = 'yes_no' | 'single_select' | 'multi_select' | 'short_text'

interface CommonQuestion {
  question_id: number
  question_text: string
  question_type: QuestionType
  options: string[] | null
  type: 'common'
  choice: 'yes' | 'no' | null
  text_answer: string | null
  answered: boolean
}

interface AIQuestion {
  question_id: number
  question_text: string
  question_type: QuestionType
  options: string[] | null
  reason: string | null
  type: 'ai'
  choice: 'yes' | 'no' | null
  text_answer: string | null
  answered: boolean
}

interface Answer {
  choice: 'yes' | 'no' | null   // yes_no 전용
  selected: string[]             // single_select / multi_select
  text: string                   // short_text 및 보조 텍스트
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
    // 단계 메시지: 8초마다 전진
    const stepTimer = setInterval(() => {
      stepRef.current = Math.min(stepRef.current + 1, AI_STEPS.length - 1)
      setStepIdx(stepRef.current)
    }, 8000)
    // 점 애니메이션: 600ms
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
          background: linear-gradient(90deg, #ede9fe 25%, #ddd6fe 50%, #ede9fe 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite linear;
        }
      `}</style>

      {/* 상태 메시지 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 16, padding: '10px 14px',
        backgroundColor: '#f5f3ff', borderRadius: 10, border: '1px solid #ddd6fe',
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          border: '2px solid #7c3aed', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>
          {AI_STEPS[stepIdx]}{dots}
        </span>
      </div>

      {/* 스켈레톤 카드 3개 */}
      {[70, 55, 80].map((w, i) => (
        <div key={i} style={{
          padding: '16px', borderRadius: 10,
          backgroundColor: '#f5f3ff', border: '1px solid #ede9fe',
          marginBottom: 10,
        }}>
          {/* AI 추천 뱃지 스켈레톤 */}
          <div className="ai-skeleton-bar" style={{ width: 64, height: 16, marginBottom: 10 }} />
          {/* 질문 텍스트 스켈레톤 */}
          <div className="ai-skeleton-bar" style={{ width: `${w}%`, height: 14, marginBottom: 6 }} />
          <div className="ai-skeleton-bar" style={{ width: '40%', height: 14, marginBottom: 14 }} />
          {/* 버튼 스켈레톤 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="ai-skeleton-bar" style={{ width: 56, height: 34, borderRadius: 8 }} />
            <div className="ai-skeleton-bar" style={{ width: 72, height: 34, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </>
  )
}

// ── 공통 질문 컴포넌트 (타입별 렌더) ─────────────────────
function CommonQuestionItem({ question, answer, onChange }: {
  question: CommonQuestion
  answer: Answer
  onChange: (id: number, type: 'common', patch: Partial<Answer>) => void
}) {
  const qType = question.question_type ?? 'yes_no'
  const answered =
    (qType === 'yes_no' && answer.choice !== null) ||
    (qType === 'single_select' && answer.selected.length > 0) ||
    (qType === 'multi_select' && answer.selected.length > 0) ||
    (qType === 'short_text' && answer.text.trim() !== '')

  return (
    <div style={{
      padding: '16px', borderRadius: 10,
      backgroundColor: '#f9fafb', border: '1px solid #e5e7eb',
      marginBottom: 10, position: 'relative',
    }}>
      {answered && <AnsweredBadge />}
      <QuestionLabel text={question.question_text} hasCheck={answered} />

      {/* 예/아니오 */}
      {qType === 'yes_no' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <YesNoButtons
            value={answer.choice}
            onChange={(v) => onChange(question.question_id, 'common', { choice: v })}
          />
          <input
            type="text"
            placeholder="비고 (선택사항)"
            style={textInputStyle}
            value={answer.text}
            onChange={e => onChange(question.question_id, 'common', { text: e.target.value })}
            onFocus={e => { e.target.style.borderColor = 'var(--capd-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,107,181,0.10)' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
          />
        </div>
      )}

      {/* 단일 선택 */}
      {qType === 'single_select' && question.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options.map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name={`common_single_${question.question_id}`}
                checked={answer.selected[0] === opt}
                onChange={() => onChange(question.question_id, 'common', { selected: [opt] })}
                style={{ accentColor: 'var(--capd-primary)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, color: '#1a1a2e' }}>{opt}</span>
            </label>
          ))}
          <input
            type="text"
            placeholder="비고 (선택사항)"
            style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset', marginTop: 4 }}
            value={answer.text}
            onChange={e => onChange(question.question_id, 'common', { text: e.target.value })}
            onFocus={e => { e.target.style.borderColor = 'var(--capd-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,107,181,0.10)' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
          />
        </div>
      )}

      {/* 다중 선택 */}
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
                    onChange(question.question_id, 'common', { selected: next })
                  }}
                  style={{ accentColor: 'var(--capd-primary)', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: '#1a1a2e' }}>{opt}</span>
              </label>
            )
          })}
          <input
            type="text"
            placeholder="비고 (선택사항)"
            style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset', marginTop: 4 }}
            value={answer.text}
            onChange={e => onChange(question.question_id, 'common', { text: e.target.value })}
            onFocus={e => { e.target.style.borderColor = 'var(--capd-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,107,181,0.10)' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
          />
        </div>
      )}

      {/* 서술식 — 비고 없이 텍스트만 */}
      {qType === 'short_text' && (
        <input
          type="text"
          placeholder="답변을 입력해주세요"
          style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset' }}
          value={answer.text}
          onChange={e => onChange(question.question_id, 'common', { text: e.target.value })}
          onFocus={e => { e.target.style.borderColor = 'var(--capd-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,107,181,0.10)' }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
        />
      )}
    </div>
  )
}

// ── AI 질문 컴포넌트 (타입별 렌더) ───────────────────────
function AIQuestionItem({ question, answer, onChange }: {
  question: AIQuestion
  answer: Answer
  onChange: (id: number, type: 'ai', patch: Partial<Answer>) => void
}) {
  const qType = question.question_type ?? 'yes_no'
  const answered =
    (qType === 'yes_no' && answer.choice !== null) ||
    (qType === 'single_select' && answer.selected.length > 0) ||
    (qType === 'multi_select' && answer.selected.length > 0) ||
    (qType === 'short_text' && answer.text.trim() !== '')

  return (
    <div style={{
      padding: '16px', borderRadius: 10,
      backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe',
      marginBottom: 10, position: 'relative',
    }}>
      {answered && <AnsweredBadge />}
      <span style={{
        fontSize: 10, fontWeight: 700, color: '#7c3aed',
        backgroundColor: '#ede9fe', border: '1px solid #ddd6fe',
        padding: '2px 7px', borderRadius: 20, marginBottom: 6,
        display: 'inline-block',
      }}>🤖 AI 추천</span>
      <QuestionLabel text={question.question_text} hasCheck={answered} />

      {qType === 'yes_no' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <YesNoButtons
            value={answer.choice}
            onChange={(v) => onChange(question.question_id, 'ai', { choice: v })}
            positiveLabel={question.options?.[0] ?? undefined}
            negativeLabel={question.options?.[1] ?? undefined}
          />
          <input
            type="text"
            placeholder="직접 입력 (선택사항)"
            style={textInputStyle}
            value={answer.text}
            onChange={e => onChange(question.question_id, 'ai', { text: e.target.value })}
            onFocus={e => { e.target.style.borderColor = 'var(--capd-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,107,181,0.10)' }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
          />
        </div>
      )}

      {qType === 'single_select' && question.options && question.options.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {question.options.map((opt) => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name={`single_${question.question_id}`}
                checked={answer.selected[0] === opt}
                onChange={() => onChange(question.question_id, 'ai', { selected: [opt] })}
                style={{ accentColor: 'var(--capd-primary)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 14, color: '#1a1a2e' }}>{opt}</span>
            </label>
          ))}
        </div>
      )}

      {qType === 'multi_select' && question.options && question.options.length > 0 && (
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
                    onChange(question.question_id, 'ai', { selected: next })
                  }}
                  style={{ accentColor: 'var(--capd-primary)', width: 16, height: 16 }}
                />
                <span style={{ fontSize: 14, color: '#1a1a2e' }}>{opt}</span>
              </label>
            )
          })}
        </div>
      )}

      {/* options 없는 select 타입 폴백 — short_text로 렌더 */}
      {(qType === 'single_select' || qType === 'multi_select') && (!question.options || question.options.length === 0) && (
        <input
          type="text"
          placeholder="답변을 입력해주세요"
          style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset' }}
          value={answer.text}
          onChange={e => onChange(question.question_id, 'ai', { text: e.target.value })}
          onFocus={e => { e.target.style.borderColor = 'var(--capd-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,107,181,0.10)' }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
        />
      )}

      {qType === 'short_text' && (
        <input
          type="text"
          placeholder="답변을 입력해주세요"
          style={{ ...textInputStyle, width: '100%', flex: 'unset', minWidth: 'unset' }}
          value={answer.text}
          onChange={e => onChange(question.question_id, 'ai', { text: e.target.value })}
          onFocus={e => { e.target.style.borderColor = 'var(--capd-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(123,107,181,0.10)' }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none' }}
        />
      )}
    </div>
  )
}

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
            backgroundColor: value === v ? 'var(--capd-primary)' : '#e5e7eb',
            color: value === v ? '#fff' : '#374151',
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
  borderRadius: 8, border: '1px solid #e5e7eb',
  backgroundColor: '#fff', padding: '0 12px',
  fontSize: 13, color: '#1a1a2e', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function SurveyPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const recordId: number | undefined = (location.state as { recordId?: number })?.recordId

  const [commonQs,   setCommonQs]   = useState<CommonQuestion[]>([])
  const [aiQs,       setAiQs]       = useState<AIQuestion[]>([])
  const [answers,    setAnswers]     = useState<Record<string, Answer>>({})
  const [loading,    setLoading]     = useState(true)
  const [aiPending,  setAiPending]   = useState(false)
  const [saving,     setSaving]      = useState(false)
  const [completing, setCompleting]  = useState(false)
  const [saveMsg,    setSaveMsg]     = useState<'success' | 'error' | null>(null)
  const [completeError, setCompleteError] = useState('')

  // ── 질문 + 기존 답변 로드 ───────────────────────────────
  const loadAll = useCallback(async () => {
    if (!recordId) return
    try {
      const res = await client.get(`/api/v1/surveys/my-responses/${recordId}`)
      const data = res.data

      const cqs: CommonQuestion[] = (data.common_questions ?? []).map((q: CommonQuestion) => ({
        ...q, type: 'common' as const,
      }))
      const aqs: AIQuestion[] = (data.ai_questions ?? []).map((q: AIQuestion) => ({
        ...q, type: 'ai' as const,
      }))

      setCommonQs(cqs)
      setAiQs(aqs)
      setAiPending(data.ai_pending ?? false)

      setAnswers(prev => {
        const next = { ...prev }
        cqs.forEach(q => {
          const key = `common_${q.question_id}`
          if (!(key in next)) {
            const cType = q.question_type ?? 'yes_no'
            const isSelect = cType === 'single_select' || cType === 'multi_select'
            next[key] = {
              choice:   cType === 'yes_no' ? (q.choice ?? null) : null,
              selected: isSelect && q.text_answer
                ? q.text_answer.split(',').map(s => s.trim()).filter(Boolean)
                : [],
              text: cType === 'short_text' ? (q.text_answer ?? '') : (cType === 'yes_no' ? '' : ''),
            }
          }
        })
        aqs.forEach(q => {
          const key = `ai_${q.question_id}`
          if (!(key in next)) {
            const qType = q.question_type ?? 'yes_no'
            const isSelect = qType === 'single_select' || qType === 'multi_select'
            next[key] = {
              choice:   qType === 'yes_no' ? (q.choice ?? null) : null,
              selected: isSelect && q.text_answer
                ? q.text_answer.split(',').map(s => s.trim()).filter(Boolean)
                : [],
              text: qType === 'short_text' ? (q.text_answer ?? '') : (qType === 'yes_no' ? '' : ''),
            }
          }
        })
        return next
      })
    } catch (e) {
      console.error('질문 로드 실패:', e)
    }
  }, [recordId])

  useEffect(() => {
    if (!recordId) { setLoading(false); return }
    loadAll().finally(() => setLoading(false))
  }, [recordId, loadAll])

  // AI 질문 pending 중 폴링 (3초마다)
  useEffect(() => {
    if (!aiPending || !recordId) return
    const timer = setInterval(async () => {
      try {
        const res = await client.get(`/api/v1/surveys/my-responses/${recordId}`)
        if (!res.data.ai_pending) {
          const aqs: AIQuestion[] = (res.data.ai_questions ?? []).map((q: AIQuestion) => ({
            ...q, type: 'ai' as const,
          }))
          setAiQs(aqs)
          setAiPending(false)
          clearInterval(timer)
        }
      } catch {}
    }, 3000)
    return () => clearInterval(timer)
  }, [aiPending, recordId])

  function handleChange(id: number, type: 'common' | 'ai', patch: Partial<Answer>) {
    const key = `${type}_${id}`
    setAnswers(prev => ({ ...prev, [key]: { ...emptyAnswer(), ...prev[key], ...patch } }))
  }

  // ── 임시 저장 ─────────────────────────────────────────
  async function handleSave() {
    if (!recordId) return
    setSaving(true)
    setSaveMsg(null)

    const responses: object[] = []

    commonQs.forEach(q => {
      const a = answers[`common_${q.question_id}`]
      if (!a) return
      const cType = q.question_type ?? 'yes_no'
      let cChoice: string | null = null
      let cText = ''
      if (cType === 'yes_no') {
        cChoice = a.choice
        cText   = a.text
      } else if (cType === 'single_select' || cType === 'multi_select') {
        cText = a.selected.join(', ')
      } else {
        cText = a.text
      }
      if (cChoice !== null || cText.trim() !== '') {
        responses.push({ question_id: q.question_id, question_type: 'common', choice: cChoice, text_answer: cText })
      }
    })

    aiQs.forEach(q => {
      const a = answers[`ai_${q.question_id}`]
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
        responses.push({ question_id: q.question_id, question_type: 'ai', choice, text_answer: text })
      }
    })

    try {
      await client.post('/api/v1/surveys/responses', { record_id: recordId, responses })
      setSaveMsg('success')
      await loadAll()
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setSaveMsg('error')
    } finally {
      setSaving(false)
    }
  }

  // ── 설문 완료 → AI 요약 트리거 ───────────────────────
  async function handleComplete() {
    if (!recordId || completing) return
    setCompleting(true)
    setCompleteError('')

    // 먼저 저장
    setSaving(true)
    const responses: object[] = []
    commonQs.forEach(q => {
      const a = answers[`common_${q.question_id}`]
      if (!a) return
      const cType = q.question_type ?? 'yes_no'
      let cChoice: string | null = null
      let cText = ''
      if (cType === 'yes_no') {
        cChoice = a.choice
        cText   = a.text
      } else if (cType === 'single_select' || cType === 'multi_select') {
        cText = a.selected.join(', ')
      } else {
        cText = a.text
      }
      if (cChoice !== null || cText.trim() !== '') {
        responses.push({ question_id: q.question_id, question_type: 'common', choice: cChoice, text_answer: cText })
      }
    })
    aiQs.forEach(q => {
      const a = answers[`ai_${q.question_id}`]
      if (!a) return
      const qType = q.question_type ?? 'yes_no'
      let choice: string | null = null
      let text = ''
      if (qType === 'yes_no') { choice = a.choice; text = a.text }
      else if (qType === 'single_select' || qType === 'multi_select') { text = a.selected.join(', ') }
      else { text = a.text }
      if (choice !== null || text.trim() !== '') {
        responses.push({ question_id: q.question_id, question_type: 'ai', choice, text_answer: text })
      }
    })
    try {
      await client.post('/api/v1/surveys/responses', { record_id: recordId, responses })
    } catch { /* 저장 실패해도 complete 시도 */ }
    setSaving(false)

    // AI 요약 요청
    try {
      await client.post(`/api/v1/surveys/complete/${recordId}`)
      navigate('/patient/survey/done', { state: { recordId }, replace: true })
    } catch {
      setCompleteError('AI 요약 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      setCompleting(false)
    }
  }

  // ── 완료 가능 여부 ────────────────────────────────────
  const allCommonAnswered = commonQs.length === 0 || commonQs.every(q => {
    const a = answers[`common_${q.question_id}`]
    const cType = q.question_type ?? 'yes_no'
    if (!a) return false
    if (cType === 'yes_no')     return a.choice !== null
    if (cType === 'single_select' || cType === 'multi_select') return a.selected.length > 0
    if (cType === 'short_text') return a.text.trim() !== ''
    return false
  })
  const allAIAnswered = aiQs.length === 0 || aiQs.every(q => {
    const a = answers[`ai_${q.question_id}`]
    const qType = q.question_type ?? 'yes_no'
    if (!a) return false
    if (qType === 'yes_no')     return a.choice !== null
    if (qType === 'single_select' || qType === 'multi_select') return a.selected.length > 0
    if (qType === 'short_text') return a.text.trim() !== ''
    return false
  })
  const canComplete = allCommonAnswered && allAIAnswered && !aiPending

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
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>{localStorage.getItem('user_name') ?? ''}</span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginLeft: 6 }}>후속 설문</span>
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
            {/* 알림 메시지 */}
            {saveMsg === 'success' && (
              <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 14, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
                ✓ 답변이 저장되었습니다.
              </div>
            )}
            {saveMsg === 'error' && (
              <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 14, backgroundColor: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#dc2626' }}>
                ⚠ 저장에 실패했습니다. 다시 시도해 주세요.
              </div>
            )}
            {completeError && (
              <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 14, backgroundColor: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#dc2626' }}>
                ⚠ {completeError}
              </div>
            )}

            {/* 공통 질문 카드 */}
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
              {commonQs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>
                  등록된 공통 질문이 없습니다.
                </div>
              ) : (
                commonQs.map(q => (
                  <CommonQuestionItem
                    key={q.question_id}
                    question={q}
                    answer={answers[`common_${q.question_id}`] ?? emptyAnswer()}
                    onChange={handleChange}
                  />
                ))
              )}
            </div>

            {/* AI 추천 질문 카드 */}
            <div style={{
              backgroundColor: '#fff', borderRadius: 14,
              padding: '20px 18px', marginBottom: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #ddd6fe',
            }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 3, height: 14, backgroundColor: '#7c3aed', borderRadius: 2, display: 'inline-block' }} />
                  AI 추천 질문
                </p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>오늘 기록을 바탕으로 AI가 생성한 질문입니다.</p>
              </div>
              {aiPending ? (
                <AILoadingSkeleton />
              ) : aiQs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13 }}>
                  오늘 기록에 특이사항이 없어 AI 추천 질문이 없습니다.
                </div>
              ) : (
                aiQs.map(q => (
                  <AIQuestionItem
                    key={q.question_id}
                    question={q}
                    answer={answers[`ai_${q.question_id}`] ?? emptyAnswer()}
                    onChange={handleChange}
                  />
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* 하단 고정 버튼 */}
      {!loading && recordId && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff', borderTop: '1px solid #e5e7eb',
          padding: '12px 20px', boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
          zIndex: 100,
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              style={{
                width: '100%', height: 40,
                backgroundColor: saving ? '#9ca3af' : '#f3f4f6',
                color: '#6b7280', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSave}
              disabled={saving || completing}
            >
              {saving ? '저장 중...' : '임시 저장'}
            </button>

            <button
              style={{
                width: '100%', height: 52,
                backgroundColor: canComplete && !completing ? 'var(--capd-primary)' : '#9ca3af',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                cursor: canComplete && !completing ? 'pointer' : 'not-allowed',
                boxShadow: canComplete && !completing ? '0 4px 12px rgba(123,107,181,0.3)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              onClick={handleComplete}
              disabled={!canComplete || completing}
            >
              {completing
                ? '⏳ AI 요약 생성 중...'
                : canComplete
                  ? '✅ 설문 완료하기'
                  : aiPending
                    ? '🤖 AI 질문 생성 중...'
                    : '모든 질문에 답변해주세요'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
