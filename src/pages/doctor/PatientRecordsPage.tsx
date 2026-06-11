import useAuthStore from '../../store/authStore'
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { calcAge, patientLabel } from '../../utils/helpers';
import { apiFetch } from '../../api/apiFetch';

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

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  submitted: { label: "미검토",    color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' },
  reviewed:  { label: "승인 완료", color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  rejected:  { label: "반려",      color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
  draft:     { label: "기록 중",   color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
}

const RISK_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent:  { label: "긴급", color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  caution: { label: "주의", color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  normal:  { label: "정상", color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
}

/* ── 타입 ─────────────────────────────────────────────── */
interface PatientRecordRow {
  record_id:    number;
  record_date:  string;
  submitted_at: string | null;
  status:       string;
  risk_level:   string | null;
}

interface PatientRecordsResponse {
  patient_id:   number;
  patient_name: string;
  birth_date:   string | null;
  gender:       string | null;
  phone_number: string | null;
  records:      PatientRecordRow[];
}

/* ── 배지 ────────────────────────────────────────────── */
function Badge({ cfg }: { cfg: { label: string; color: string; bg: string; border: string } }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
      color: cfg.color, background: cfg.bg, border: `0.5px solid ${cfg.border}`,
      display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set([thisMonth]));

  useEffect(() => {
    if (!patientId) return;
    const token = localStorage.getItem("access_token");
    if (!token) { navigate("/login"); return; }

    setLoading(true);
    apiFetch(`${API}/api/v1/patients/${patientId}/records`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) { useAuthStore.getState().logout(); navigate("/login"); return null; }
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
  const birthDate    = data?.birth_date ?? passedBirth;
  const genderRaw    = data?.gender ?? passedGender;
  const phoneNumber  = data?.phone_number ?? null;
  const displayName  = patientLabel(patientName, birthDate, genderRaw);
  const totalCount   = data?.records.length ?? 0;
  const grouped      = data ? groupByMonth(data.records) : new Map();

  const age    = birthDate ? calcAge(birthDate) : null;
  const gender = genderRaw === 'male' ? '남성' : genderRaw === 'female' ? '여성' : null;

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

  /* 그리드: 날짜+제출시각 | 위험도 | 검토 상태 */
  const COLS = '1fr 80px 100px';
  const HEADERS = ['날짜 · 제출 시각', '위험도', '검토 상태'];

  return (
    <main style={{
      flex: 1, overflowY: "auto",
      padding: isMobile ? '16px' : '28px 32px',
      display: 'flex', flexDirection: 'column', gap: 16,
      background: C.bg,
    }}>
      {/* ── 헤더 ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.04em' }}>
            {displayName} 환자
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted, margin: '3px 0 0' }}>
            전체 기록 {totalCount}건
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: "6px 16px", borderRadius: 20,
            border: `0.5px solid ${C.border}`, background: C.white,
            color: C.textMuted, fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.white; e.currentTarget.style.color = C.textMuted }}
        >
          ← 뒤로
        </button>
      </div>

      {/* ── 환자 정보 카드 ── */}
      <div style={{
        background: C.white, borderRadius: 12, border: `0.5px solid ${C.border}`,
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: C.primary, flexShrink: 0 }}>
          {patientName[0] ?? '?'}
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap' }}>
          {[
            { label: '이름',     value: patientName || '—' },
            { label: '만 나이',  value: age !== null ? `만 ${age}세` : '—' },
            { label: '성별',     value: gender ?? '—' },
            { label: '생년월일', value: birthDate ?? '—' },
            { label: '연락처',   value: phoneNumber ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</div>
            </div>
          ))}
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  display: 'grid', gridTemplateColumns: COLS,
                  padding: '8px 20px',
                  background: C.bg,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  {HEADERS.map((h, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 700, color: C.textMuted,
                      letterSpacing: '0.02em',
                    }}>{h}</span>
                  ))}
                </div>

                {/* 행 */}
                {rows.map((row, idx) => {
                  const riskCfg = row.risk_level ? RISK_CFG[row.risk_level] : null;
                  const statusCfg = STATUS_CFG[row.status] ?? { label: row.status, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' };
                  return (
                    <div
                      key={row.record_id}
                      onClick={() => navigate(`/doctor/records/${row.record_id}`, {
                        state: { recordId: row.record_id, patientName, patientBirthDate: birthDate, patientGender: genderRaw },
                      })}
                      style={{
                        display: 'grid', gridTemplateColumns: COLS,
                        padding: '12px 20px',
                        background: idx % 2 === 0 ? C.white : C.bg,
                        borderBottom: idx < rows.length - 1 ? `1px solid ${C.border}` : 'none',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.primaryLight)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? C.white : C.bg)}
                    >
                      {/* 날짜 · 제출 시각 (같은 셀) */}
                      <div>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                          {formatDate(row.record_date)}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          {formatTime(row.submitted_at)}
                        </div>
                      </div>

                      {/* 위험도 */}
                      <div>
                        {riskCfg
                          ? <Badge cfg={riskCfg} />
                          : <span style={{ fontSize: 12, color: C.textLight }}>—</span>
                        }
                      </div>

                      {/* 검토 상태 */}
                      <div>
                        <Badge cfg={statusCfg} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}
