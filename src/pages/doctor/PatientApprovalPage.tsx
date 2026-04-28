import React, { useEffect, useState, useCallback } from "react";
import {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
} from "../../api/auth";
import type { PatientRegistrationInfo } from "../../types";

const C = {
  primary:      'var(--capd-primary)',
  primaryLight: 'var(--capd-primary-light)',
  primaryDark:  'var(--capd-primary-dark)',
  bg:           'var(--capd-bg)',
  border:       'var(--capd-border)',
  text:         '#1a1a2e',
  textMuted:    '#6b7280',
  success:      '#16a34a',
  successLight: '#f0fdf4',
  warning:      '#d97706',
  warningLight: '#fffbeb',
  danger:       '#dc2626',
  dangerLight:  '#fef2f2',
}

interface DoneItem extends PatientRegistrationInfo {
  finalStatus: 'approved' | 'rejected'
}

/* ── Badge ── */
function Badge({ color, children }: { color: 'warning' | 'success' | 'danger'; children: React.ReactNode }) {
  const map = {
    warning: { bg: C.warningLight, text: C.warning },
    success: { bg: C.successLight, text: C.success },
    danger:  { bg: C.dangerLight,  text: C.danger  },
  }
  const { bg, text } = map[color]
  return (
    <span style={{
      background: bg, color: text,
      borderRadius: 6, padding: '3px 8px',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

/* ── Card ── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      padding: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── 버튼 ── */
function Btn({
  variant = 'primary', size = 'md', onClick, children, disabled,
}: {
  variant?: 'primary' | 'success' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  onClick?: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  const sizes   = { sm: { padding: '6px 12px', fontSize: 13 }, md: { padding: '10px 18px', fontSize: 14 } }
  const variants = {
    primary: { background: C.primary,      color: '#fff' },
    success: { background: C.successLight, color: C.success },
    danger:  { background: C.dangerLight,  color: C.danger  },
    ghost:   { background: 'transparent',  color: C.textMuted, border: `1px solid ${C.border}` },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, border: 'none', borderRadius: 10, fontFamily: 'inherit',
        fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s', letterSpacing: '-0.01em',
        ...sizes[size], ...variants[variant],
      }}
    >
      {children}
    </button>
  )
}

/* ── 메인 ── */
export default function PatientApprovalPage() {
  const [pending, setPending] = useState<PatientRegistrationInfo[]>([])
  const [done,    setDone]    = useState<DoneItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPendingRegistrations()
      setPending(data)
    } catch { /* 무시 */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  const handleApprove = async (reg: PatientRegistrationInfo) => {
    try {
      await approveRegistration(reg.id)
      setPending(prev => prev.filter(r => r.id !== reg.id))
      setDone(prev => [...prev, { ...reg, finalStatus: 'approved' }])
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '승인에 실패했습니다.')
    }
  }

  const handleReject = async (reg: PatientRegistrationInfo) => {
    const reason = prompt('거절 사유를 입력해주세요 (선택사항):') ?? undefined
    try {
      await rejectRegistration(reg.id, reason)
      setPending(prev => prev.filter(r => r.id !== reg.id))
      setDone(prev => [...prev, { ...reg, finalStatus: 'rejected' }])
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? '거절에 실패했습니다.')
    }
  }

  const approvedCount = done.filter(d => d.finalStatus === 'approved').length
  const rejectedCount = done.filter(d => d.finalStatus === 'rejected').length

  return (
    <main style={{ padding: 32 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: '-0.04em' }}>
          담당 연결 관리
        </h1>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        {([
          ['승인 대기', pending.length, C.warning],
          ['승인 완료', approvedCount,  C.success],
          ['거절',      rejectedCount,  C.danger ],
        ] as const).map(([label, val, col]) => (
          <div key={label} style={{
            flex: 1, background: '#fff',
            borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: col }}>
              {val}
              <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 500 }}>명</span>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <p style={{ color: C.textMuted, fontSize: 13 }}>불러오는 중...</p>
      )}

      {/* 승인 대기 목록 */}
      {!loading && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 12 }}>승인 대기</div>
          {pending.length === 0 ? (
            <Card style={{ padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
              대기 중인 요청이 없습니다.
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(reg => (
                <Card key={reg.id} style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{reg.name}</span>
                        <Badge color="warning">대기 중</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8 }}>
                        생년월일: {reg.birth_date}
                        {reg.hospital_name ? ` · ${reg.hospital_name}` : ''}
                        <br />
                        신청일: {new Date(reg.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Btn size="sm" variant="success" onClick={() => handleApprove(reg)}>✅ 승인</Btn>
                      <Btn size="sm" variant="danger"  onClick={() => handleReject(reg)}>❌ 거절</Btn>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 처리 완료 목록 */}
      {done.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 12 }}>처리 완료</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {done.map(item => (
              <Card key={item.id} style={{ padding: '14px 20px', opacity: 0.75 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text, marginRight: 10 }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      {item.birth_date}{item.hospital_name ? ` · ${item.hospital_name}` : ''}
                    </span>
                  </div>
                  <Badge color={item.finalStatus === 'approved' ? 'success' : 'danger'}>
                    {item.finalStatus === 'approved' ? '✅ 승인 완료' : '❌ 거절'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
