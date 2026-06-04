import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useToast } from '../../hooks/useToast'
import { formatPhone } from '../../utils/helpers'

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

interface DoctorProfile {
  id:             number
  name:           string
  phone_number:   string
  birth_date:     string | null
  license_number: string | null
  hospital_name:  string | null
  role:           string
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ minWidth: 88, fontSize: 13, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, autoFocus }: {
  label: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
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

export default function DoctorMyPage() {
  const navigate   = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BP)
  const [profile,  setProfile]  = useState<DoctorProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  const [editMode,   setEditMode]   = useState(false)
  const [name,       setName]       = useState('')
  const [birth,      setBirth]      = useState('')
  const [phone,      setPhone]      = useState('')
  const [curPw,      setCurPw]      = useState('')
  const [showPwChange, setShowPwChange] = useState(false)
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const saveToast = useToast(2000)
  const [formError,  setFormError]  = useState('')

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
        if (d) { setProfile(d); setName(d.name); setBirth(d.birth_date ?? ''); setPhone(d.phone_number) }
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [navigate])

  const patch = async (body: object) => {
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
    setName(profile.name); setBirth(profile.birth_date ?? ''); setPhone(profile.phone_number)
    setCurPw(''); setShowPwChange(false); setNewPw(''); setConfirmPw(''); setFormError('')
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false); setFormError('')
  }

  const handleSave = async () => {
    if (!profile) return
    setFormError('')
    const nameChanged  = name.trim() !== profile.name
    const birthChanged = birth !== (profile.birth_date ?? '')
    const phoneChanged = phone !== profile.phone_number
    const needsPw      = nameChanged || birthChanged || phoneChanged || showPwChange

    if (needsPw && !curPw) { setFormError('현재 비밀번호를 입력해주세요.'); return }
    if (showPwChange) {
      if (!newPw) { setFormError('새 비밀번호를 입력해주세요.'); return }
      if (newPw.length < 6) { setFormError('비밀번호는 6자 이상이어야 합니다.'); return }
      if (newPw !== confirmPw) { setFormError('새 비밀번호가 일치하지 않습니다.'); return }
    }
    if (!nameChanged && !birthChanged && !phoneChanged && !showPwChange) {
      setEditMode(false); return
    }

    const body: Record<string, any> = {}
    if (nameChanged)  body.name         = name.trim()
    if (birthChanged) body.birth_date   = birth || null
    if (phoneChanged) body.phone_number = phone
    if (needsPw)      body.current_password = curPw
    if (showPwChange && newPw) body.new_password = newPw

    setSaving(true)
    try {
      const data = await patch(body)
      setProfile(p => p ? { ...p, name: data.name ?? name, birth_date: birth || null, phone_number: phone } : p)
      if (data.name) localStorage.setItem('user_name', data.name)
      saveToast.show('saved')
      setEditMode(false)
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 40, color: C.textMuted, fontSize: 13 }}>불러오는 중...</div>
  if (err)     return <div style={{ padding: 40, color: C.danger,    fontSize: 13 }}>오류: {err}</div>
  if (!profile) return null

  const profileCard = (
    <Card style={{ marginBottom: isMobile ? 14 : 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: C.primary, marginBottom: 10 }}>
          {profile.name[0] ?? 'D'}
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>{profile.name} 선생님</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>신장분과전문의</div>
      </div>
      <InfoRow label="이름"     value={profile.name} />
      <InfoRow label="생년월일"  value={profile.birth_date ?? undefined} />
      <InfoRow label="자격번호"  value={profile.license_number ?? undefined} />
      <InfoRow label="소속 병원" value={profile.hospital_name ?? undefined} />
      <InfoRow label="전화번호"  value={formatPhone(profile.phone_number)} />
    </Card>
  )

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
          <Field label="이름" value={name} onChange={setName} placeholder="이름" autoFocus />
          <Field label="생년월일" value={birth} onChange={setBirth} placeholder="예) 1985-03-22" />
          <Field label="전화번호" type="tel" value={phone} onChange={setPhone} placeholder="010-0000-0000" />

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
                <Field label="새 비밀번호" type="password" value={newPw} onChange={setNewPw} placeholder="6자 이상" />
                <Field label="새 비밀번호 확인" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="새 비밀번호 재입력" />
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
            <Field label="현재 비밀번호 *" type="password" value={curPw} onChange={setCurPw} placeholder="변경 확인을 위해 입력" />
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

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', minHeight: '100vh' }}>
      <div style={{ marginBottom: isMobile ? 18 : 24 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 22, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>마이페이지</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMuted }}>계정 정보 확인 및 수정</p>
      </div>

      {isMobile ? (
        <>{profileCard}{editCard}</>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 260px' }}>{profileCard}</div>
          <div style={{ flex: 1 }}>{editCard}</div>
        </div>
      )}
    </div>
  )
}
