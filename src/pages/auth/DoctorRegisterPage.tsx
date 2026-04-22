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
import styles from './LoginPage.module.css'

type Step = 'verify' | 'complete' | 'done'

export default function DoctorRegisterPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('verify')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 폼
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [hospitalId, setHospitalId] = useState<number | ''>('')

  // Step 1 결과 → Step 2로 전달
  const [verifyToken, setVerifyToken] = useState('')
  const [verifiedName, setVerifiedName] = useState('')

  // Step 2 폼
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
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
        name,
        birth_date: birthDate,
        license_number: licenseNumber,
        hospital_id: Number(hospitalId),
      })
      setVerifyToken(result.verify_token)
      setVerifiedName(result.name)
      setStep('complete')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '자격 검증에 실패했습니다.')
    } finally {
      setLoading(false)
    }
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>의사 회원가입</h1>
          <p className={styles.subtitle}>
            {step === 'verify' && '1단계: 자격 검증'}
            {step === 'complete' && '2단계: 계정 설정'}
            {step === 'done' && '가입 완료'}
          </p>
        </div>

        {/* ── 단계 표시 ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
          {(['verify', 'complete'] as const).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                backgroundColor: step === s ? '#2563EB' : (step === 'done' || (s === 'verify' && step === 'complete')) ? '#BBD0FF' : '#E5E7EB',
                color: step === s ? '#fff' : '#374151',
              }}>
                {i + 1}
              </div>
              {i < 1 && <div style={{ width: 24, height: 2, backgroundColor: step === 'complete' || step === 'done' ? '#BBD0FF' : '#E5E7EB' }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: 자격 검증 ── */}
        {step === 'verify' && (
          <form onSubmit={handleVerify} className={styles.form}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>이름</label>
              <input className={styles.input} value={name} onChange={e => setName(e.target.value)} required placeholder="실명을 입력하세요" />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>생년월일</label>
              <input className={styles.input} type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>소속 병원</label>
              <select
                className={styles.input}
                value={hospitalId}
                onChange={e => setHospitalId(Number(e.target.value))}
                required
              >
                <option value="">병원을 선택하세요</option>
                {hospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>신장분과전문의 자격번호</label>
              <input className={styles.input} value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} required placeholder="예: NEPH-2024-001" />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? '검증 중...' : '자격 검증'}
            </button>
          </form>
        )}

        {/* ── Step 2: 계정 설정 ── */}
        {step === 'complete' && (
          <form onSubmit={handleComplete} className={styles.form}>
            <div style={{
              backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14,
            }}>
              <strong>{verifiedName}</strong> 님의 자격이 확인되었습니다.
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>전화번호 (로그인 ID)</label>
              <input className={styles.input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="예: 01012345678" />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>비밀번호</label>
              <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="6자 이상" />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>비밀번호 확인</label>
              <input className={styles.input} type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required placeholder="비밀번호를 다시 입력하세요" />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={loading} style={{ backgroundColor: '#2563EB' }}>
              {loading ? '계정 생성 중...' : '가입 완료'}
            </button>
          </form>
        )}

        {/* ── 완료 ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>의사 계정이 생성되었습니다!</p>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>전화번호와 비밀번호로 로그인하세요.</p>
            <button className={styles.button} onClick={() => navigate('/login')} style={{ backgroundColor: '#2563EB' }}>
              로그인 하러 가기
            </button>
          </div>
        )}

        {step !== 'done' && (
          <button
            style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 14 }}
            onClick={() => navigate('/login')}
          >
            로그인으로 돌아가기
          </button>
        )}
      </div>
    </div>
  )
}
