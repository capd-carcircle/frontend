import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { startConversation, sendMessage } from '../../api/conversations'
import type { ConversationMessageItem } from '../../api/conversations'

// ── 타입 ──────────────────────────────────────────────────
interface ChatMessage {
  role: 'ai' | 'user'
  content: string
  isUrgent?: boolean
}

// ── 채팅 메시지 버블 ───────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isAI = msg.role === 'ai'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isAI ? 'flex-start' : 'flex-end',
      marginBottom: 12,
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {isAI && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: '#1b508a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>
          🤖
        </div>
      )}

      <div style={{
        maxWidth: '72%',
        padding: '12px 16px',
        borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        backgroundColor: msg.isUrgent
          ? '#fef2f2'
          : isAI ? '#f0f4ff' : '#1b508a',
        border: msg.isUrgent ? '1.5px solid #fca5a5' : 'none',
        color: msg.isUrgent ? '#dc2626' : isAI ? '#1a1a2e' : '#fff',
        fontSize: 14,
        lineHeight: 1.6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        {msg.isUrgent && (
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>🚨 긴급 안내</div>
        )}
        {msg.content}
      </div>

      {!isAI && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          backgroundColor: '#e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>
          👤
        </div>
      )}
    </div>
  )
}

// ── 타이핑 인디케이터 ──────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        backgroundColor: '#1b508a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
      }}>
        🤖
      </div>
      <div style={{
        padding: '12px 16px', borderRadius: '4px 16px 16px 16px',
        backgroundColor: '#f0f4ff',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: '#1b508a', opacity: 0.4,
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function ConversationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const recordId: number | undefined = (location.state as { recordId?: number })?.recordId

  const [messages,       setMessages]       = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [inputText,      setInputText]      = useState('')
  const [isLoading,      setIsLoading]      = useState(false)
  const [isDone,         setIsDone]         = useState(false)
  const [isUrgent,       setIsUrgent]       = useState(false)
  const [turnCount,      setTurnCount]      = useState(0)
  const [initError,      setInitError]      = useState('')

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // 첫 질문 요청
  useEffect(() => {
    if (!recordId) { setInitError('기록 정보가 없습니다.'); return }

    setIsLoading(true)
    startConversation(recordId)
      .then(res => {
        setConversationId(res.conversation_id)
        setMessages([{
          role: 'ai',
          content: res.content,
          isUrgent: res.type === 'urgent',
        }])
        if (res.is_done) {
          setIsDone(true)
          setIsUrgent(res.type === 'urgent')
        }
      })
      .catch(() => setInitError('AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'))
      .finally(() => setIsLoading(false))
  }, [recordId])

  // 새 메시지마다 스크롤 하단
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 완료 후 입력창 포커스
  useEffect(() => {
    if (!isDone && !isLoading) inputRef.current?.focus()
  }, [isDone, isLoading])

  async function handleSend() {
    const text = inputText.trim()
    if (!text || isLoading || isDone || !conversationId) return

    setInputText('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setIsLoading(true)

    try {
      const res = await sendMessage(conversationId, text)
      setTurnCount(prev => prev + 1)
      setMessages(prev => [...prev, {
        role: 'ai',
        content: res.content,
        isUrgent: res.type === 'urgent',
      }])
      if (res.is_done) {
        setIsDone(true)
        setIsUrgent(res.type === 'urgent')
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: '잠시 오류가 발생했습니다. 다시 시도해 주세요.',
      }])
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa', display: 'flex', flexDirection: 'column' }}>
      {/* CSS 애니메이션 */}
      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.4; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

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
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onClick={() => navigate('/patient')}
        >
          ← <span style={{ fontSize: 12 }}>목록</span>
        </button>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, flex: 1, textAlign: 'center' }}>
          AI 문진
        </span>
        <div style={{ width: 56 }} />
      </header>

      {/* 안내 배너 */}
      {!isDone && !initError && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0,
          backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe',
          padding: '8px 20px', zIndex: 99,
          fontSize: 12, color: '#1d4ed8', textAlign: 'center',
        }}>
          🤖 AI가 오늘 기록을 바탕으로 추가 질문을 드립니다. 편하게 답변해 주세요.
        </div>
      )}

      {/* 채팅 영역 */}
      <main style={{
        flex: 1,
        maxWidth: 680, width: '100%', margin: '0 auto',
        padding: `${isDone ? 72 : 96}px 16px ${isDone ? 80 : 80}px`,
        display: 'flex', flexDirection: 'column',
      }}>
        {initError ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: '#dc2626', fontSize: 14 }}>{initError}</p>
            <button
              style={{
                marginTop: 16, padding: '10px 24px',
                backgroundColor: '#1b508a', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
              onClick={() => navigate('/patient')}
            >
              목록으로
            </button>
          </div>
        ) : (
          <>
            {/* 메시지 목록 */}
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} msg={msg} />
            ))}

            {/* 타이핑 인디케이터 */}
            {isLoading && messages.length > 0 && <TypingIndicator />}

            {/* 최초 로딩 */}
            {isLoading && messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <p style={{ color: '#6b7280', fontSize: 14 }}>🤖 AI가 질문을 준비하고 있습니다...</p>
              </div>
            )}

            {/* 종료 안내 */}
            {isDone && (
              <div style={{
                margin: '16px 0',
                padding: '16px',
                borderRadius: 12,
                backgroundColor: isUrgent ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${isUrgent ? '#fca5a5' : '#bbf7d0'}`,
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: isUrgent ? '#dc2626' : '#16a34a', marginBottom: 4 }}>
                  {isUrgent ? '🚨 긴급 상황입니다' : '✅ 문진 완료'}
                </p>
                <p style={{ fontSize: 12, color: '#6b7280' }}>
                  {isUrgent
                    ? '즉시 병원을 방문하시거나 119에 연락하세요.'
                    : '담당 의사 선생님이 기록을 검토할 예정입니다.'}
                </p>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </main>

      {/* 입력창 */}
      {!isDone && !initError && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e7eb',
          padding: '10px 16px',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
          zIndex: 100,
        }}>
          <div style={{
            maxWidth: 680, margin: '0 auto',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="답변을 입력하세요..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              style={{
                flex: 1, height: 44,
                borderRadius: 22,
                border: '1.5px solid #d1d5db',
                padding: '0 16px',
                fontSize: 14, outline: 'none',
                backgroundColor: isLoading ? '#f9fafb' : '#fff',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#1b508a' }}
              onBlur={e => { e.target.style.borderColor = '#d1d5db' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                backgroundColor: inputText.trim() && !isLoading ? '#1b508a' : '#e5e7eb',
                border: 'none', cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* 종료 후 하단 버튼 */}
      {isDone && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e7eb',
          padding: '12px 20px',
          zIndex: 100,
        }}>
          <button
            style={{
              width: '100%', maxWidth: 680, display: 'block', margin: '0 auto',
              height: 48, backgroundColor: '#1b508a', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
            onClick={() => navigate('/patient', { replace: true })}
          >
            홈으로 돌아가기
          </button>
        </div>
      )}
    </div>
  )
}
