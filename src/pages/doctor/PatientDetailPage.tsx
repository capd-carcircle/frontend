/**
 * PatientDetailPage — 의사용 환자 상세 페이지
 * 경로: /doctor/patients/:patientId
 *
 * 구성
 * - 환자 기본 정보 (이름/생년월일/전화/병원/담당의/가입일)
 * - 환자 본인 메모 (읽기 전용)
 * - 의사 메모 (작성/수정 가능, 환자에게 비공개)
 * - 기록 전체 보기 버튼
 */
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  success:      '#16a34a',
  successLight: '#f0fdf4',
  danger:       '#dc2626',
  dangerLight:  '#fef2f2',
  warning:      '#d97706',
}

interface PatientProfile {
  id:            number
  name:          string
  phone_number:  string
  birth_date:    string | null
  hospital_name: string | null
  doctor_name:   string | null
  self_memo:     string | null
  joined_at:     string | null
}

function formatDate(str: string | null) {
  if (!str) return '—'
  const d = new Date(str)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ minWidth: 90, fontSize: 13, color: C.textMuted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text }}>{value || '—'}</span>
    </div>
  )
}

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate      = useNavigate()

  const [profile,  setProfile]  = useState<PatientProfile | null>(null)
  const [note,     setNote]     = useState('')
  const [origNote, setOrigNote] = useState('')
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  const token = () => localStorage.getItem('access_token') ?? ''

  useEffect(() => {
    if (!patientId) return
    const t = token()
    if (!t) { navigate('/login'); return }

    setLoading(true)
    Promise.all([
      fetch(`${API}/api/v1/patients/${patientId}/profile`, {
        headers: { Authorization: `Bearer ${t}` },
      }).then(r => { if (!r.ok) throw new Error('프로필 오류'); return r.json() }),
      fetch(`${API}/api/v1/patients/${patientId}/note`, {
        headers: { Authorization: `Bearer ${t}` },
      }).then(r => { if (!r.ok) throw new Error('메모 오류'); return r.json() }),
    ])
      .then(([profileData, noteData]) => {
        setProfile(profileData)
        const c = noteData.content ?? ''
        setNote(c)
        setOrigNote(c)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [patientId, navigate])

  const handleSaveNote = async () => {
    if (!patientId) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/v1/patients/${patientId}/note`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note }),
      })
      if (!res.ok) throw new Error('저장 실패')
      setOrigNote(note)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 32, color: C.textMuted, fontSize: 13 }}>불러오는 중...</div>
  if (error)   return <div style={{ padding: 32, color: C.danger, fontSize: 13 }}>오류: {error}</div>
  if (!profile) return null

  const noteChanged = note !== origNote

  return (
    <div style={{ padding: '24px 28px', maxWidth: 720, margin: '0 auto' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '6px 14px', cursor: 'pointer', fontSize: 13,
            color: C.textMuted, fontFamily: 'inherit',
          }}
        >
          ← 뒤로
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text, letterSpacing: '-0.03em' }}>
            {profile.name} 환자
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: C.textMuted, marginTop: 2 }}>환자 상세 정보</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => navigate(`/doctor/patients/${patientId}/records`, { state: { patientName: profile.name } })}
            style={{
              background: C.primary, color: '#fff', border: 'none',
              borderRadius: 9, padding: '9px 18px', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            기록 전체 보기 →
          </button>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>기본 정보</h2>
        <InfoRow label="이름"     value={profile.name} />
        <InfoRow label="생년월일"  value={profile.birth_date ? formatDate(profile.birth_date + 'T00:00:00') : null} />
        <InfoRow label="전화번호"  value={profile.phone_number} />
        <InfoRow label="소속 병원" value={profile.hospital_name} />
        <InfoRow label="담당 의사" value={profile.doctor_name} />
        <InfoRow label="가입일"    value={profile.joined_at ? formatDate(profile.joined_at) : null} />
      </div>

      {/* 환자 본인 메모 */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
          환자 본인 메모
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: C.textMuted }}>환자가 직접 작성한 특이사항</span>
        </h2>
        {profile.self_memo ? (
          <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {profile.self_memo}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, fontStyle: 'italic' }}>작성된 메모가 없습니다.</p>
        )}
      </div>

      {/* 의사 메모 */}
      <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
              의사 메모
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textMuted }}>환자에게 공개되지 않는 임상 메모 · AI 질문 생성에 활용됩니다</p>
          </div>
          <button
            onClick={handleSaveNote}
            disabled={saving || !noteChanged}
            style={{
              background: saved ? C.success : noteChanged ? C.primary : '#e5e7eb',
              color: noteChanged || saved ? '#fff' : C.textMuted,
              border: 'none', borderRadius: 8, padding: '7px 16px',
              cursor: noteChanged ? 'pointer' : 'default',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
          </button>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="이 환자에 대한 임상 메모를 입력하세요. (예: 투석 시 복통 자주 호소, 복막염 이력 있음)"
          rows={5}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: `1.5px solid ${noteChanged ? C.primary : C.border}`,
            fontSize: 13, fontFamily: 'inherit', color: C.text,
            resize: 'vertical', outline: 'none',
            background: '#fafafa', lineHeight: 1.7,
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
        />
      </div>
    </div>
  )
}
