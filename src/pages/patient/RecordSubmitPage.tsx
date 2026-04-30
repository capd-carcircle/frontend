import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../hooks/useToast'
import {
  submitRecord,
  updateRecord,
  finalizeRecord,
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
  draft:     '작성 중',
  submitted: '검토 대기 중',
  reviewed:  '검토 완료',
  rejected:  '반려',
}
const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  draft:     { bg: '#f0ebff', text: '#7c3aed', dot: '#9b72e8' },
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
  const [draftLoading, setDraftLoading]   = useState(false)
  const [finalLoading, setFinalLoading]   = useState(false)
  const saveToast = useToast(2500)
  const [error, setError]                 = useState<string | null>(null)

  /* ── 오늘 기록 확인 (없으면 가장 최근 draft도 검색) ─────────── */
  useEffect(() => {
    const check = async () => {
      try {
        const records = await getMyRecords()
        // 오늘 기록 우선, 없으면 가장 최근 draft (날짜 무관)
        const todayRec = records.find((r) => r.record_date === todayStr()) ?? null
        if (todayRec) {
          setTodayRecord(todayRec)
        } else {
          const recentDraft = records
            .filter((r) => r.status === 'draft')
            .sort((a, b) => b.id - a.id)[0] ?? null
          setTodayRecord(recentDraft)
        }
      } catch {
        // 실패 시 빈 폼 표시
      } finally {
        setCheckLoading(false)
      }
    }
    check()
  }, [])

  /* ── 오늘 기록 저장 (임시저장) ──────────────────────────────── */
  const handleDraftSave = async (data: DailyRecordCreate) => {
    setDraftLoading(true)
    setError(null)
    saveToast.hide()
    try {
      if (todayRecord) {
        // 기존 기록 업데이트
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
      } else {
        // 신규 생성 (draft 상태)
        const record = await submitRecord(data)
        setTodayRecord(record)
      }
      saveToast.show('저장되었습니다.')
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        '저장에 실패했습니다.'
      setError(msg)
    } finally {
      setDraftLoading(false)
    }
  }

  /* ── 최종 제출 ──────────────────────────────────────────────── */
  const handleFinalSubmit = async (data: DailyRecordCreate) => {
    setFinalLoading(true)
    setError(null)
    try {
      let recordId: number

      if (todayRecord) {
        // 기존 기록 먼저 업데이트 후 finalize
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
        await updateRecord(todayRecord.id, payload)
        recordId = todayRecord.id
      } else {
        // 신규 생성
        const record = await submitRecord(data)
        recordId = record.id
      }

      // draft → submitted (AI 질문 생성 트리거)
      await finalizeRecord(recordId)
      navigate('/patient/survey', { state: { recordId } })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        '제출에 실패했습니다.'
      setError(msg)
    } finally {
      setFinalLoading(false)
    }
  }

  /* ── 공통 헤더 ──────────────────────────────────────────────── */
  const Header = () => (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 56,
      backgroundColor: 'var(--capd-primary)',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      zIndex: 100,
      boxShadow: '0 2px 12px rgba(124,58,237,0.25)',
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
      <div style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/patient')}>
        <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>{localStorage.getItem('user_name') ?? ''}</span>
        <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginLeft: 6 }}>기록 작성</span>
      </div>
      <div style={{ width: 56 }} />
    </header>
  )

  /* ── 로딩 중 ────────────────────────────────────────────────── */
  if (checkLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--capd-bg)' }}>
        <Header />
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '80px 16px 40px', textAlign: 'center' }}>
          <div style={{ paddingTop: 60 }}>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>⏳ 불러오는 중...</p>
          </div>
        </main>
      </div>
    )
  }

  /* ── 이미 최종 제출된 기록: 읽기 전용 뷰 ──────────────────── */
  const isSubmitted = todayRecord && todayRecord.status !== 'draft'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--capd-bg)' }}>
      <Header />

      <main style={{ maxWidth: 680, margin: '0 auto', padding: '72px 16px 48px' }}>

        {/* ── 날짜 / 상태 정보 카드 ── */}
        <div style={{
          backgroundColor: '#fff', borderRadius: 14,
          padding: '16px 14px', marginBottom: 16,
          boxShadow: '0 2px 8px rgba(124,58,237,0.08)',
          border: '1px solid var(--capd-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
                {getKoreanDate()}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                {isSubmitted
                  ? '최종 제출된 기록입니다.'
                  : todayRecord && todayRecord.record_date !== todayStr()
                  ? `${todayRecord.record_date} 저장된 기록을 이어서 작성 중입니다.`
                  : todayRecord
                  ? '이어서 기록을 입력하고 최종 제출해 주세요.'
                  : '오늘의 CAPD 투석 기록을 입력해 주세요.'}
              </p>
            </div>
            {todayRecord && <Badge status={todayRecord.status} />}
          </div>

          {/* 저장 성공 메시지 */}
          {saveToast.message && (
            <div style={{
              marginTop: 12, padding: '9px 14px',
              backgroundColor: '#f0fdf4', borderRadius: 8,
              border: '1px solid #bbf7d0',
              fontSize: 13, color: 'var(--success)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ✓ 오늘 기록이 저장되었습니다. 나중에 이어서 입력할 수 있어요.
            </div>
          )}

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

        {/* ── 최종 제출 후: 설문 버튼 ── */}
        {isSubmitted && (
          <div style={{ marginBottom: 16 }}>
            <button
              style={{
                width: '100%', padding: '13px 18px',
                backgroundColor: 'var(--capd-primary)', color: '#fff',
                border: 'none', borderRadius: 11,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                transition: 'opacity 0.15s', fontFamily: 'inherit',
              }}
              className="capd-btn-hover"
              onClick={() => navigate('/patient/survey', { state: { recordId: todayRecord!.id } })}
            >
              후속 설문 답변하기 →
            </button>
          </div>
        )}

        {/* 폼 */}
        <RecordForm
          onDraftSave={handleDraftSave}
          onFinalSubmit={handleFinalSubmit}
          isDraftLoading={draftLoading}
          isFinalLoading={finalLoading}
          initialData={todayRecord ?? undefined}
          isReadOnly={!!isSubmitted}
        />
      </main>
    </div>
  )
}
