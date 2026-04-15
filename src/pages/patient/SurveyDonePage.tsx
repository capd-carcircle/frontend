import { useNavigate } from 'react-router-dom'

export default function SurveyDonePage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#eff1f5', fontFamily: "'Noto Sans KR', 'Inter', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '48px 64px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#1f1f1f', marginBottom: 8 }}>
          오늘의 기록과 설문이 완료되었습니다
        </p>
        <p style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 32 }}>
          의사 선생님이 검토 후 승인할 예정입니다.
        </p>
        <button
          style={{ backgroundColor: '#1b508a', color: '#fff', border: 'none', borderRadius: 6, height: 40, padding: '0 32px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => navigate('/patient/record')}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  )
}
