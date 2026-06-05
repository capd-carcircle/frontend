import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { calcAge, patientLabel } from '../../utils/helpers';

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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
  successLight: '#f0fdf4',
  warning:      '#d97706',
  warningLight: '#fffbeb',
  danger:       '#dc2626',
  dangerLight:  '#fef2f2',
  white:        '#ffffff',
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "미검토",    color: C.danger,   bg: C.dangerLight  },
  reviewed:  { label: "승인 완료", color: C.success,  bg: C.successLight },
  rejected:  { label: "반려",      color: C.textMuted, bg: '#f3f4f6'     },
  draft:     { label: "임시저장",  color: C.warning,  bg: C.warningLight },
}

/* ── 타입 ─────────────────────────────────────────────── */
interface PatientRecordRow {
  record_id:    number;
  record_date:  string;
  submitted_at: string | null;
  status:       string;
}

interface PatientRecordsResponse {
  patient_id:   number;
  patient_name: string;
  records:      PatientRecordRow[];
}

/* ── 상태 배지 ────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? { label: status, color: C.textMuted, bg: '#f3f4f6' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
      color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`,
      display: 'inline-block',
    }}>
      {s.label}
    </span>
  );
}

/* ── 날짜 포맷 ────────────────────────────────────────── */
function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatTime(isoStr: string | null) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/* ── 월별 그룹핑 ──────────────────────────────────────── */
function groupByMonth(records: PatientRecordRow[]): Map<string, PatientRecordRow[]> {
  const map = new Map<string, PatientRecordRow[]>();
  for (const r of records) {
    const key = r.record_date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function monthLabel(key: string) {
  const [yyyy, mm] = key.split("-");
  return `${yyyy}년 ${parseInt(mm, 10)}월`;
}

/* ── 나이/성별 포맷 ───────────────────────────────────── */

/* ── 메인 ─────────────────────────────────────────────── */
export default function PatientRecordsPage() {
  const { patientId }  = useParams<{ patientId: string }>();
  const navigate       = useNavigate();
  const location       = useLocation();
  const locState       = location.state as { patientName?: string; patientBirthDate?: string | null; patientGender?: string | null } | null;
  const passedName     = locState?.patientName ?? "";
  const passedBirth    = locState?.patientBirthDate ?? null;
  const passedGender   = locState?.patientGender ?? null;

  const [data,    setData]    = useState<PatientRecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const thisMonth = new Date().toISOString().slice(0, 7);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set([thisMonth]));

  useEffect(() => {
    if (!patientId) return;
    const token = localStorage.getItem("access_token");
    if (!token) { navigate("/login"); return; }

    setLoading(true);
    fetch(`${API}/api/v1/patients/${patientId}/records`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) { localStorage.clear(); navigate("/login"); return null; }
        if (!res.ok) throw new Error("서버 오류");
        return res.json();
      })
      .then((json: PatientRecordsResponse | null) => {
        if (json) {
          setData(json);
          if (json.records.length > 0) {
            const latestMonth = json.records[0].record_date.slice(0, 7);
            setOpenMonths(new Set([latestMonth]));
          }
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId, navigate]);

  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const patientName  = data?.patient_name ?? passedName;
  const displayName  = patientLabel(patientName, passedBirth, passedGender);
  const totalCount   = data?.records.length ?? 0;
  const grouped      = data ? groupByMonth(data.records) : new Map();

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: C.textMuted, fontSize: 13 }}>
      불러오는 중...
    </div>
  );
  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: C.danger, fontSize: 13 }}>
      오류: {error}
    </div>
  );

  return (
    <main style={{
      flex: 1, overflowY: "auto",
      padding: 24,
      display: 'flex', flexDirection: 'column', gap: 16,
      background: C.bg,
    }}>
      {/* ── 헤더 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: "8px 14px", borderRadius: 8,
            border: `1.5px solid ${C.border}`, background: C.white,
            color: C.text, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = C.white)}
        >
          ← 뒤로
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>
            {displayName} 환자
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '3px 0 0' }}>
            전체 기록 {totalCount}건
          </p>
        </div>
      </div>

      {/* ── 기록 없음 ── */}
      {totalCount === 0 && (
        <div style={{
          background: C.white, borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          textAlign: "center", color: C.textMuted, fontSize: 13, padding: 48,
        }}>
          아직 제출된 기록이 없습니다.
        </div>
      )}

      {/* ── 월별 그룹 ── */}
      {Array.from(grouped.entries()).map(([monthKey, rows]) => {
        const isOpen = openMonths.has(monthKey);
        return (
          <div key={monthKey} style={{
            background: C.white, borderRadius: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            overflow: "hidden",
          }}>
            {/* 월 헤더 */}
            <button
              onClick={() => toggleMonth(monthKey)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "13px 20px",
                border: "none", borderBottom: isOpen ? `1px solid ${C.border}` : 'none',
                background: isOpen ? C.primaryLight : C.bg,
                cursor: "pointer", fontFamily: "inherit",
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryLight)}
              onMouseLeave={(e) => (e.currentTarget.style.background = isOpen ? C.primaryLight : C.bg)}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: isOpen ? C.primaryDark : C.text }}>
                {monthLabel(monthKey)}
              </span>
              <span style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  background: isOpen ? C.primary : '#e5e7eb',
                  color: isOpen ? C.white : C.textMuted,
                  fontSize: 11, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 99,
                }}>
                  {rows.length}건
                </span>
                <span style={{ fontSize: 13, color: C.textMuted }}>{isOpen ? '▾' : '▸'}</span>
              </span>
            </button>

            {/* 기록 목록 */}
            {isOpen && (
              <div>
                {/* 테이블 헤더 */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 110px 100px',
                  padding: '8px 20px',
                  background: C.bg,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  {['날짜', '제출 시간', '상태', ''].map((h, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 700, color: C.textMuted,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      textAlign: i >= 2 ? 'center' : 'left',
                    }}>{h}</span>
                  ))}
                </div>

                {/* 행 */}
                {rows.map((row, idx) => (
                  <div key={row.record_id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 110px 100px',
                    padding: '12px 20px',
                    background: idx % 2 === 0 ? C.white : C.bg,
                    borderBottom: idx < rows.length - 1 ? `1px solid ${C.border}` : 'none',
                    alignItems: 'center',
                    transition: 'background 0.1s',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryLight)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? C.white : C.bg)}
                  >
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                      {formatDate(row.record_date)}
                    </span>
                    <span style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
                      {formatTime(row.submitted_at)}
                    </span>
                    <div style={{ textAlign: 'center' }}>
                      <StatusBadge status={row.status} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => navigate("/doctor/record", {
                          state: { recordId: row.record_id, patientName, patientBirthDate: passedBirth, patientGender: passedGender },
                        })}
                        style={{
                          padding: "6px 14px", borderRadius: 8, border: "none",
                          background: C.primary, color: C.white,
                          fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryDark)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
                      >
                        상세 보기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
