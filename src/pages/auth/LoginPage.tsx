import { useState } from 'react'
import logoFull from '../../assets/logo_full.png'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  textLight:    '#9ca3af',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error } = useAuthStore()
  const [phone,     setPhone]     = useState('')
  const [password,  setPassword]  = useState('')
  const [autoLogin, setAutoLogin] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const role = await login(phone, password, autoLogin)
      if (role === 'doctor') navigate('/doctor')
      else navigate('/patient')
    } catch { /* 에러는 store에서 처리 */ }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: C.bg, padding: 24,
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: '#fff',
        borderRadius: 20, boxShadow: '0 8px 40px rgba(124,58,237,0.10)',
        padding: '40px 32px 32px',
      }}>
        {/* 로고 */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ marginBottom: 8 }}>
            <img src={logoFull} alt="CAPD" style={{ height: 44, objectFit: 'contain' }} />
          </div>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
            복막투석 환자 &amp; 의사용 플랫폼
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          <Field label="전화번호" type="tel" placeholder="010-0000-0000"
            value={phone} onChange={e => setPhone(e.target.value)} />
          <Field label="비밀번호" type="password" placeholder="비밀번호를 입력하세요"
            value={password} onChange={e => setPassword(e.target.value)} />

          {/* 자동로그인 체크박스 */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', userSelect: 'none',
            fontSize: 13, color: C.textMuted,
          }}>
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={e => setAutoLogin(e.target.checked)}
              style={{
                width: 16, height: 16,
                accentColor: C.primary,
                cursor: 'pointer',
              }}
            />
            자동 로그인
          </label>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 4, padding: '13px',
              background: C.primary, color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              fontFamily: 'inherit', letterSpacing: '-0.01em',
            }}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
          <span
            onClick={() => navigate('/register/patient')}
            style={{ fontSize: 13, color: C.primary, fontWeight: 700, cursor: 'pointer' }}
          >
            환자 회원가입 →
          </span>
          <span style={{ fontSize: 13, color: C.border }}>|</span>
          <span
            onClick={() => navigate('/register/doctor')}
            style={{ fontSize: 13, color: C.primary, fontWeight: 700, cursor: 'pointer' }}
          >
            의사 회원가입 →
          </span>
        </div>

        {/* 테스트 계정 */}
        <div style={{
          padding: '12px 14px', background: C.bg, borderRadius: 10,
          border: `1px dashed ${C.border}`, fontSize: 12, color: C.textLight, lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2, color: C.textMuted }}>테스트 계정</div>
          의사: 01011112222 / test1234<br />
          환자: 01033334444 / test1234
        </div>
      </div>
    </div>
  )
}

function Field({ label, type, placeholder, value, onChange }: {
  label: string; type?: string; placeholder?: string
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{label}</label>
      <input
        type={type ?? 'text'} placeholder={placeholder} value={value} onChange={onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          padding: '11px 14px', borderRadius: 10,
          border: `1.5px solid ${focused ? 'var(--capd-primary)' : 'var(--capd-border)'}`,
          fontSize: 14, fontFamily: 'inherit', color: '#1a1a2e',
          background: '#fff', outline: 'none', transition: 'border-color 0.15s',
        }}
      />
    </div>
  )
}
