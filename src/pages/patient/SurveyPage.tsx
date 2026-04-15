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

// ── 스타일 ────────────────────────────────────────────────
const s = {
  page: { minHeight: '100vh', backgroundColor: '#eff1f5', fontFamily: "'Noto Sans KR', 'Inter', sans-serif" } as React.CSSProperties,
  header: { position: 'fixed' as const, top: 0, left: 0, right: 0, height: 52, backgroundColor: '#1b508a', display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 100 },
  headerLogo: { color: '#fff', fontWeight: 700, fontSize: 16, flex: 1 },
  headerTitle: { color: '#fff', fontSize: 13, position: 'absolute' as const, left: '50%', transform: 'translateX(-50%)' },
  body: { maxWidth: 1280, margin: '0 auto', padding: '72px 20px 60px' } as React.CSSProperties,
  banner: { backgroundColor: '#edfff2', borderRadius: 4, padding: '9px 16px', marginBottom: 12, color: '#2b8c47', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: '18px 20px 24px', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#1f1f1f', marginBottom: 4 },
  sectionSub: { fontSize: 11, color: '#8c8c8c', marginBottom: 16 },
  qRow: { marginBottom: 20 },
  qText: { fontSize: 12, color: '#1f1f1f', marginBottom: 8 },
  answerRow: { display: 'flex', alignItems: 'center', gap: 8 },
  textInput: { height: 24, width: 320, borderRadius: 3, border: '1px solid transparent', backgroundColor: '#f7f7f7', padding: '0 8px', fontSize: 10, color: '#1f1f1f', outline: 'none' } as React.CSSProperties,
  aiBox: { backgroundColor: '#edf5ff', borderRadius: 6, padding: '12px 16px 14px', marginBottom: 10 },
  aiText: { fontSize: 12, color: '#1f1f1f', marginBottom: 6 },
  aiReason: { fontSize: 10, color: '#2e75b5', marginBottom: 10 },
  loadingBox: { textAlign: 'center' as const, padding: '32px 0', color: '#8c8c8c', fontSize: 13 },
  submitArea: { display: 'flex', justifyContent: 'center', marginTop: 24 },
  submitBtn: { backgroundColor: '#2b8c47', color: '#fff', border: 'none', borderRadius: 6, height: 44, width: 180, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 } as React.CSSProperties,
  error: { textAlign: 'center' as const, color: '#c0392b', fontSize: 12, marginTop: 8 },
}

function yesBtn(selected: string | null): React.CSSProperties {
  return { height: 24, minWidth: 48, padding: '0 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: selected === 'yes' ? '#1b508a' : '#dbdbdb', color: selected === 'yes' ? '#fff' : '#1f1f1f' }
}
function noBtn(selected: string | null): React.CSSProperties {
  return { height: 24, minWidth: 60, padding: '0 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, backgroundColor: selected === 'no' ? '#1b508a' : '#dbdbdb', color: selected === 'no' ? '#fff' : '#1f1f1f' }
}

// ── 단일 질문 컴포넌트 ────────────────────────────────────
function QuestionItem({ idx, question, answer, onChange }: {
  idx?: number
  question: Question
  answer?: Answer
  onChange: (id: number, choice: 'yes' | 'no' | null, text: string) => void
}) {
  const isAI = question.type === 'ai'

  return (
    <div style={isAI ? s.aiBox : s.qRow}>
      <p style={isAI ? s.aiText : s.qText}>
        {isAI ? 'Q.' : `Q${idx}.`} {question.question_text}
      </p>
      {isAI && question.reason && (
        <p style={s.aiReason}>💡 생성 이유: {question.reason}</p>
      )}
      <div style={s.answerRow}>
        <button style={yesBtn(answer?.choice ?? null)} onClick={() => onChange(question.id, 'yes', answer?.text ?? '')}>예</button>
        <button style={noBtn(answer?.choice ?? null)} onClick={() => onChange(question.id, 'no', answer?.text ?? '')}>아니오</button>
        <input
          type="text"
          placeholder="직접 입력..."
          style={s.textInput}
          value={answer?.text ?? ''}
          onChange={e => onChange(question.id, answer?.choice ?? null, e.target.value)}
          onFocus={e => (e.target.style.borderColor = '#1b508a')}
          onBlur={e => (e.target.style.borderColor = 'transparent')}
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
  const [aiQs, setAiQs] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
      question_id: q.id,
      question_type: q.type,
      choice: answers[q.id]?.choice ?? null,
      text_answer: answers[q.id]?.text ?? '',
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
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.headerLogo}>CAPD</span>
        <span style={s.headerTitle}>후속 설문</span>
      </header>

      <main style={s.body}>
        <div style={s.banner}>✅ 기록이 제출되었습니다. 아래 설문에 답해 주세요.</div>

        {/* 공통 질문 */}
        <div style={s.card}>
          <p style={s.sectionTitle}>공통 질문 (의사 설정)</p>
          {loading
            ? <div style={s.loadingBox}>질문을 불러오는 중...</div>
            : commonQs.length === 0
              ? <div style={{ ...s.loadingBox, fontSize: 12 }}>등록된 공통 질문이 없습니다.</div>
              : commonQs.map((q, i) => (
                  <QuestionItem key={q.id} idx={i + 1} question={q} answer={answers[q.id]} onChange={handleChange} />
                ))
          }
        </div>

        {/* AI 맞춤 질문 */}
        <div style={s.card}>
          <p style={s.sectionTitle}>AI 맞춤 질문</p>
          <p style={s.sectionSub}>AI가 오늘 기록을 분석하여 생성한 개인화 질문입니다.</p>
          {aiLoading
            ? <div style={s.loadingBox}>🤖 AI가 오늘 기록을 분석하고 있습니다...</div>
            : aiQs.length === 0
              ? <div style={{ ...s.loadingBox, fontSize: 12 }}>오늘은 AI 맞춤 질문이 생성되지 않았습니다.</div>
              : aiQs.map(q => (
                  <QuestionItem key={q.id} question={q} answer={answers[q.id]} onChange={handleChange} />
                ))
          }
        </div>

        {error && <p style={s.error}>⚠ {error}</p>}

        <div style={s.submitArea}>
          <button
            style={{ ...s.submitBtn, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '제출 중...' : '설문 완료  ✓'}
          </button>
        </div>
      </main>
    </div>
  )
}
