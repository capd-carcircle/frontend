import React, { useEffect, useState } from 'react'
import useAuthStore from '../../store/authStore'
import { useNavigate } from 'react-router'
import { formatPhone, calcAge } from '../../utils/helpers'
import {
  getHospitals, getDoctors,
  patientConnectRequest, getMyPendingRequest, cancelMyRequest, patientDischargeRequest,
} from '../../api/auth'
import type { Hospital, DoctorSummary } from '../../types'
import { apiFetch } from '../../api/apiFetch'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const C = {
  primary:   'var(--capd-primary)',
  bg:        'var(--capd-bg)',
  border:    '#e5e7eb',
  text:      '#1a1a2e',
  muted:     '#6b7280',
  light:     '#9ca3af',
  danger:    '#dc2626',
  success:   '#059669',
}

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  borderTop: `0.5px solid ${C.border}`, minHeight: 44,
}
const lbl: React.CSSProperties = {
  width: 112, flexShrink: 0, padding: '0 16px', fontSize: 13, color: C.muted,
}
const val: React.CSSProperties = {
  flex: 1, padding: '0 8px 0 0', fontSize: 13, color: C.text, fontWeight: 500,
}
const dim: React.CSSProperties = {
  ...val, color: C.light, fontWeight: 400,
}
const inp: React.CSSProperties = {
  flex: 1, margin: '6px 8px 6px 0', padding: '6px 10px',
  border: `0.5px solid var(--capd-primary)`, borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', color: C.text,
  background: '#fff', outline: 'none', boxSizing: 'border-box' as const,
}
function PwToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', fontSize: 13, color: active || hovered ? 'var(--capd-primary)' : '#6b7280', cursor: 'pointer', borderTop: '0.5px solid #e5e7eb' }}
    >
      비밀번호 변경
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16,
  border: `0.5px solid ${C.border}`, overflow: 'hidden', marginBottom: 14,
}

interface PatientProfile {
  id: number; name: string; phone_number: string
  birth_date: string | null; hospital_name: string | null
  doctor_name: string | null; doctor_id: number | null
  doctor_phone: string | null; doctor_hospital: string | null
  self_memo: string | null; role: string
  gender: string | null; address: string | null
}
interface PendingReq { id: number; request_type: string; doctor_name: string | null; status: string }

export default function PatientMyPage() {
  const navigate = useNavigate()
  const [profile,  setProfile]  = useState<PatientProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 480)

  const [editMode,      setEditMode]      = useState(false)
  const [memo,          setMemo]          = useState('')
  const [address,       setAddress]       = useState('')
  const [showPwSection, setShowPwSection] = useState(false)
  const [curPw,         setCurPw]         = useState('')
  const [newPw,         setNewPw]         = useState('')
  const [confirmPw,     setConfirmPw]     = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState('')
  const [formError,     setFormError]     = useState('')

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
    const handleResize = () => setIsMobile(window.innerWidth < 480)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    apiFetch(`${API}/api/v1/auth/me/profile`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => { if (r.status === 401) { useAuthStore.getState().logout(); navigate('/login'); return null } return r.json() })
      .then(d => { if (!d) return; setProfile(d); setMemo(d.self_memo ?? ''); setAddress(d.address ?? '') })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
    getMyPendingRequest().then(r => setPendingReq(r.request)).catch(() => {})
    getHospitals().then(setHospitals).catch(() => {})
  }, [navigate])

  const patchProfile = async (body: object) => {
    const res = await apiFetch(`${API}/api/v1/auth/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? '오류') }
    return res.json()
  }

  const openEdit = () => {
    if (!profile) return
    setMemo(profile.self_memo ?? ''); setAddress(profile.address ?? '')
    setCurPw(''); setNewPw(''); setConfirmPw('')
    setShowPwSection(false); setFormError(''); setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false); setShowPwSection(false); setFormError('')
  }

  const handleSave = async () => {
    if (!profile) return
    setFormError('')
    if (!curPw) { setFormError('현재 비밀번호를 입력해주세요.'); return }
    if (showPwSection) {
      if (!newPw) { setFormError('새 비밀번호를 입력해주세요.'); return }
      if (newPw.length < 6) { setFormError('비밀번호는 6자 이상이어야 합니다.'); return }
      if (newPw !== confirmPw) { setFormError('새 비밀번호가 일치하지 않습니다.'); return }
    }
    const body: Record<string, any> = { current_password: curPw }
    if (memo !== (profile.self_memo ?? '')) body.self_memo = memo
    if (address !== (profile.address ?? '')) body.address = address
    if (showPwSection && newPw) body.new_password = newPw
    setSaving(true)
    try {
      await patchProfile(body)
      setProfile(p => p ? { ...p, self_memo: memo, address } : p)
      setSaveMsg('저장되었습니다'); setTimeout(() => setSaveMsg(''), 2000)
      setEditMode(false); setShowPwSection(false)
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
    catch { } finally { setConnectLoading(false) }
  }

  const handleDischargeRequest = async () => {
    if (!window.confirm('담당 해제 요청을 보내시겠습니까?')) return
    setConnectLoading(true)
    try { await patientDischargeRequest(); const r = await getMyPendingRequest(); setPendingReq(r.request) }
    catch { } finally { setConnectLoading(false) }
  }

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: C.muted, fontSize: 14 }}>불러오는 중...</p></div>
  if (err || !profile) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: C.danger, fontSize: 14 }}>{err || '오류가 발생했습니다.'}</p></div>

  const age = calcAge(profile.birth_date)
  const genderLabel = profile.gender === 'm' ? '남성' : profile.gender === 'f' ? '여성' : null

  const selectSt: React.CSSProperties = {
    padding: '9px 12px', borderRadius: 9, border: `0.5px solid ${C.border}`,
    fontSize: 13, fontFamily: 'inherit', color: C.text, background: '#fff', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* ── 헤더 — 다른 환자 페이지와 동일한 스타일 */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        backgroundColor: 'var(--capd-primary)',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        zIndex: 100, boxShadow: '0 2px 8px rgba(123,107,181,0.25)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            color: '#fff', fontSize: 14, cursor: 'pointer',
            background: 'none', border: 'none', padding: '0 10px 0 0',
            display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
          }}
        >
          ← <span style={{ fontSize: 12 }}>뒤로</span>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>
            {profile.name}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginLeft: 6 }}>마이페이지</span>
        </div>
        <div style={{ width: 56 }} />
      </header>

      <main style={{
        paddingTop: 72,
        paddingBottom: 48,
        paddingLeft: isMobile ? 12 : 16,
        paddingRight: isMobile ? 12 : 16,
        maxWidth: 560,
        margin: '0 auto',
      }}>

        {/* ── 프로필 카드 */}
        <div style={card}>
          {/* 헤더 */}
          <div style={{ background: '#fafafa', padding: isMobile ? '14px 16px' : '18px 24px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: `0.5px solid ${C.border}` }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 500, color: C.primary, flexShrink: 0 }}>
              {profile.name[0]}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{profile.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>CAPD 환자{age !== null ? ` · 만 ${age}세` : ''}</div>
            </div>
            <button
              onClick={editMode ? cancelEdit : openEdit}
              style={{ marginLeft: 'auto', padding: '6px 14px', border: `0.5px solid ${editMode ? 'var(--capd-primary)' : C.border}`, borderRadius: 20, background: 'transparent', cursor: 'pointer', fontSize: 13, color: editMode ? 'var(--capd-primary)' : C.muted, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              {editMode ? '✕ 닫기' : '✏ 수정'}
            </button>
          </div>

          {/* 변경 불가 행 */}
          <div style={row}><span style={lbl}>이름</span><span style={editMode ? dim : val}>{profile.name}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
          <div style={row}><span style={lbl}>생년월일</span><span style={editMode ? dim : val}>{profile.birth_date ?? '—'}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
          <div style={row}><span style={lbl}>성별</span><span style={editMode ? dim : val}>{genderLabel ?? '—'}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
          <div style={row}><span style={lbl}>통원 병원</span><span style={editMode ? dim : val}>{profile.hospital_name ?? '—'}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>
          <div style={row}><span style={lbl}>전화번호</span><span style={editMode ? dim : val}>{formatPhone(profile.phone_number)}{editMode && <span style={{ fontSize: 11 }}> (변경 불가)</span>}</span></div>

          {/* 거주지 — 인플레이스 */}
          <div style={row}>
            <span style={lbl}>거주지</span>
            {editMode
              ? <input style={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="거주지 입력" />
              : <span style={address ? val : { ...val, color: C.light, fontWeight: 400 }}>{address || '—'}</span>
            }
          </div>

          {/* 나의 특이사항 — 인플레이스 */}
          <div style={{ ...row, alignItems: 'flex-start' }}>
            <span style={{ ...lbl, paddingTop: 12 }}>나의 특이사항</span>
            {editMode
              ? <textarea style={{ ...inp, margin: '6px 8px 6px 0', resize: 'none' } as React.CSSProperties} rows={2} value={memo} onChange={e => setMemo(e.target.value)} placeholder="담당 의사에게 공유됩니다" />
              : <span style={{ ...memo ? val : { ...val, color: C.light, fontWeight: 400 }, paddingTop: 12, paddingBottom: 12 }}>{memo || '—'}</span>
            }
          </div>

          {/* 비밀번호 변경 + 저장 영역 — 수정 모드에서만 */}
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
                  <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 20, background: saving ? '#e5e7eb' : 'var(--capd-primary)', color: saving ? C.muted : '#fff', fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 담당 의사 카드 */}
        <div style={card}>
          <div style={{ padding: '12px 24px', borderBottom: `0.5px solid ${C.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>담당 의사</span>
          </div>
          <div style={{ padding: isMobile ? '14px 16px' : '16px 24px' }}>
            {profile.doctor_name && !pendingReq && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 500, color: C.success, flexShrink: 0 }}>{profile.doctor_name[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{profile.doctor_name} 선생님</div>
                    {profile.doctor_hospital && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{profile.doctor_hospital}</div>}
                    {profile.doctor_phone && <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{formatPhone(profile.doctor_phone)}</div>}
                  </div>
                </div>
                <button onClick={handleDischargeRequest} disabled={connectLoading} style={{ width: '100%', padding: '9px', border: `0.5px solid #fca5a5`, borderRadius: 20, background: 'transparent', fontSize: 13, color: C.danger, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {connectLoading ? '처리 중...' : '담당 해제 요청'}
                </button>
              </>
            )}
            {pendingReq && (
              <>
                <div style={{ background: '#fffbeb', border: '0.5px solid #fcd34d', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                    {pendingReq.request_type === 'connect' ? '⏳ 연결 신청 대기 중' : '⏳ 해제 요청 대기 중'}
                  </div>
                  {pendingReq.doctor_name && <div style={{ fontSize: 13, color: C.text }}>의사: {pendingReq.doctor_name}</div>}
                </div>
                <button onClick={handleCancelRequest} disabled={connectLoading} style={{ width: '100%', padding: '9px', border: `0.5px solid ${C.border}`, borderRadius: 20, background: 'transparent', fontSize: 13, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {connectLoading ? '취소 중...' : '신청 취소'}
                </button>
              </>
            )}
            {!profile.doctor_name && !pendingReq && !connectMode && (
              <>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>담당 의사가 없습니다. 연결하면 기록 제출 및 AI 분석을 이용할 수 있습니다.</p>
                <button onClick={() => setConnectMode(true)} style={{ width: '100%', padding: '9px', border: `0.5px solid var(--capd-primary)`, borderRadius: 20, background: 'transparent', fontSize: 13, color: 'var(--capd-primary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  + 담당 의사 연결 신청
                </button>
              </>
            )}
            {connectMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <select value={selHospital} onChange={e => handleHospitalChange(Number(e.target.value) || '')} style={selectSt}>
                  <option value="">병원을 선택하세요</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <select value={selDoctor} onChange={e => setSelDoctor(Number(e.target.value) || '')} disabled={!selHospital} style={{ ...selectSt, opacity: !selHospital ? 0.6 : 1 }}>
                  <option value="">{selHospital ? '담당 의사를 선택하세요' : '먼저 병원을 선택하세요'}</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {connectError && <p style={{ margin: 0, fontSize: 12, color: C.danger }}>{connectError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setConnectMode(false); setConnectError('') }} style={{ flex: 1, padding: '9px', border: `0.5px solid ${C.border}`, borderRadius: 20, background: 'transparent', fontSize: 13, color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                  <button onClick={handleConnectRequest} disabled={connectLoading || !selDoctor} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 20, background: (connectLoading || !selDoctor) ? '#e5e7eb' : 'var(--capd-primary)', color: (connectLoading || !selDoctor) ? C.muted : '#fff', fontSize: 13, cursor: (connectLoading || !selDoctor) ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                    {connectLoading ? '신청 중...' : '연결 신청'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {saveMsg && (
          <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, zIndex: 999 }}>
            ✓ {saveMsg}
          </div>
        )}
      </main>
    </div>
  )
}
