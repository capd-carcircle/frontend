import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

const C = {
  primary:     'var(--capd-primary)',
  primaryLight:'var(--capd-primary-light)',
  primaryDark: 'var(--capd-primary-dark)',
  bg:          'var(--capd-bg)',
  border:      'var(--capd-border)',
  text:        '#1a1a2e',
  textMuted:   '#6b7280',
  textLight:   '#9ca3af',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error } = useAuthStore()

  const [role, setRole]       = useState<'patient' | 'doctor' | null>(null)
  const [phone, setPhone]     = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const loggedRole = await login(phone, password)
      if (loggedRole === 'doctor') navigate('/doctor')
      else navigate('/patient')
    } catch { /* 에러는 store에서 처리 */ }
  }

  const goSignup = () => {
    if (role === 'doctor') navigate('/register/doctor')
    else navigate('/register/patient')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: C.bg,
      padding: 24,
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        padding: '40px 32px 32px',
      }}>
        {/* 로고 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: C.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 22, fontWeight: 900 }}>C</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>CAPD</span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
            복막투석 환자 &amp; 의사용 플랫폼
          </p>
        </div>

        {/* 역할 선택 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 10 }}>
            로그인 유형
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              ['patient', '환자', '일일 기록 제출'],
              ['doctor',  '의사', '환자 현황 모니터링'],
            ] as const).map(([r, label, sub]) => (
              <div
                key={r}
                onClick={() => setRole(r)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `2px solid ${role === r ? C.primary : C.border}`,
                  background: role === r ? C.primaryLight : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: role === r ? C.primaryDark : C.text, marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
          <Field label="전화번호" type="tel" placeholder="010-0000-0000"
            value={phone} onChange={e => setPhone(e.target.value)} />
          <Field label="비밀번호" type="password" placeholder="비밀번호를 입력하세요"
            value={password} onChange={e => setPassword(e.target.value)} />

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 4,
              padding: '13px',
              background: C.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 13, color: C.textMuted }}>계정이 없으신가요? </span>
          <span
            onClick={goSignup}
            style={{ fontSize: 13, color: C.primary, fontWeight: 700, cursor: 'pointer' }}
          >
            회원가입 →
          </span>
        </div>

        {/* 테스트 계정 */}
        <div style={{
          padding: '12px 14px',
          background: C.bg,
          borderRadius: 10,
          border: `1px dashed ${C.border}`,
          fontSize: 12,
          color: C.textLight,
          lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2, color: C.textMuted }}>테스트 계정</div>
          의사: 01011112222 / test1234<br />
          환자: 01033334444 / test1234
        </div>
      </div>
    </div>
  )
}

/* ── 공통 인풋 컴포넌트 ── */
function Field({
  label, type, placeholder, value, onChange,
}: {
  label: string
  type?: string
  placeholder?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{label}</label>
      <input
        type={type ?? 'text'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          padding: '11px 14px',
          borderRadius: 10,
          border: `1.5px solid ${focused ? 'var(--capd-primary)' : 'var(--capd-border)'}`,
          fontSize: 14,
          fontFamily: 'inherit',
          color: '#1a1a2e',
          background: '#fff',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
      />
    </div>
  )
}
