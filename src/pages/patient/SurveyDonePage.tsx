import { useNavigate } from 'react-router-dom'

const C = {
  primary:      'var(--capd-primary)',
  bg:           'var(--bg-page)',
  bgCard:       'var(--bg-card)',
  border:       'var(--border)',
  text:         'var(--text-main)',
  textSub:      'var(--text-sub)',
  textMuted:    'var(--text-muted)',
  success:      'var(--success)',
  successLight: 'var(--success-light)',
  successBorder:'var(--success-border)',
  gray:         'var(--text-dark)',
}

export default function SurveyDonePage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{
        backgroundColor: C.bgCard,
        borderRadius: 20,
        padding: '52px 48px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        border: `1px solid ${C.border}`,
        maxWidth: 400, width: '100%',
      }}>
        {/* 성공 아이콘 */}
        <div style={{
          width: 72, height: 72,
          backgroundColor: C.successLight,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: 36,
          border: `2px solid ${C.successBorder}`,
        }}>
          ✅
        </div>

        <p style={{ fontSize: 13, color: C.textSub, marginBottom: 4 }}>
          {localStorage.getItem('user_name') ?? ''}님
        </p>
        <p style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8, letterSpacing: '-0.3px' }}>
          제출 완료!
        </p>
        <p style={{ fontSize: 15, fontWeight: 600, color: C.gray, marginBottom: 6 }}>
          오늘의 기록과 설문이 완료되었습니다
        </p>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 36, lineHeight: 1.6 }}>
          담당 의사 선생님이 검토 후 확인할 예정입니다.
        </p>

        {/* 구분선 */}
        <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 28 }} />

        <button
          style={{
            backgroundColor: C.primary, color: '#fff',
            border: 'none', borderRadius: 12,
            height: 48, width: '100%',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.15s, transform 0.1s',
            fontFamily: 'inherit',
          }}
          className="capd-btn-lift"
          onClick={() => navigate('/patient')}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  )
}
