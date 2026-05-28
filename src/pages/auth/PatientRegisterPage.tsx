/**
 * PatientRegisterPage — 환자 회원가입
 * 이름 + 생년월일 + 병원 + 전화번호 + 비밀번호 → 즉시 가입 완료
 * 담당 의사 연결은 로그인 후 마이페이지에서 별도 신청
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientRequest } from '../../api/auth'

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  success:      '#16a34a',
  successLight: '#f0fdf4',
  danger:       '#dc2626',
}

function Field({
  label, type = 'text', placeholder, value, onChange, children,
}: {
  label: string
  type?: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  children?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</label>
      {children ?? (
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange as any}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            padding: '11px 14px', borderRadius: 10,
            border: `1.5px solid ${focused ? C.primary : C.border}`,
            fontSize: 14, fontFamily: 'inherit', color: C.text,
            background: '#fff', outline: 'none', transition: 'border-color 0.15s',
          }}
        />
      )}
    </div>
  )
}

function btnStyle(bg: string, disabled?: boolean): React.CSSProperties {
  return {
    padding: '13px', background: bg, color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', letterSpacing: '-0.01em', width: '100%', opacity: disabled ? 0.6 : 1,
  }
}

export default function PatientRegisterPage() {
  const navigate = useNavigate()

  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  const [name,            setName]            = useState('')
  const [birthDate,       setBirthDate]       = useState('')
  const [phone,           setPhone]           = useState('')
  const [password,        setPassword]        = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [gender,          setGender]          = useState<'m' | 'f' | ''>('')

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim())  { setError('이름을 입력해주세요.'); return }
    if (!birthDate)    { setError('생년월일을 입력해주세요.'); return }
    if (!gender)       { setError('성별을 선택해주세요.'); return }
    if (!phone.trim()) { setError('전화번호를 입력해주세요.'); return }
    if (!/^[0-9]{10,11}$/.test(phone)) { setError('전화번호는 숫자만 입력해주세요. (예: 01012345678)'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }

    setLoading(true); setError('')
    try {
      await patientRequest({
        name,
        birth_date: birthDate,
        phone_number: phone,
        password,
        gender,
      })
      setDone(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '가입에 실패했습니다.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: C.bg, padding: 24,
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#fff',
        borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '16px 24px', display: 'flex', alignItems: 'center',
          gap: 12, borderBottom: `1px solid ${C.border}`,
        }}>
          <span onClick={() => navigate('/login')}
            style={{ fontSize: 22, cursor: 'pointer', color: C.textMuted }}>←</span>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>환자 회원가입</span>
        </div>

        <div style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {!done ? (
            <>
              <p style={{
                margin: 0, fontSize: 13, color: C.textMuted,
                background: C.primaryLight, padding: '10px 14px', borderRadius: 10, lineHeight: 1.6,
              }}>
                가입 후 마이페이지에서 담당 의사를 연결할 수 있습니다.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="이름 *" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} />
                <Field label="생년월일 *" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                {/* 성별 (필수) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>성별 *</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {([['m', '남성'], ['f', '여성']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setGender(val)}
                        style={{
                          flex: 1, padding: '11px 0', borderRadius: 10,
                          border: `1.5px solid ${gender === val ? C.primary : C.border}`,
                          background: gender === val ? C.primaryLight : '#fff',
                          color: gender === val ? C.primary : C.textMuted,
                          fontSize: 14, fontWeight: 700, cursor: 'pointer',
                          fontFamily: 'inherit', transition: 'all 0.15s',
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <Field label="전화번호 (로그인 ID) *" type="tel" placeholder="01012345678 (숫자만)"
                  value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} />
                <Field label="비밀번호 *" type="password" placeholder="6자 이상"
                  value={password} onChange={e => setPassword(e.target.value)} />
                <Field label="비밀번호 확인 *" type="password" placeholder="비밀번호를 다시 입력하세요"
                  value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />

                {error && <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{error}</p>}

                <button type="submit" disabled={loading} style={btnStyle(C.primary, loading)}>
                  {loading ? '가입 중...' : '가입하기'}
                </button>
              </form>

              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: C.textMuted }}>이미 계정이 있으신가요? </span>
                <span onClick={() => navigate('/login')}
                  style={{ fontSize: 13, color: C.primary, fontWeight: 700, cursor: 'pointer' }}>
                  로그인 →
                </span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.text }}>
                가입이 완료되었습니다!
              </p>
              <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                로그인 후 마이페이지에서<br />담당 의사를 연결하세요.
              </p>
              <button style={btnStyle(C.success)} onClick={() => navigate('/login')}>
                로그인 하러 가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
