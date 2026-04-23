/**
 * PatientRegisterPage — 환자 회원가입 (다단계)
 *
 * Step 1: 이름 + 생년월일 + 병원 + 담당 의사 선택 → 인증 요청 전송
 * Step 2: 대기 화면 (폴링 or 수동 새로고침) — 취소 가능
 * Step 3: 승인 시 → 전화번호 + 비밀번호 설정
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getHospitals,
  getDoctors,
  patientRequest,
  patientCancelRequest,
  getRegistrationStatus,
  patientComplete,
} from '../../api/auth'
import type { Hospital, DoctorSummary } from '../../types'

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
  warning:      '#d97706',
  warningLight: '#fffbeb',
}

type Step = 'request' | 'waiting' | 'complete' | 'done' | 'rejected'

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

function btnStyle(bg: string, disabled?: boolean): React.CSSProperties {
  return {
    padding: '13px', background: bg, color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', letterSpacing: '-0.01em', width: '100%', opacity: disabled ? 0.6 : 1,
  }
}

export default function PatientRegisterPage() {
  const navigate = useNavigate()

  const [step,           setStep]          = useState<Step>('request')
  const [hospitals,      setHospitals]     = useState<Hospital[]>([])
  const [doctors,        setDoctors]       = useState<DoctorSummary[]>([])
  const [loading,        setLoading]       = useState(false)
  const [error,          setError]         = useState('')

  // Step 1
  const [name,           setName]          = useState('')
  const [birthDate,      setBirthDate]     = useState('')
  const [hospitalId,     setHospitalId]    = useState<number | ''>('')
  const [doctorId,       setDoctorId]      = useState<number | ''>('')
  const [registrationId, setRegistrationId] = useState<number | null>(null)
  const [rejectReason,   setRejectReason]  = useState('')

  // Step 3
  const [phone,           setPhone]           = useState('')
  const [password,        setPassword]        = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  useEffect(() => {
    getHospitals().then(setHospitals).catch(() => {})
  }, [])

  const handleHospitalChange = async (id: number | '') => {
    setHospitalId(id)
    setDoctorId('')
    if (!id) { setDoctors([]); return }
    try {
      const result = await getDoctors(Number(id))
      setDoctors(result)
    } catch { setDoctors([]) }
  }

  const pollStatus = useCallback(async () => {
    if (!registrationId) return
    try {
      const result = await getRegistrationStatus(registrationId)
      if (result.status === 'approved') setStep('complete')
      else if (result.status === 'rejected') {
        setRejectReason(result.reject_reason ?? '')
        setStep('rejected')
      }
    } catch { /* 무시 */ }
  }, [registrationId])

  useEffect(() => {
    if (step !== 'waiting') return
    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [step, pollStatus])

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hospitalId || !doctorId) { setError('병원과 담당 의사를 선택해주세요.'); return }
    setLoading(true); setError('')
    try {
      const result = await patientRequest({
        name, birth_date: birthDate,
        hospital_id: Number(hospitalId),
        doctor_id: Number(doctorId),
      })
      setRegistrationId(result.registration_id)
      setStep('waiting')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '인증 요청에 실패했습니다.')
    } finally { setLoading(false) }
  }

  const handleCancel = async () => {
    if (!registrationId) return
    setLoading(true)
    try {
      await patientCancelRequest(registrationId)
      setRegistrationId(null)
      setStep('request')
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? '취소에 실패했습니다.')
    } finally { setLoading(false) }
  }

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registrationId) return
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    setLoading(true); setError('')
    try {
      await patientComplete({ registration_id: registrationId, phone_number: phone, password })
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
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>환자 회원가입</span>
        </div>

        <div style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Step 1: 인증 요청 ── */}
          {step === 'request' && (
            <>
              <p style={{
                margin: 0, fontSize: 13, color: C.textMuted,
                background: C.primaryLight, padding: '10px 14px', borderRadius: 10,
              }}>
                담당 의사 승인 후 서비스를 이용할 수 있습니다.
              </p>

              {/* 단계 표시 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[1, 2, 3].map((n, i) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: n === 1 ? C.primary : '#e5e7eb',
                      color: n === 1 ? '#fff' : C.textMuted,
                    }}>{n}</div>
                    {i < 2 && <div style={{ width: 20, height: 2, background: '#e5e7eb' }} />}
                  </div>
                ))}
                <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 4 }}>1단계: 인증 요청</span>
              </div>

              <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="이름" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} />
                <Field label="생년월일" type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                <Field label="통원 병원">
                  <select style={selectStyle} value={hospitalId}
                    onChange={e => handleHospitalChange(Number(e.target.value) || '')} required>
                    <option value="">병원을 선택하세요</option>
                    {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </Field>
                <Field label="담당 의사 선택">
                  <select style={{ ...selectStyle, opacity: !hospitalId ? 0.6 : 1 }}
                    value={doctorId} onChange={e => setDoctorId(Number(e.target.value) || '')}
                    required disabled={!hospitalId}>
                    <option value="">{hospitalId ? '담당 의사를 선택하세요' : '먼저 병원을 선택하세요'}</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                {error && <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{error}</p>}

                <div style={{
                  background: C.warningLight, border: `1px solid #fcd34d`,
                  borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.warning, lineHeight: 1.6,
                }}>
                  ⏳ 가입 신청 후 담당 의사의 승인이 필요합니다.<br />
                  승인 완료 시 다음 단계로 넘어갑니다.
                </div>

                <button type="submit" disabled={loading} style={btnStyle(C.primary, loading)}>
                  {loading ? '요청 중...' : '가입 신청하기'}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: 대기 ── */}
          {step === 'waiting' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.text }}>
                담당 의사의 승인을 기다리는 중입니다.
              </p>
              <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 8 }}>
                요청 번호: <strong>#{registrationId}</strong>
              </p>
              <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 24 }}>
                승인되면 자동으로 다음 단계로 넘어갑니다.<br />
                (10초마다 자동 상태 확인)
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button style={btnStyle(C.primary)} onClick={pollStatus}>
                  지금 상태 확인하기
                </button>
                <button style={btnStyle(C.danger, loading)} onClick={handleCancel} disabled={loading}>
                  {loading ? '취소 중...' : '인증 요청 취소'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: 계정 설정 ── */}
          {step === 'complete' && (
            <form onSubmit={handleComplete} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: C.successLight, border: '1px solid #bbf7d0',
                borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.success,
              }}>
                ✅ 가입이 승인되었습니다! 전화번호와 비밀번호를 설정해주세요.
              </div>
              <Field label="전화번호 (로그인 ID)" type="tel" placeholder="010-0000-0000"
                value={phone} onChange={e => setPhone(e.target.value)} />
              <Field label="비밀번호" type="password" placeholder="6자 이상"
                value={password} onChange={e => setPassword(e.target.value)} />
              <Field label="비밀번호 확인" type="password" placeholder="비밀번호를 다시 입력하세요"
                value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
              {error && <p style={{ margin: 0, fontSize: 13, color: C.danger }}>{error}</p>}
              <button type="submit" disabled={loading} style={btnStyle(C.success, loading)}>
                {loading ? '계정 생성 중...' : '가입 완료'}
              </button>
            </form>
          )}

          {/* ── 완료 ── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.text }}>
                환자 계정이 생성되었습니다!
              </p>
              <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 24 }}>
                전화번호와 비밀번호로 로그인하세요.
              </p>
              <button style={btnStyle(C.success)} onClick={() => navigate('/login')}>
                로그인 하러 가기
              </button>
            </div>
          )}

          {/* ── 거절 ── */}
          {step === 'rejected' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: C.danger }}>
                가입 요청이 거절되었습니다.
              </p>
              {rejectReason && (
                <p style={{ color: C.textMuted, fontSize: 14, marginBottom: 16 }}>사유: {rejectReason}</p>
              )}
              <button style={btnStyle(C.textMuted)}
                onClick={() => { setStep('request'); setRegistrationId(null) }}>
                다시 요청하기
              </button>
            </div>
          )}

          {/* 로그인으로 이동 */}
          {step === 'request' && (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: C.textMuted }}>이미 계정이 있으신가요? </span>
              <span onClick={() => navigate('/login')}
                style={{ fontSize: 13, color: C.primary, fontWeight: 700, cursor: 'pointer' }}>
                로그인 →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
