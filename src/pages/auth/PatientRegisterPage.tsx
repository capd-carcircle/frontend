/**
 * PatientRegisterPage — 환자 회원가입 (다단계)
 *
 * Step 1: 이름 + 생년월일 + 병원 + 담당 의사 선택 → 인증 요청 전송
 * Step 2: 대기 화면 (폴링 or 수동 새로고침) — 취소 가능
 * Step 3: 승인 시 → 전화번호 + 비밀번호 설정
 * Done: 완료
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
import styles from './LoginPage.module.css'

type Step = 'request' | 'waiting' | 'complete' | 'done' | 'rejected'

export default function PatientRegisterPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('request')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [doctors, setDoctors] = useState<DoctorSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [hospitalId, setHospitalId] = useState<number | ''>('')
  const [doctorId, setDoctorId] = useState<number | ''>('')
  const [registrationId, setRegistrationId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Step 3
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  useEffect(() => {
    getHospitals().then(setHospitals).catch(() => {})
  }, [])

  // 병원 선택 시 해당 병원 의사 목록 갱신
  const handleHospitalChange = async (id: number | '') => {
    setHospitalId(id)
    setDoctorId('')
    if (!id) { setDoctors([]); return }
    try {
      const result = await getDoctors(Number(id))
      setDoctors(result)
    } catch {
      setDoctors([])
    }
  }

  // 폴링: 대기 중 상태 체크 (10초 간격)
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
        name,
        birth_date: birthDate,
        hospital_id: Number(hospitalId),
        doctor_id: Number(doctorId),
      })
      setRegistrationId(result.registration_id)
      setStep('waiting')
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? '인증 요청에 실패했습니다.')
    } finally {
      setLoading(false)
    }
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
    } finally {
      setLoading(false)
    }
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
    } finally {
      setLoading(false)
    }
  }

  const stepLabels: Partial<Record<Step, string>> = {
    request: '1단계: 인증 요청',
    waiting: '2단계: 승인 대기',
    complete: '3단계: 계정 설정',
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>환자 회원가입</h1>
          <p className={styles.subtitle}>{stepLabels[step] ?? ''}</p>
        </div>

        {/* 단계 표시 */}
        {['request', 'waiting', 'complete'].includes(step) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
            {(['request', 'waiting', 'complete'] as const).map((s, i) => {
              const stepOrder = { request: 0, waiting: 1, complete: 2, done: 3, rejected: 1 }
              const current = stepOrder[step]
              const active = stepOrder[s] === current
              const done = stepOrder[s] < current
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                    backgroundColor: active ? '#059669' : done ? '#A7F3D0' : '#E5E7EB',
                    color: active ? '#fff' : '#374151',
                  }}>{i + 1}</div>
                  {i < 2 && <div style={{ width: 24, height: 2, backgroundColor: done ? '#A7F3D0' : '#E5E7EB' }} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Step 1: 인증 요청 ── */}
        {step === 'request' && (
          <form onSubmit={handleRequest} className={styles.form}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>이름</label>
              <input className={styles.input} value={name} onChange={e => setName(e.target.value)} required placeholder="실명을 입력하세요" />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>생년월일</label>
              <input className={styles.input} type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} required />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>통원 병원</label>
              <select
                className={styles.input}
                value={hospitalId}
                onChange={e => handleHospitalChange(Number(e.target.value) || '')}
                required
              >
                <option value="">병원을 선택하세요</option>
                {hospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>담당 의사</label>
              <select
                className={styles.input}
                value={doctorId}
                onChange={e => setDoctorId(Number(e.target.value) || '')}
                required
                disabled={!hospitalId}
              >
                <option value="">{hospitalId ? '담당 의사를 선택하세요' : '먼저 병원을 선택하세요'}</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={loading} style={{ backgroundColor: '#059669' }}>
              {loading ? '요청 중...' : '인증 요청 전송'}
            </button>
          </form>
        )}

        {/* ── Step 2: 대기 ── */}
        {step === 'waiting' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>담당 의사의 승인을 기다리는 중입니다.</p>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 8 }}>
              요청 번호: <strong>#{registrationId}</strong>
            </p>
            <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 24 }}>
              승인되면 이 페이지가 자동으로 다음 단계로 넘어갑니다.<br />
              (10초마다 자동으로 상태를 확인합니다)
            </p>
            <button
              className={styles.button}
              onClick={pollStatus}
              style={{ backgroundColor: '#059669', marginBottom: 12 }}
            >
              지금 상태 확인하기
            </button>
            <button
              className={styles.button}
              onClick={handleCancel}
              disabled={loading}
              style={{ backgroundColor: '#EF4444' }}
            >
              {loading ? '취소 중...' : '인증 요청 취소'}
            </button>
          </div>
        )}

        {/* ── Step 3: 계정 설정 ── */}
        {step === 'complete' && (
          <form onSubmit={handleComplete} className={styles.form}>
            <div style={{
              backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 14,
            }}>
              가입이 승인되었습니다! 전화번호와 비밀번호를 설정해주세요.
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
              <input className={styles.input} type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.button} disabled={loading} style={{ backgroundColor: '#059669' }}>
              {loading ? '계정 생성 중...' : '가입 완료'}
            </button>
          </form>
        )}

        {/* ── 완료 ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>환자 계정이 생성되었습니다!</p>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>전화번호와 비밀번호로 로그인하세요.</p>
            <button className={styles.button} onClick={() => navigate('/login')} style={{ backgroundColor: '#059669' }}>
              로그인 하러 가기
            </button>
          </div>
        )}

        {/* ── 거절 ── */}
        {step === 'rejected' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, color: '#EF4444' }}>가입 요청이 거절되었습니다.</p>
            {rejectReason && (
              <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>사유: {rejectReason}</p>
            )}
            <button className={styles.button} onClick={() => { setStep('request'); setRegistrationId(null) }} style={{ backgroundColor: '#6B7280' }}>
              다시 요청하기
            </button>
          </div>
        )}

        {['request'].includes(step) && (
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
