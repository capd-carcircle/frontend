/**
 * DoctorRegisterPage — 의사 회원가입 (2단계)
 *
 * Step 1: 이름 + 생년월일 + 자격번호 + 소속병원 입력 → 검증
 * Step 2: 전화번호 + 비밀번호 설정 → 가입 완료
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHospitals, doctorVerify, doctorComplete } from '../../api/auth'
import type { Hospital } from '../../types'

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  success:      '#16a34a',
  successLight: '#f0fdf4',
  danger:       '#dc2626',
}

type Step = 'verify' | 'complete' | 'done'

/* ── 공통 인풋 ── */
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

export default function DoctorRegisterPage() {
  const navigate = useNavigate()

  const [step,       setStep]       = useState<Step>('verify')
  const [hospitals,  setHospitals]  = useState<Hospital[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  // Step 1
  const [name,          setName]          = useState('')
  const [birthDate,     setBirthDate]     = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [hospitalId,    setHospitalId]    = useState<number | ''>('')
  const [verifyToken,   setVerifyToken]   = useState('')
  const [verifiedName,  setVerifiedName]  = useState('')

  // Step 2
  const [phone,           setPhone]           = useState('')
  const [password,        setPassword]        = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  useEffect(() => {
    getHospitals().then(setHospitals).catch(() => {})
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospitalId) { setError('소속 병원을 선택해주세요.'); return }
    setLoading(true); setError('')
    try {
      const result = await doctorVerify({
        name, birth_date: birthDate,
        license_number: licenseNumber,
        hospital_id: Number(hospitalId),
      })
      setVerifyToken(result.verify_token)
      setVerifiedName(result.name)
      setStep('complete')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '자격 검증에 실패했습니다.')
    } finally { setLoading(false) }
  }

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    setLoading(true); setError('')
    try {
      await doctorComplete({ phone_number: phone, password, verify_token: verifyToken })
      setStep('done')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '계정 생성에 실패했습니다.')
    } finally { setLoading(false) }
  }

  const selectStyle: React.CSSProperties = {
    padding: '11px 14px', borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: 14,
    fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none',
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
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>의사 회원가입</span>
        </div>

        <div style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 안내 메시지 */}
          {step === 'verify' && (
            <p style={{
              margin: 0, fontSize: 13, color: C.textMuted,
              background: C.primaryLight, padding: '10px 14px', borderRadius: 10,
            }}>
              신장분과전문의 자격 확인 후 자동 승인됩니다.
            </p>
          )}

          {/* 단계 표시 */}
          {step !== 'done' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {(['verify', 'complete'] as const).map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    background: step === s ? C.primary
                      : (s === 'verify' && step === 'complete') ? C.primaryLight : '#e5e7eb',
                    color: step === s ? '#fff' : C.textMuted,
                  }}>{i + 1}</div>
                  {i < 1 && <div style={{ width: 20, height: 2, background: step === 'complete' ? C.primaryLight : '#e5e7eb' }} />}
                </div>
              ))}
              <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 4 }}>
                {step === 'verify' ? '1단계: 자격 검증' : '2단계: 계정 설정'}
              </span>
            </div>
          )}

          {/* ── Step 1: 자격 검증 ── */}
          {step === 'verify' && (
            <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="이름" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} />
              <Field label="생년월일" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
              <Field label="소속 병원">
                <select style={selectStyle} value={hospitalId} onChange={e => setHospitalId(Number(e.target.value))} required>
                  <option value="">병원을 선택하세요</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </Field>
              <Field label="신장분과전문의 자격번호" placeholder="자격번호를 입력하세요"
                value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
              {error && <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle(C.primary)}>
                {loading ? '검증 중...' : '자격 검증'}
              </button>
            </form>
          )}

          {/* ── Step 2: 계정 설정 ── */}
          {step === 'complete' && (
            <form onSubmit={handleComplete} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.primaryDark,
              }}>
                <strong>{verifiedName}</strong> 님의 자격이 확인되었습니다.
              </div>
              <Field label="전화번호 (로그인 ID)" type="tel" placeholder="010-0000-0000"
                value={phone} onChange={e => setPhone(e.target.value)} />
              <Field label="비밀번호" type="password" placeholder="비밀번호를 입력하세요"
                value={password} onChange={e => setPassword(e.target.value)} />
              <Field label="비밀번호 확인" type="password" placeholder="비밀번호를 다시 입력하세요"
                value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
              {error && <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle(C.primary)}>
                {loading ? '계정 생성 중...' : '가입 완료'}
              </button>
            </form>
          )}

          {/* ── 완료 ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.text }}>
                의사 계정이 생성되었습니다!
              </p>
              <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24 }}>
                전화번호와 비밀번호로 로그인하세요.
              </p>
              <button style={btnStyle(C.primary)} onClick={() => navigate('/login')}>
                로그인 하러 가기
              </button>
            </div>
          )}

          {step !== 'done' && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>이미 계정이 있으신가요? </span>
              <span
                onClick={() => navigate('/login')}
                style={{ fontSize: 13, color: C.primary, fontWeight: 700, cursor: 'pointer' }}
              >
                로그인 →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '13px', background: bg, color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
    width: '100%',
  }
}
