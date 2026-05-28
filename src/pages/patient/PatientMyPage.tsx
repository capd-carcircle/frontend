import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../../hooks/useToast'
import {
  getHospitals, getDoctors,
  patientConnectRequest, getMyPendingRequest, cancelMyRequest, patientDischargeRequest,
} from '../../api/auth'
import type { Hospital, DoctorSummary } from '../../types'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const MOBILE_BP = 768

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  success:      '#16a34a',
  danger:       '#dc2626',
}

interface PatientProfile {
  id: number; name: string; phone_number: string
  birth_date: string | null; hospital_name: string | null
  doctor_name: string | null; doctor_id: number | null
  doctor_phone: string | null; doctor_hospital: string | null
  self_memo: string | null; role: string
  gender: string | null; address: string | null
}
interface PendingReq {
  id: number; request_type: string; doctor_name: string | null; status: string
}

function calcAge(birth_date: string | null): number | null {
  if (!birth_date) return null
  const today = new Date(); const birth = new Date(birth_date + 'T00:00:00')
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ minWidth: 80, fontSize: 13, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, autoFocus }: {
  label: string; type?: string; value: string
  onChange?: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={e => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          padding: '9px 12px', borderRadius: 9,
          border: `1.5px solid ${focused ? C.primary : C.border}`,
          fontSize: 13, fontFamily: 'inherit', color: C.text,
          background: '#fff', outline: 'none', transition: 'border-color 0.15s',
        }}
      />
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
      padding: '18px 22px', marginBottom: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', ...style,
    }}>{children}</div>
  )
}

const selectSt: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${C.border}`,
  fontSize: 13, fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none',
}

export default function PatientMyPage() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BP)
  const [profile,  setProfile]  = useState<PatientProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  // 편집 상태 (메모 + 비밀번호만 수정 가능)
  const [editMode, setEditMode] = useState(false)
  const [memo,     setMemo]     = useState('')
  const [showPwChange, setShowPwChange] = useState(false)
  const [curPw,    setCurPw]    = useState('')
  const [newPw,    setNewPw]    = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving,   setSaving]   = useState(false)
  const saveToast = useToast(2000)
  const errToast  = useToast(3000)
  const [formError, setFormError] = useState('')

  // 담당의사
  const [pendingReq,     setPendingReq]     = useState<PendingReq | null>(null)
  const [connectMode,    setConnectMode]    = useState(false)
  const [hospitals,      setHospitals]      = useState<Hospital[]>([])
  const [doctors,        setDoctors]        = useState<DoctorSummary[]>([])
  const [selHospital,    setSelHospital]    = useState<number | ''>('')
  const [selDoctor,      setSelDoctor]      = useState<number | ''>('')
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError,   setConnectError]   = useState('')

  const token = () => localStorage.getItem('access_token') ?? ''

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BP)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    fetch(`${API}/api/v1/auth/me/profile`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => { if (r.status === 401) { localStorage.clear(); navigate('/login'); return null } return r.json() })
      .then(d => {
        if (!d) return
        setProfile(d)
        setMemo(d.self_memo ?? '')
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
    getMyPendingRequest().then(r => setPendingReq(r.request)).catch(() => {})
    getHospitals().then(setHospitals).catch(() => {})
  }, [navigate])

  const apiFetch = async (body: object) => {
    const res = await fetch(`${API}/api/v1/auth/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? '오류') }
    return res.json()
  }

  const openEdit = () => {
    if (!profile) return
    setMemo(profile.self_memo ?? '')
    setCurPw(''); setShowPwChange(false); setNewPw(''); setConfirmPw('')
    setFormError(''); setEditMode(true)
  }

  const cancelEdit = () => { setEditMode(false); setFormError('') }

  const handleSave = async () => {
    if (!profile) return
    setFormError('')

    const memoChanged = memo !== (profile.self_memo ?? '')

    // 비밀번호 변경 검증
    if (showPwChange) {
      if (!curPw) { setFormError('현재 비밀번호를 입력해주세요.'); return }
      if (!newPw) { setFormError('새 비밀번호를 입력해주세요.'); return }
      if (newPw.length < 6) { setFormError('비밀번호는 6자 이상이어야 합니다.'); return }
      if (newPw !== confirmPw) { setFormError('새 비밀번호가 일치하지 않습니다.'); return }
    }

    const body: Record<string, any> = {}
    if (memoChanged) body.self_memo = memo
    if (showPwChange && newPw) {
      body.current_password = curPw
      body.new_password = newPw
    }

    if (Object.keys(body).length === 0) { setEditMode(false); return }

    setSaving(true)
    try {
      await apiFetch(body)
      setProfile(p => p ? { ...p, self_memo: memo } : p)
      saveToast.show('saved')
      setEditMode(false)
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  const handleHospitalChange = async (id: number | '') => {
    setSelHospital(id); setSelDoctor('')
    if (!id) { setDoctors([]); return }
    try { setDoctors(await getDoctors(Number(id))) } catch { setDoctors([]) }
  }

  const handleConnectRequest = async () => {
    if (!selDoctor) { setConnectError('담당 의사를 선택해주세요.'); return }
    setConnectLoading(true); setConnectError('')
    try {
      await patientConnectRequest(Number(selDoctor))
      const r = await getMyPendingRequest(); setPendingReq(r.request)
      setConnectMode(false); setSelHospital(''); setSelDoctor('')
    } catch (e: any) { setConnectError(e?.response?.data?.detail ?? '신청에 실패했습니다.') }
    finally { setConnectLoading(false) }
  }

  const handleCancelRequest = async () => {
    if (!pendingReq || !window.confirm('신청을 취소하시겠습니까?')) return
    setConnectLoading(true)
    try { await cancelMyRequest(pendingReq.id); setPendingReq(null) }
    catch (e: any) { errToast.show(e?.response?.data?.detail ?? '취소에 실패했습니다.') }
    finally { setConnectLoading(false) }
  }

  const handleDischargeRequest = async () => {
    if (!window.confirm('담당 해제 요청을 보내시겠습니까?')) return
    setConnectLoading(true)
    try {
      await patientDischargeRequest()
      const r = await getMyPendingRequest(); setPendingReq(r.request)
    } catch (e: any) { errToast.show(e?.response?.data?.detail ?? '요청에 실패했습니다.') }
    finally { setConnectLoading(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: C.textMuted, fontSize: 14 }}>불러오는 중...</p>
    </div>
  )
  if (err || !profile) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: C.danger, fontSize: 14 }}>{err || '오류가 발생했습니다.'}</p>
    </div>
  )

  const age = calcAge(profile.birth_date)
  const genderLabel = profile.gender === 'm' ? '남성' : profile.gender === 'f' ? '여성' : null

  // ── 프로필 카드
  const profileCard = (
    <Card style={{ marginBottom: isMobile ? 14 : 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: C.primary, marginBottom: 10 }}>
          {profile.name[0] ?? 'P'}
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{profile.name}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
          CAPD 환자
          {(age !== null || genderLabel) && (
            <span style={{ marginLeft: 6, color: C.primary, fontWeight: 700 }}>
              {[age, genderLabel ? (profile.gender === 'm' ? '남' : '여') : null].filter(v => v !== null).join('/')}
            </span>
          )}
        </div>
      </div>
      <InfoRow label="이름"     value={profile.name} />
      <InfoRow label="생년월일"  value={profile.birth_date ?? undefined} />
      <InfoRow label="성별"     value={genderLabel ?? undefined} />
      <InfoRow label="통원 병원" value={profile.hospital_name ?? undefined} />
      <InfoRow label="전화번호"  value={profile.phone_number} />
    </Card>
  )

  // ── 계정 정보 수정 카드 (메모 + 비밀번호만)
  const editCard = (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editMode ? 16 : 0 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>계정 정보 수정</h2>
        {!editMode && (
          <button onClick={openEdit} style={{
            padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: '#fff', fontSize: 12, fontWeight: 600, color: C.textMuted,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>수정하기</button>
        )}
      </div>

      {editMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 메모 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>
              나의 특이사항
              <span style={{ marginLeft: 6, fontWeight: 400 }}>담당 의사에게 공유됩니다</span>
            </label>
            <textarea
              value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="평소 특이사항을 자유롭게 적어주세요." rows={3}
              style={{
                padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${C.border}`,
                fontSize: 13, fontFamily: 'inherit', color: C.text, resize: 'vertical',
                outline: 'none', background: '#fafafa', lineHeight: 1.7, boxSizing: 'border-box', width: '100%',
              }}
            />
          </div>

          {/* 비밀번호 변경 */}
          <div>
            <button
              onClick={() => setShowPwChange(v => !v)}
              style={{ fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}
            >
              {showPwChange ? '▾ 비밀번호 변경 접기' : '▸ 비밀번호 변경'}
            </button>
            {showPwChange && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, paddingLeft: 4 }}>
                <Field label="현재 비밀번호" type="password" value={curPw} onChange={setCurPw} placeholder="현재 비밀번호 입력" />
                <Field label="새 비밀번호" type="password" value={newPw} onChange={setNewPw} placeholder="6자 이상" />
                <Field label="새 비밀번호 확인" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="새 비밀번호 재입력" />
              </div>
            )}
          </div>

          {formError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{formError}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={cancelEdit} style={{
              padding: '7px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: '#fff', fontSize: 13, fontWeight: 600, color: C.textMuted,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>취소</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '7px 18px', borderRadius: 8, border: 'none',
              background: saveToast.message ? C.success : saving ? '#e5e7eb' : C.primary,
              color: saving ? C.textMuted : '#fff',
              fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              {saving ? '저장 중...' : saveToast.message ? '✓ 저장됨' : '저장'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )

  // ── 담당 의사 카드
  const doctorCard = (
    <Card>
      <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: C.text }}>담당 의사</h2>
      {profile.doctor_name && !pendingReq && (
        <div>
          <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>👨‍⚕️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{profile.doctor_name}</div>
              </div>
            </div>
            {(profile.doctor_hospital || profile.doctor_phone) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 28 }}>
                {profile.doctor_hospital && (
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    🏥 {profile.doctor_hospital}
                  </div>
                )}
                {profile.doctor_phone && (
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    📞 {profile.doctor_phone}
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={handleDischargeRequest} disabled={connectLoading} style={{
            padding: '7px 14px', borderRadius: 8, border: `1px solid #fca5a5`,
            background: '#fff', fontSize: 12, fontWeight: 600, color: C.danger,
            cursor: 'pointer', fontFamily: 'inherit', width: '100%',
          }}>
            {connectLoading ? '처리 중...' : '담당 해제 요청'}
          </button>
        </div>
      )}
      {pendingReq && (
        <div>
          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
              {pendingReq.request_type === 'connect' ? '⏳ 연결 신청 대기 중' : '⏳ 해제 요청 대기 중'}
            </div>
            {pendingReq.doctor_name && <div style={{ fontSize: 13, color: C.text }}>의사: {pendingReq.doctor_name}</div>}
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>담당 의사의 승인을 기다리는 중입니다.</div>
          </div>
          <button onClick={handleCancelRequest} disabled={connectLoading} style={{
            padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: '#fff', fontSize: 12, fontWeight: 600, color: C.textMuted,
            cursor: 'pointer', fontFamily: 'inherit', width: '100%',
          }}>
            {connectLoading ? '취소 중...' : '신청 취소'}
          </button>
        </div>
      )}
      {!profile.doctor_name && !pendingReq && !connectMode && (
        <div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12, padding: '10px 12px', background: C.bg, borderRadius: 10, lineHeight: 1.6 }}>
            담당 의사가 없습니다. 연결하면 기록 제출 및 AI 분석을 이용할 수 있습니다.
          </div>
          <button onClick={() => setConnectMode(true)} style={{
            padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.primary}`,
            background: '#fff', fontSize: 12, fontWeight: 700, color: C.primary,
            cursor: 'pointer', fontFamily: 'inherit', width: '100%',
          }}>
            + 담당 의사 연결 신청
          </button>
        </div>
      )}
      {connectMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>병원 선택</label>
            <select value={selHospital} onChange={e => handleHospitalChange(Number(e.target.value) || '')} style={selectSt}>
              <option value="">병원을 선택하세요</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>담당 의사 선택</label>
            <select value={selDoctor} onChange={e => setSelDoctor(Number(e.target.value) || '')}
              disabled={!selHospital} style={{ ...selectSt, opacity: !selHospital ? 0.6 : 1 }}>
              <option value="">{selHospital ? '담당 의사를 선택하세요' : '먼저 병원을 선택하세요'}</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {connectError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{connectError}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setConnectMode(false); setConnectError(''); setSelHospital(''); setSelDoctor('') }} style={{
              padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: '#fff', fontSize: 12, fontWeight: 600, color: C.textMuted,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>취소</button>
            <button onClick={handleConnectRequest} disabled={connectLoading || !selDoctor} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: (connectLoading || !selDoctor) ? '#e5e7eb' : C.primary,
              color: (connectLoading || !selDoctor) ? C.textMuted : '#fff',
              fontSize: 12, fontWeight: 700, cursor: (connectLoading || !selDoctor) ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}>
              {connectLoading ? '신청 중...' : '연결 신청'}
            </button>
          </div>
        </div>
      )}
    </Card>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: C.primary, display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 100, boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '5px 12px', fontFamily: 'inherit' }}>
          ← 뒤로
        </button>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: '-0.03em', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>마이페이지</span>
      </header>

      <main style={{ paddingTop: 72, paddingBottom: 48, paddingLeft: isMobile ? 16 : 32, paddingRight: isMobile ? 16 : 32, maxWidth: isMobile ? undefined : 960, margin: '0 auto' }}>
        {!isMobile && (
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>마이페이지</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>계정 정보 확인 및 수정</p>
          </div>
        )}
        {isMobile ? (
          <>{profileCard}{editCard}{doctorCard}</>
        ) : (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 280px' }}>{profileCard}</div>
            <div style={{ flex: 1 }}>{editCard}{doctorCard}</div>
          </div>
        )}
      </main>
    </div>
  )
}
