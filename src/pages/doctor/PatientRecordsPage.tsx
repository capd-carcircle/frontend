import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { btn, card, COLOR, STATUS_MAP, table, typography } from "../../styles/doctor";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

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
  const s = STATUS_MAP[status] ?? { label: status, color: COLOR.gray };
  return <span style={{ color: s.color, fontWeight: 700, fontSize: 12 }}>{s.label}</span>;
}

/* ── 날짜 포맷 ────────────────────────────────────────── */
function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

function formatTime(isoStr: string | null) {
  if (!isoStr) return "-";
  return new Date(isoStr).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/* ── 월별 그룹핑 ──────────────────────────────────────── */
function groupByMonth(records: PatientRecordRow[]): Map<string, PatientRecordRow[]> {
  const map = new Map<string, PatientRecordRow[]>();
  for (const r of records) {
    const key = r.record_date.slice(0, 7); // YYYY-MM
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
  const passedName     = (location.state as { patientName?: string } | null)?.patientName ?? "";

  const [data,    setData]    = useState<PatientRecordsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // 현재 달을 기본으로 펼침
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
          // 가장 최신 달 자동 펼침
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

  const patientName = data?.patient_name ?? passedName;

  if (loading) return <div style={{ padding: 24, color: COLOR.textMuted, fontSize: 13 }}>불러오는 중...</div>;
  if (error)   return <div style={{ padding: 24, color: COLOR.danger,    fontSize: 13 }}>오류: {error}</div>;

  const grouped = data ? groupByMonth(data.records) : new Map();
  const totalCount = data?.records.length ?? 0;

  return (
    <>
      <style>{`
        .view-btn:hover         { background-color: #1b508a !important; }
        .month-header:hover     { background-color: #e8ecf4 !important; }
      `}</style>

      <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            className="back-btn"
            style={btn.ghost}
            onClick={() => navigate("/doctor")}
          >
            ← 대시보드
          </button>
          <div>
            <h1 style={typography.pageTitle}>{patientName} 환자</h1>
            <p style={typography.pageSubtitle}>전체 기록 {totalCount}건</p>
          </div>
        </div>

        {/* 기록 없음 */}
        {totalCount === 0 && (
          <div style={{ ...card.base, textAlign: "center", color: COLOR.textMuted, fontSize: 13, padding: 40 }}>
            아직 제출된 기록이 없습니다.
          </div>
        )}

        {/* 월별 그룹 목록 */}
        {Array.from(grouped.entries()).map(([monthKey, rows]) => (
          <div key={monthKey} style={{ ...card.base, padding: 0, overflow: "hidden", marginBottom: 12 }}>

            {/* 월 헤더 (접기/펼치기) */}
            <button
              className="month-header"
              onClick={() => toggleMonth(monthKey)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                border: "none",
                backgroundColor: COLOR.grayBg,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.text }}>
                {monthLabel(monthKey)}
              </span>
              <span style={{ fontSize: 11, color: COLOR.textMuted }}>
                {rows.length}건 {openMonths.has(monthKey) ? "▾" : "▸"}
              </span>
            </button>

            {/* 기록 테이블 */}
            {openMonths.has(monthKey) && (
              <table style={table.root}>
                <thead>
                  <tr>
                    {["날짜", "제출 시간", "상태", ""].map((h) => (
                      <th key={h} style={table.thGray}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.record_id} style={idx % 2 === 0 ? table.rowEven : table.rowOdd}>
                      <td style={table.tdNormal}>{formatDate(row.record_date)}</td>
                      <td style={table.tdNormal}>{formatTime(row.submitted_at)}</td>
                      <td style={table.tdNormal}><StatusBadge status={row.status} /></td>
                      <td style={table.tdNormal}>
                        <button
                          className="view-btn"
                          style={btn.primary}
                          onClick={() =>
                            navigate("/doctor/record", {
                              state: { recordId: row.record_id, patientName },
                            })
                          }
                        >
                          상세 보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </main>
    </>
  );
}
