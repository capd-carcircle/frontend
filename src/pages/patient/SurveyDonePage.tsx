import { useNavigate } from 'react-router-dom'

export default function SurveyDonePage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f4f6fa',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: '52px 48px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        border: '1px solid #e5e7eb',
        maxWidth: 400, width: '100%',
      }}>
        {/* 성공 아이콘 */}
        <div style={{
          width: 72, height: 72,
          backgroundColor: '#f0fdf4',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: 36,
          border: '2px solid #bbf7d0',
        }}>
          ✅
        </div>

        <p style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', marginBottom: 8, letterSpacing: '-0.3px' }}>
          제출 완료!
        </p>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          오늘의 기록과 설문이 완료되었습니다
        </p>
        <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 36, lineHeight: 1.6 }}>
          담당 의사 선생님이 검토 후 확인할 예정입니다.
        </p>

        {/* 구분선 */}
        <div style={{ borderTop: '1px solid #f0f0f0', marginBottom: 28 }} />

        <button
          style={{
            backgroundColor: '#1b508a', color: '#fff',
            border: 'none', borderRadius: 12,
            height: 48, width: '100%',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.15s, transform 0.1s',
            fontFamily: 'inherit',
          }}
          onClick={() => navigate('/patient')}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = '0.88'
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  )
}
