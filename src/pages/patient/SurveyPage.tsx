import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import client from '../../api/client'

// ── 타입 ──────────────────────────────────────────────────
interface Question {
  id: number
  question_text: string
  type: 'common' | 'ai'
  reason?: string
}

interface Answer {
  choice: 'yes' | 'no' | null
  text: string
}

// ── 단일 질문 컴포넌트 ────────────────────────────────────
function QuestionItem({ idx, question, answer, onChange }: {
  idx?: number
  question: Question
  answer?: Answer
  onChange: (id: number, choice: 'yes' | 'no' | null, text: string) => void
}) {
  const isAI = question.type === 'ai'
  const choice = answer?.choice ?? null

  return (
    <div style={{
      padding: '16px',
      borderRadius: 10,
      backgroundColor: isAI ? '#edf5ff' : '#f9fafb',
      border: isAI ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
      marginBottom: 10,
    }}>
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
      }}>
        {!isAI && idx != null && (
          <span style={{ color: '#1b508a', fontWeight: 700, marginRight: 4 }}>Q{idx}.</span>
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
        <button
          style={{
            height: 34, minWidth: 64, padding: '0 14px',
            borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
            backgroundColor: choice === 'yes' ? '#1b508a' : '#e5e7eb',
            color: choice === 'yes' ? '#fff' : '#374151',
            boxShadow: choice === 'yes' ? '0 2px 6px rgba(27,80,138,0.3)' : 'none',
          }}
          onClick={() => onChange(question.id, 'yes', answer?.text ?? '')}
        >
          예
        </button>
        <button
          style={{
            height: 34, minWidth: 80, padding: '0 14px',
            borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
            backgroundColor: choice === 'no' ? '#1b508a' : '#e5e7eb',
            color: choice === 'no' ? '#fff' : '#374151',
            boxShadow: choice === 'no' ? '0 2px 6px rgba(27,80,138,0.3)' : 'none',
          }}
          onClick={() => onChange(question.id, 'no', answer?.text ?? '')}
        >
          아니오
        </button>
        <input
          type="text"
          placeholder="직접 입력 (선택)"
          style={{
            flex: 1, minWidth: 120, height: 34,
            borderRadius: 8, border: '1px solid #e5e7eb',
            backgroundColor: '#fff', padding: '0 12px',
            fontSize: 13, color: '#1a1a2e', outline: 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          value={answer?.text ?? ''}
          onChange={e => onChange(question.id, answer?.choice ?? null, e.target.value)}
          onFocus={e => {
            e.target.style.borderColor = '#1b508a'
            e.target.style.boxShadow = '0 0 0 3px rgba(27,80,138,0.10)'
          }}
          onBlur={e => {
            e.target.style.borderColor = '#e5e7eb'
            e.target.style.boxShadow = 'none'
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

  const [commonQs, setCommonQs] = useState<Question[]>([])
  const [aiQs, setAiQs]         = useState<Question[]>([])
  const [answers, setAnswers]   = useState<Record<number, Answer>>({})
  const [loading, setLoading]   = useState(true)
  const [aiLoading, setAiLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    client.get('/api/v1/questions/common?active=true')
      .then(res => setCommonQs(res.data.map((q: Question) => ({ ...q, type: 'common' as const }))))
      .catch(e => console.error('공통 질문 로드 실패:', e))
      .finally(() => setLoading(false))

    if (recordId) {
      client.get(`/api/v1/surveys/ai-questions/${recordId}`)
        .then(res => setAiQs(res.data.map((q: Question) => ({ ...q, type: 'ai' as const }))))
        .catch(e => console.error('AI 질문 로드 실패:', e))
        .finally(() => setAiLoading(false))
    } else {
      setAiLoading(false)
    }
  }, [recordId])

  function handleChange(id: number, choice: 'yes' | 'no' | null, text: string) {
    setAnswers(prev => ({ ...prev, [id]: { choice, text } }))
  }

  async function handleSubmit() {
    if (!recordId) { setError('기록 ID가 없습니다.'); return }
    setSubmitting(true)
    setError('')

    const responses = [...commonQs, ...aiQs].map(q => ({
      question_id:   q.id,
      question_type: q.type,
      choice:        answers[q.id]?.choice ?? null,
      text_answer:   answers[q.id]?.text ?? '',
    }))

    try {
      await client.post('/api/v1/surveys/responses', { record_id: recordId, responses })
      navigate('/patient/survey/done')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '제출에 실패했습니다.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa' }}>
      {/* 헤더 */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        backgroundColor: '#1b508a',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(27,80,138,0.25)',
      }}>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px', flex: 1, textAlign: 'center' }}>
          후속 설문
        </span>
      </header>

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 60px' }}>

        {/* 안내 배너 */}
        <div style={{
          backgroundColor: '#f0fdf4', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20,
          border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: '#15803d', fontWeight: 500,
        }}>
          <span style={{ fontSize: 16 }}>✅</span>
          기록이 제출되었습니다. 아래 설문에 답해 주세요.
        </div>

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

          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
              질문을 불러오는 중...
            </div>
          ) : commonQs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
              등록된 공통 질문이 없습니다.
            </div>
          ) : (
            commonQs.map((q, i) => (
              <QuestionItem
                key={q.id}
                idx={i + 1}
                question={q}
                answer={answers[q.id]}
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
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 3, height: 14, backgroundColor: '#2563eb', borderRadius: 2, display: 'inline-block' }} />
              AI 맞춤 질문
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>오늘 기록을 AI가 분석하여 생성한 개인화 질문입니다.</p>
          </div>

          {aiLoading ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
              <p style={{ color: '#6b7280', fontSize: 13, fontWeight: 500 }}>AI가 오늘 기록을 분석하고 있습니다...</p>
              <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>잠시만 기다려 주세요</p>
            </div>
          ) : aiQs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
              오늘은 AI 맞춤 질문이 생성되지 않았습니다.
            </div>
          ) : (
            aiQs.map(q => (
              <QuestionItem key={q.id} question={q} answer={answers[q.id]} onChange={handleChange} />
            ))
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 16,
            backgroundColor: '#fef2f2', border: '1px solid #fecaca',
            fontSize: 13, color: '#dc2626', textAlign: 'center',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* 제출 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            style={{
              backgroundColor: submitting ? '#9ca3af' : '#16a34a',
              color: '#fff', border: 'none', borderRadius: 12,
              height: 50, width: '100%', maxWidth: 320,
              fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s, transform 0.1s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'inherit',
            }}
            onClick={handleSubmit}
            disabled={submitting}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {submitting ? '제출 중...' : '설문 완료 ✓'}
          </button>
        </div>
      </main>
    </div>
  )
}
