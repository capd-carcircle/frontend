import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  submitRecord,
  updateRecord,
  getMyRecords,
  DailyRecordCreate,
  DailyRecordResponse,
  DailyRecordUpdate,
} from '../../api/records'
import RecordForm from '../../components/patient/RecordForm'

const todayStr = (): string => new Date().toISOString().split('T')[0]

const getKoreanDate = (): string => {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

const STATUS_LABEL: Record<string, string> = {
  submitted: '검토 대기 중',
  reviewed:  '검토 완료',
  rejected:  '반려',
}
const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  submitted: { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6' },
  reviewed:  { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
  rejected:  { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
}

function Badge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      backgroundColor: c.bg, color: c.text,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: c.dot, flexShrink: 0 }} />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function RecordSubmitPage() {
  const navigate = useNavigate()

  const [checkLoading, setCheckLoading]   = useState(true)
  const [todayRecord, setTodayRecord]     = useState<DailyRecordResponse | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [isEditing, setIsEditing]         = useState(false)

  /* ── 오늘 기록 확인 ─────────────────────────────────────────── */
  useEffect(() => {
    const check = async () => {
      try {
        const records = await getMyRecords()
        const existing = records.find((r) => r.record_date === todayStr()) ?? null
        setTodayRecord(existing)
      } catch {
        // 실패 시 빈 폼 표시
      } finally {
        setCheckLoading(false)
      }
    }
    check()
  }, [])

  /* ── 신규 제출 ──────────────────────────────────────────────── */
  const handleSubmit = async (data: DailyRecordCreate) => {
    setSubmitLoading(true)
    setError(null)
    try {
      const record = await submitRecord(data)
      navigate('/patient/survey', { state: { recordId: record.id } })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        '제출에 실패했습니다.'
      setError(msg)
    } finally {
      setSubmitLoading(false)
    }
  }

  /* ── 수정 저장 ──────────────────────────────────────────────── */
  const handleUpdate = async (data: DailyRecordCreate) => {
    if (!todayRecord) return
    setSubmitLoading(true)
    setError(null)
    try {
      const payload: DailyRecordUpdate = {
        turbid_peritoneal:     data.turbid_peritoneal,
        weight:                data.weight,
        blood_pressure:        data.blood_pressure,
        urine_count:           data.urine_count,
        total_ultrafiltration: data.total_ultrafiltration,
        fasting_blood_glucose: data.fasting_blood_glucose,
        memo:                  data.memo,
        exchange_records:      data.exchange_records,
      }
      const updated = await updateRecord(todayRecord.id, payload)
      setTodayRecord(updated)
      setIsEditing(false)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        '수정에 실패했습니다.'
      setError(msg)
    } finally {
      setSubmitLoading(false)
    }
  }

  /* ── 공통 헤더 ──────────────────────────────────────────────── */
  const Header = () => (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 56,
      backgroundColor: '#1b508a',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      zIndex: 100,
      boxShadow: '0 2px 8px rgba(27,80,138,0.25)',
    }}>
      <button
        style={{
          color: '#fff', fontSize: 14, cursor: 'pointer',
          background: 'none', border: 'none', padding: '0 10px 0 0',
          display: 'flex', alignItems: 'center', gap: 4,
          fontFamily: 'inherit',
        }}
        onClick={() => navigate('/patient')}
      >
        ← <span style={{ fontSize: 12 }}>목록</span>
      </button>
      <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px', flex: 1, textAlign: 'center' }}>오늘 기록</span>
      <div style={{ width: 56 }} />
    </header>
  )

  /* ── 로딩 중 ────────────────────────────────────────────────── */
  if (checkLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa' }}>
        <Header />
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '80px 16px 40px', textAlign: 'center' }}>
          <div style={{ paddingTop: 60 }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>⏳ 불러오는 중...</p>
          </div>
        </main>
      </div>
    )
  }

  /* ── 메인 렌더 ──────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f6fa' }}>
      <Header />

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 48px' }}>

        {/* ── 날짜 / 상태 정보 카드 ── */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 14,
          padding: '16px 14px', marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          border: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
                {getKoreanDate()}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                {todayRecord && !isEditing
                  ? '오늘 기록이 이미 제출되었습니다.'
                  : isEditing
                  ? '기록을 수정하고 저장해 주세요.'
                  : '오늘의 CAPD 투석 기록을 입력해 주세요.'}
              </p>
            </div>
            {todayRecord && <Badge status={todayRecord.status} />}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              backgroundColor: '#fef2f2', borderRadius: 8,
              border: '1px solid #fecaca',
              fontSize: 13, color: '#dc2626',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* ── 오늘 기록 있을 때: 액션 버튼 행 ── */}
        {todayRecord && !isEditing && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              style={{
                flex: 1, padding: '12px 18px',
                backgroundColor: '#1b508a', color: '#fff',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                minWidth: 140,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              onClick={() => navigate('/patient/survey', { state: { recordId: todayRecord.id } })}
            >
              후속 설문 답변하기 →
            </button>
            {todayRecord.status === 'submitted' && (
              <button
                style={{
                  padding: '12px 18px',
                  backgroundColor: '#fff', color: '#1b508a',
                  border: '1.5px solid #1b508a', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#eff6ff' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff' }}
                onClick={() => setIsEditing(true)}
              >
                수정하기
              </button>
            )}
          </div>
        )}

        {/* ── 수정 모드일 때: 취소 버튼 ── */}
        {todayRecord && isEditing && (
          <button
            style={{
              marginBottom: 14, padding: '8px 16px',
              backgroundColor: 'transparent', color: '#6b7280',
              border: '1px solid #d1d5db', borderRadius: 8,
              fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onClick={() => { setIsEditing(false); setError(null) }}
          >
            ← 수정 취소
          </button>
        )}

        {/* 폼 */}
        <RecordForm
          onSubmit={todayRecord ? handleUpdate : handleSubmit}
          isLoading={submitLoading}
          initialData={todayRecord ?? undefined}
          isEditing={isEditing}
        />
      </main>
    </div>
  )
}
