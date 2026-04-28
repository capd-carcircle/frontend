import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router'
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
  self_memo: string | null; role: string
}
interface PendingReq {
  id: number; request_type: string; doctor_name: string | null; status: string
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ minWidth: 80, fontSize: 13, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  )
}

function InputField({ label, type = 'text', value, onChange, placeholder, autoFocus }: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const composing = useRef(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={e => { if (!composing.current) onChange(e.target.value) }}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={e => { composing.current = false; onChange((e.target as HTMLInputElement).value) }}
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

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
      padding: '18px 22px', marginBottom: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', ...style,
    }}>{children}</div>
  )
}

const editBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 8, border: `1px solid var(--capd-border)`,
  background: '#fff', fontSize: 12, fontWeight: 600, color: '#6b7280',
  cursor: 'pointer', fontFamily: 'inherit',
}
const cancelBtnStyle: React.CSSProperties = { ...editBtn, marginRight: 8 }
const saveBtnStyle = (disabled: boolean, saved: boolean): React.CSSProperties => ({
  padding: '7px 16px', borderRadius: 8, border: 'none',
  background: saved ? '#16a34a' : disabled ? '#e5e7eb' : 'var(--capd-primary)',
  color: (saved || !disabled) ? '#fff' : '#6b7280',
  fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'inherit', transition: 'all 0.15s',
})

export default function PatientMyPage() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BP)
  const [profile,  setProfile]  = useState<PatientProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  const [editProfile, setEditProfile] = useState(false)
  const [editName,    setEditName]    = useState('')
  const [editBirth,   setEditBirth]   = useState('')
  const [profPw,      setProfPw]      = useState('')
  const [profSaving,  setProfSaving]  = useState(false)
  const [profSaved,   setProfSaved]   = useState(false)
  const [profError,   setProfError]   = useState('')

  const [editPhone,   setEditPhone]   = useState(false)
  const [newPhone,    setNewPhone]    = useState('')
  const [phonePw,     setPhonePw]     = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneSaved,  setPhoneSaved]  = useState(false)
  const [phoneError,  setPhoneError]  = useState('')

  const [editPw,    setEditPw]    = useState(false)
  const [curPw,     setCurPw]     = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving,  setPwSaving]  = useState(false)
  const [pwSaved,   setPwSaved]   = useState(false)
  const [pwError,   setPwError]   = useState('')

  const [memo,       setMemo]       = useState('')
  const [origMemo,   setOrigMemo]   = useState('')
  const [memoSaving, setMemoSaving] = useState(false)
  const [memoSaved,  setMemoSaved]  = useState(false)

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
        setProfile(d); setEditName(d.name); setEditBirth(d.birth_date ?? '')
        setNewPhone(d.phone_number); setMemo(d.self_memo ?? ''); setOrigMemo(d.self_memo ?? '')
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

  const saveProfile = async () => {
    setProfError(''); setProfSaving(true)
    try {
      const data = await apiFetch({ name: editName, birth_date: editBirth || null, current_password: profPw })
      setProfile(p => p ? { ...p, name: data.name ?? editName, birth_date: editBirth || null } : p)
      if (data.name) localStorage.setItem('user_name', data.name)
      setProfSaved(true); setTimeout(() => setProfSaved(false), 2000)
      setEditProfile(false); setProfPw('')
    } catch (e: any) { setProfError(e.message) } finally { setProfSaving(false) }
  }

  const savePhone = async () => {
    setPhoneError(''); setPhoneSaving(true)
    try {
      await apiFetch({ phone_number: newPhone, current_password: phonePw })
      setProfile(p => p ? { ...p, phone_number: newPhone } : p)
      setPhoneSaved(true); setTimeout(() => setPhoneSaved(false), 2000)
      setEditPhone(false); setPhonePw('')
    } catch (e: any) { setPhoneError(e.message) } finally { setPhoneSaving(false) }
  }

  const savePw = async () => {
    setPwError('')
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return }
    if (newPw.length < 6)    { setPwError('비밀번호는 6자 이상이어야 합니다.'); return }
    setPwSaving(true)
    try {
      await apiFetch({ current_password: curPw, new_password: newPw })
      setCurPw(''); setNewPw(''); setConfirmPw('')
      setPwSaved(true); setTimeout(() => setPwSaved(false), 2000); setEditPw(false)
    } catch (e: any) { setPwError(e.message) } finally { setPwSaving(false) }
  }

  const saveMemo = async () => {
    setMemoSaving(true)
    try {
      await apiFetch({ self_memo: memo }); setOrigMemo(memo)
      setMemoSaved(true); setTimeout(() => setMemoSaved(false), 2000)
    } catch { } finally { setMemoSaving(false) }
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
    catch (e: any) { alert(e?.response?.data?.detail ?? '취소에 실패했습니다.') }
    finally { setConnectLoading(false) }
  }

  const handleDischargeRequest = async () => {
    if (!window.confirm('담당 해제 요청을 보내시겠습니까?')) return
    setConnectLoading(true)
    try {
      await patientDischargeRequest()
      const r = await getMyPendingRequest(); setPendingReq(r.request)
    } catch (e: any) { alert(e?.response?.data?.detail ?? '요청에 실패했습니다.') }
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

  const memoChanged = memo !== origMemo
  const selectSt: React.CSSProperties = {
    padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${C.border}`,
    fontSize: 13, fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none',
  }

  const profileCard = (
    <SectionCard style={{ marginBottom: isMobile ? 14 : 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: C.primary, marginBottom: 10 }}>
          {profile.name[0] ?? 'P'}
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{profile.name}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>CAPD 환자</div>
      </div>
      <InfoRow label="이름"     value={profile.name} />
      <InfoRow label="생년월일"  value={profile.birth_date ?? undefined} />
      <InfoRow label="통원 병원" value={profile.hospital_name ?? undefined} />
      <InfoRow label="담당 의사" value={profile.doctor_name ?? undefined} />
      <InfoRow label="전화번호"  value={profile.phone_number} />
    </SectionCard>
  )

  const editSections = (
    <>
      {/* 담당 의사 */}
      <SectionCard>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: C.text }}>담당 의사</h2>
        {profile.doctor_name && !pendingReq && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', borderRadius: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>👨‍⚕️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{profile.doctor_name}</div>
                {profile.hospital_name && <div style={{ fontSize: 11, color: C.textMuted }}>{profile.hospital_name}</div>}
              </div>
            </div>
            <button onClick={handleDischargeRequest} disabled={connectLoading}
              style={{ ...editBtn, width: '100%', textAlign: 'center', color: C.danger, borderColor: '#fca5a5' }}>
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
            <button onClick={handleCancelRequest} disabled={connectLoading}
              style={{ ...editBtn, width: '100%', textAlign: 'center' }}>
              {connectLoading ? '취소 중...' : '신청 취소'}
            </button>
          </div>
        )}
        {!profile.doctor_name && !pendingReq && !connectMode && (
          <div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12, padding: '10px 12px', background: C.bg, borderRadius: 10, lineHeight: 1.6 }}>
              담당 의사가 없습니다. 연결하면 기록 제출 및 AI 분석을 이용할 수 있습니다.
            </div>
            <button onClick={() => setConnectMode(true)}
              style={{ ...editBtn, width: '100%', textAlign: 'center', color: C.primary, borderColor: C.primary, fontWeight: 700 }}>
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
              <button style={cancelBtnStyle} onClick={() => { setConnectMode(false); setConnectError(''); setSelHospital(''); setSelDoctor('') }}>취소</button>
              <button onClick={handleConnectRequest} disabled={connectLoading || !selDoctor}
                style={saveBtnStyle(connectLoading || !selDoctor, false)}>
                {connectLoading ? '신청 중...' : '연결 신청'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 나의 특이사항 */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>나의 특이사항</h2>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textMuted }}>담당 의사에게 공유되며 AI 맞춤 질문 생성에 활용됩니다</p>
          </div>
          <button onClick={saveMemo} disabled={memoSaving || !memoChanged} style={saveBtnStyle(memoSaving || !memoChanged, memoSaved)}>
            {memoSaving ? '저장 중...' : memoSaved ? '✓ 저장됨' : '저장'}
          </button>
        </div>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="평소 특이사항을 자유롭게 적어주세요." rows={4}
          style={{ width: '100%', padding: '11px 13px', borderRadius: 10, border: `1.5px solid ${memoChanged ? C.primary : C.border}`, fontSize: 13, fontFamily: 'inherit', color: C.text, resize: 'vertical', outline: 'none', background: '#fafafa', lineHeight: 1.7, boxSizing: 'border-box' }}
        />
      </SectionCard>

      {/* 기본 정보 수정 */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editProfile ? 14 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>기본 정보 수정</h2>
          {!editProfile && <button style={editBtn} onClick={() => { setEditProfile(true); setProfError(''); setProfPw('') }}>수정하기</button>}
        </div>
        {editProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField label="이름" value={editName} onChange={setEditName} placeholder="이름" autoFocus />
            <InputField label="생년월일" value={editBirth} onChange={setEditBirth} placeholder="예) 1990-05-14" />
            <InputField label="현재 비밀번호 *" type="password" value={profPw} onChange={setProfPw} placeholder="변경 확인을 위해 입력" />
            {profError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{profError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={cancelBtnStyle} onClick={() => { setEditProfile(false); setEditName(profile.name); setEditBirth(profile.birth_date ?? ''); setProfError('') }}>취소</button>
              <button onClick={saveProfile} disabled={profSaving || !profPw || !editName.trim()} style={saveBtnStyle(profSaving || !profPw || !editName.trim(), profSaved)}>
                {profSaving ? '저장 중...' : profSaved ? '✓ 저장됨' : '저장'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 전화번호 변경 */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editPhone ? 14 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>전화번호 변경</h2>
          {!editPhone && <button style={editBtn} onClick={() => { setEditPhone(true); setPhoneError(''); setPhonePw(''); setNewPhone(profile.phone_number) }}>수정하기</button>}
        </div>
        {editPhone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField label="새 전화번호" type="tel" value={newPhone} onChange={setNewPhone} placeholder="010-0000-0000" autoFocus />
            <InputField label="현재 비밀번호 *" type="password" value={phonePw} onChange={setPhonePw} placeholder="변경 확인을 위해 입력" />
            {phoneError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{phoneError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={cancelBtnStyle} onClick={() => { setEditPhone(false); setPhoneError('') }}>취소</button>
              <button onClick={savePhone} disabled={phoneSaving || !phonePw || newPhone === profile.phone_number} style={saveBtnStyle(phoneSaving || !phonePw || newPhone === profile.phone_number, phoneSaved)}>
                {phoneSaving ? '저장 중...' : phoneSaved ? '✓ 저장됨' : '변경'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 비밀번호 변경 */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editPw ? 14 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>비밀번호 변경</h2>
          {!editPw && <button style={editBtn} onClick={() => { setEditPw(true); setPwError(''); setCurPw(''); setNewPw(''); setConfirmPw('') }}>수정하기</button>}
        </div>
        {editPw && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField label="현재 비밀번호" type="password" value={curPw} onChange={setCurPw} placeholder="현재 비밀번호" autoFocus />
            <InputField label="새 비밀번호" type="password" value={newPw} onChange={setNewPw} placeholder="6자 이상" />
            <InputField label="새 비밀번호 확인" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="새 비밀번호 재입력" />
            {pwError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{pwError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={cancelBtnStyle} onClick={() => { setEditPw(false); setPwError('') }}>취소</button>
              <button onClick={savePw} disabled={pwSaving || !curPw || !newPw || !confirmPw} style={saveBtnStyle(pwSaving || !curPw || !newPw || !confirmPw, pwSaved)}>
                {pwSaving ? '변경 중...' : pwSaved ? '✓ 변경됨' : '비밀번호 변경'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: C.primary, display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 100, boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '5px 12px', fontFamily: 'inherit' }}>
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
          <>{profileCard}{editSections}</>
        ) : (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 280px' }}>{profileCard}</div>
            <div style={{ flex: 1 }}>{editSections}</div>
          </div>
        )}
      </main>
    </div>
  )
}
