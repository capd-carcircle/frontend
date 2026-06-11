import React, { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import { useNavigate } from 'react-router'
import { formatPhone } from '../../utils/helpers'
import { apiFetch } from '../../api/apiFetch'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const C = {
  primary: '#534AB7',
  bg:      'var(--capd-bg)',
  border:  '#e5e7eb',
  text:    '#1a1a2e',
  muted:   '#6b7280',
  light:   '#9ca3af',
  danger:  '#dc2626',
}

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  borderTop: `0.5px solid ${C.border}`, minHeight: 44,
}
const lbl: React.CSSProperties = {
  width: 112, flexShrink: 0, padding: '0 16px', fontSize: 13, color: C.muted,
}
const dim: React.CSSProperties = {
  flex: 1, padding: '0 8px 0 0', fontSize: 13, color: C.light, fontWeight: 400,
}

function PwToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', fontSize: 13, color: active || hovered ? '#534AB7' : '#6b7280', cursor: 'pointer', borderTop: '0.5px solid #e5e7eb' }}
    >
      비밀번호 변경
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16,
  border: `0.5px solid ${C.border}`, overflow: 'hidden', marginBottom: 14,
}

interface DoctorProfile {
  id: number; name: string; phone_number: string
  birth_date: string | null; license_number: string | null
  hospital_name: string | null; role: string
}

export default function DoctorMyPage() {
  const navigate  = useNavigate()
  const [profile,  setProfile]  = useState<DoctorProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')

  const [editMode,      setEditMode]      = useState(false)
  const [showPwSection, setShowPwSection] = useState(false)
  const [curPw,         setCurPw]         = useState('')
  const [newPw,         setNewPw]         = useState('')
  const [confirmPw,     setConfirmPw]     = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState('')
  const [formError,     setFormError]     = useState('')

  const token = () => localStorage.getItem('access_token') ?? ''
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    apiFetch(`${API}/api/v1/auth/me/profile`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => { if (r.status === 401) { useAuthStore.getState().logout(); navigate('/login'); return null } return r.json() })
      .then(d => { if (d) setProfile(d) })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [navigate])

  const patch = async (body: object) => {
    const res = await apiFetch(`${API}/api/v1/auth/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? '오류') }
    return res.json()
  }

  const openEdit = () => {
    setCurPw(''); setNewPw(''); setConfirmPw('')
    setShowPwSection(false); setFormError(''); setEditMode(true)
  }

  const cancelEdit = () => { setEditMode(false); setShowPwSection(false); setFormError('') }

  const handleSave = async () => {
    setFormError('')
    if (!curPw) { setFormError('현재 비밀번호를 입력해주세요.'); return }
    if (showPwSection) {
      if (!newPw) { setFormError('새 비밀번호를 입력해주세요.'); return }
      if (newPw.length < 6) { setFormError('비밀번호는 6자 이상이어야 합니다.'); return }
      if (newPw !== confirmPw) { setFormError('새 비밀번호가 일치하지 않습니다.'); return }
    }
    if (!showPwSection) { setEditMode(false); return }
    const body: Record<string, any> = { current_password: curPw }
    if (showPwSection && newPw) body.new_password = newPw
    setSaving(true)
    try {
      await patch(body)
      setSaveMsg('저장되었습니다'); setTimeout(() => setSaveMsg(''), 2000)
      setEditMode(false); setShowPwSection(false)
    } catch (e: any) { setFormError(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 40, color: C.muted, fontSize: 14 }}>불러오는 중...</div>
  if (err || !profile) return <div style={{ padding: 40, color: C.danger, fontSize: 14 }}>{err || '오류가 발생했습니다.'}</div>

  return (
    <div style={{ padding: isMobile ? '16px' : '28px 32px', maxWidth: 560, fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, letterSpacing: '-0.04em' }}>마이페이지</h1>
      </div>

      <div style={card}>
        {/* 헤더 */}
        <div style={{ background: '#fafafa', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `0.5px solid ${C.border}` }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 500, color: C.primary, flexShrink: 0 }}>
            {profile.name[0]}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.text }}>{profile.name} 선생님</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>신장분과전문의</div>
          </div>
          <button
            onClick={editMode ? cancelEdit : openEdit}
            style={{ marginLeft: 'auto', padding: '6px 16px', border: `0.5px solid ${editMode ? C.primary : C.border}`, borderRadius: 20, background: 'transparent', cursor: 'pointer', fontSize: 13, color: editMode ? C.primary : C.muted, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            {editMode ? '✕ 닫기' : '✏ 수정'}
          </button>
        </div>

        {/* 정보 행 */}
        <div style={row}><span style={lbl}>이름</span><span style={editMode ? dim : { ...dim, color: C.text, fontWeight: 500 }}>{profile.name}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
        <div style={row}><span style={lbl}>생년월일</span><span style={editMode ? dim : { ...dim, color: C.text, fontWeight: 500 }}>{profile.birth_date ?? '—'}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
        <div style={row}><span style={lbl}>자격번호</span><span style={editMode ? dim : { ...dim, color: C.text, fontWeight: 500 }}>{profile.license_number ?? '—'}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
        <div style={row}><span style={lbl}>소속 병원</span><span style={editMode ? dim : { ...dim, color: C.text, fontWeight: 500 }}>{profile.hospital_name ?? '—'}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
        <div style={row}><span style={lbl}>전화번호</span><span style={editMode ? dim : { ...dim, color: C.text, fontWeight: 500 }}>{formatPhone(profile.phone_number)}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>

        {/* 수정 모드에서만 아래쪽에 추가 */}
        {editMode && (
          <>
            <PwToggle active={showPwSection} onClick={() => setShowPwSection(v => !v)} />
            {showPwSection && (
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: `0.5px solid ${C.border}` }}>
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)"
                  style={{ padding: '7px 10px', border: `0.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none' }} />
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="새 비밀번호 확인"
                  style={{ padding: '7px 10px', border: `0.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none' }} />
              </div>
            )}
            <div style={{ padding: '12px 16px', borderTop: `0.5px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} placeholder="현재 비밀번호를 입력해 주세요"
                style={{ padding: '8px 12px', border: `0.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none' }} />
              {formError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={cancelEdit} style={{ flex: 1, padding: '8px', border: `0.5px solid ${C.border}`, borderRadius: 20, background: 'transparent', cursor: 'pointer', fontSize: 13, color: C.muted, fontFamily: 'inherit' }}>취소</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 20, background: saving ? '#e5e7eb' : C.primary, color: saving ? C.muted : '#fff', fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {saveMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, zIndex: 999 }}>
          ✓ {saveMsg}
        </div>
      )}
    </div>
  )
}
