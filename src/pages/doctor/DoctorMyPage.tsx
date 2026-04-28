/**
 * DoctorMyPage — 의사 마이페이지
 * 경로: /doctor/mypage
 *
 * 레이아웃
 *  - 데스크톱(≥768px): 좌열(프로필 카드) + 우열(수정 섹션들)
 *  - 모바일(<768px): 단일 열
 *
 * 수정 UX
 *  - 프로필(이름/생년월일): "수정하기" 버튼 → 편집 모드, 현재 비밀번호 필수
 *  - 전화번호 변경: "수정하기" 버튼 → 입력 + 현재 비밀번호 필수
 *  - 비밀번호 변경: "수정하기" 버튼 → 입력
 */
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const MOBILE_BP = 768

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  textLight:    '#9ca3af',
  success:      '#16a34a',
  danger:       '#dc2626',
}

interface DoctorProfile {
  id:             number
  name:           string
  phone_number:   string
  birth_date:     string | null
  license_number: string | null
  hospital_name:  string | null
  role:           string
}

/* ── 공통 컴포넌트 ── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ minWidth: 88, fontSize: 13, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  )
}

function InputField({ label, type = 'text', value, onChange, placeholder, autoFocus }: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  const [focused,   setFocused]   = useState(false)
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

function SectionCard({ title, children, style }: {
  title?: string; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`,
      padding: '18px 22px', marginBottom: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', ...style,
    }}>
      {title && <h2 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>{title}</h2>}
      {children}
    </div>
  )
}

/* ── 수정하기 / 취소 / 저장 버튼 스타일 ── */
const editBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 8,
  border: `1px solid ${C.border}`, background: '#fff',
  fontSize: 12, fontWeight: 600, color: C.textMuted,
  cursor: 'pointer', fontFamily: 'inherit',
}
const cancelBtn: React.CSSProperties = {
  ...editBtn, marginRight: 8,
}
const saveBtn = (disabled: boolean, saved: boolean): React.CSSProperties => ({
  padding: '7px 16px', borderRadius: 8, border: 'none',
  background: saved ? C.success : disabled ? '#e5e7eb' : C.primary,
  color: (saved || !disabled) ? '#fff' : C.textMuted,
  fontSize: 12, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  fontFamily: 'inherit', transition: 'all 0.15s',
})

/* ════════════════════════════════════════ */
export default function DoctorMyPage() {
  const navigate  = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BP)
  const [profile,  setProfile]  = useState<DoctorProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  // ── 프로필 편집 모드
  const [editProfile,  setEditProfile]  = useState(false)
  const [editName,     setEditName]     = useState('')
  const [editBirth,    setEditBirth]    = useState('')
  const [profPw,       setProfPw]       = useState('')
  const [profSaving,   setProfSaving]   = useState(false)
  const [profSaved,    setProfSaved]    = useState(false)
  const [profError,    setProfError]    = useState('')

  // ── 전화번호 편집 모드
  const [editPhone,    setEditPhone]    = useState(false)
  const [newPhone,     setNewPhone]     = useState('')
  const [phonePw,      setPhonePw]      = useState('')
  const [phoneSaving,  setPhoneSaving]  = useState(false)
  const [phoneSaved,   setPhoneSaved]   = useState(false)
  const [phoneError,   setPhoneError]   = useState('')

  // ── 비밀번호 편집 모드
  const [editPw,       setEditPw]       = useState(false)
  const [curPw,        setCurPw]        = useState('')
  const [newPw,        setNewPw]        = useState('')
  const [confirmPw,    setConfirmPw]    = useState('')
  const [pwSaving,     setPwSaving]     = useState(false)
  const [pwSaved,      setPwSaved]      = useState(false)
  const [pwError,      setPwError]      = useState('')

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
        if (d) {
          setProfile(d)
          setEditName(d.name)
          setEditBirth(d.birth_date ?? '')
          setNewPhone(d.phone_number)
        }
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [navigate])

  /* ── PATCH helper ── */
  const patch = async (body: object) => {
    const res = await fetch(`${API}/api/v1/auth/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? '오류') }
    return res.json()
  }

  /* ── 프로필 저장 ── */
  const saveProfile = async () => {
    setProfError(''); setProfSaving(true)
    try {
      const data = await patch({ name: editName, birth_date: editBirth || null, current_password: profPw })
      setProfile(p => p ? { ...p, name: data.name ?? editName, birth_date: editBirth || null } : p)
      if (data.name) localStorage.setItem('user_name', data.name)
      setProfSaved(true); setTimeout(() => setProfSaved(false), 2000)
      setEditProfile(false); setProfPw('')
    } catch (e: any) { setProfError(e.message) } finally { setProfSaving(false) }
  }

  /* ── 전화번호 저장 ── */
  const savePhone = async () => {
    setPhoneError(''); setPhoneSaving(true)
    try {
      await patch({ phone_number: newPhone, current_password: phonePw })
      setProfile(p => p ? { ...p, phone_number: newPhone } : p)
      setPhoneSaved(true); setTimeout(() => setPhoneSaved(false), 2000)
      setEditPhone(false); setPhonePw('')
    } catch (e: any) { setPhoneError(e.message) } finally { setPhoneSaving(false) }
  }

  /* ── 비밀번호 저장 ── */
  const savePw = async () => {
    setPwError('')
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return }
    if (newPw.length < 6)    { setPwError('비밀번호는 6자 이상이어야 합니다.'); return }
    setPwSaving(true)
    try {
      await patch({ current_password: curPw, new_password: newPw })
      setCurPw(''); setNewPw(''); setConfirmPw('')
      setPwSaved(true); setTimeout(() => setPwSaved(false), 2000)
      setEditPw(false)
    } catch (e: any) { setPwError(e.message) } finally { setPwSaving(false) }
  }

  if (loading) return <div style={{ padding: 40, color: C.textMuted, fontSize: 13 }}>불러오는 중...</div>
  if (err)     return <div style={{ padding: 40, color: C.danger,    fontSize: 13 }}>오류: {err}</div>
  if (!profile) return null

  /* ── 프로필 카드 (공통) ── */
  const ProfileCard = () => (
    <SectionCard style={{ marginBottom: isMobile ? 14 : 0 }}>
      {/* 아바타 + 이름 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: C.primaryLight,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 900, color: C.primary, marginBottom: 10,
        }}>
          {profile.name[0] ?? 'D'}
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{profile.name} 선생님</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>신장분과전문의</div>
      </div>

      <InfoRow label="이름"       value={profile.name} />
      <InfoRow label="생년월일"    value={profile.birth_date ?? undefined} />
      <InfoRow label="자격번호"    value={profile.license_number ?? undefined} />
      <InfoRow label="소속 병원"   value={profile.hospital_name ?? undefined} />
      <InfoRow label="전화번호"    value={profile.phone_number} />
    </SectionCard>
  )

  /* ── 수정 섹션들 ── */
  const EditSections = () => (
    <>
      {/* ── 기본 정보 수정 ── */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editProfile ? 14 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>기본 정보 수정</h2>
          {!editProfile && (
            <button style={editBtn} onClick={() => { setEditProfile(true); setProfError(''); setProfPw('') }}>
              수정하기
            </button>
          )}
        </div>

        {editProfile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField label="이름" value={editName} onChange={setEditName} placeholder="이름" autoFocus />
            <InputField label="생년월일" value={editBirth} onChange={setEditBirth} placeholder="예) 1985-03-22" />
            <InputField label="현재 비밀번호 *" type="password" value={profPw} onChange={setProfPw} placeholder="변경 확인을 위해 입력" />
            {profError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{profError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={cancelBtn} onClick={() => { setEditProfile(false); setEditName(profile.name); setEditBirth(profile.birth_date ?? ''); setProfError('') }}>취소</button>
              <button
                onClick={saveProfile}
                disabled={profSaving || !profPw || (!editName.trim())}
                style={saveBtn(profSaving || !profPw || !editName.trim(), profSaved)}
              >
                {profSaving ? '저장 중...' : profSaved ? '✓ 저장됨' : '저장'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 전화번호 변경 ── */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editPhone ? 14 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>전화번호 변경</h2>
          {!editPhone && (
            <button style={editBtn} onClick={() => { setEditPhone(true); setPhoneError(''); setPhonePw(''); setNewPhone(profile.phone_number) }}>
              수정하기
            </button>
          )}
        </div>

        {editPhone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField label="새 전화번호" type="tel" value={newPhone} onChange={setNewPhone} placeholder="010-0000-0000" autoFocus />
            <InputField label="현재 비밀번호 *" type="password" value={phonePw} onChange={setPhonePw} placeholder="변경 확인을 위해 입력" />
            {phoneError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{phoneError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={cancelBtn} onClick={() => { setEditPhone(false); setPhoneError('') }}>취소</button>
              <button
                onClick={savePhone}
                disabled={phoneSaving || !phonePw || newPhone === profile.phone_number}
                style={saveBtn(phoneSaving || !phonePw || newPhone === profile.phone_number, phoneSaved)}
              >
                {phoneSaving ? '저장 중...' : phoneSaved ? '✓ 저장됨' : '변경'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── 비밀번호 변경 ── */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editPw ? 14 : 0 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>비밀번호 변경</h2>
          {!editPw && (
            <button style={editBtn} onClick={() => { setEditPw(true); setPwError(''); setCurPw(''); setNewPw(''); setConfirmPw('') }}>
              수정하기
            </button>
          )}
        </div>

        {editPw && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField label="현재 비밀번호" type="password" value={curPw}     onChange={setCurPw}     placeholder="현재 비밀번호" autoFocus />
            <InputField label="새 비밀번호"   type="password" value={newPw}     onChange={setNewPw}     placeholder="6자 이상" />
            <InputField label="새 비밀번호 확인" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="새 비밀번호 재입력" />
            {pwError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{pwError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button style={cancelBtn} onClick={() => { setEditPw(false); setPwError('') }}>취소</button>
              <button
                onClick={savePw}
                disabled={pwSaving || !curPw || !newPw || !confirmPw}
                style={saveBtn(pwSaving || !curPw || !newPw || !confirmPw, pwSaved)}
              >
                {pwSaving ? '변경 중...' : pwSaved ? '✓ 변경됨' : '비밀번호 변경'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  )

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', minHeight: '100vh' }}>
      {/* 페이지 제목 */}
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>마이페이지</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>계정 정보 확인 및 수정</p>
      </div>

      {isMobile ? (
        /* ── 모바일: 단열 ── */
        <>
          <ProfileCard />
          <EditSections />
        </>
      ) : (
        /* ── 데스크톱: 2열 ── */
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 260px' }}>
            <ProfileCard />
          </div>
          <div style={{ flex: 1 }}>
            <EditSections />
          </div>
        </div>
      )}
    </div>
  )
}
