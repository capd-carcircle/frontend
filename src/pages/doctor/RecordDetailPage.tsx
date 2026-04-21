import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { btn, card, COLOR, contentBox, table, typography } from "../../styles/doctor";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/* ── 타입 ─────────────────────────────────────────────── */
interface ExchangeRecord {
  session_number:         number;
  exchange_time:          string | null;
  drainage_volume:        number | null;
  infusion_concentration: number | null;
  infusion_weight:        number | null;
  ultrafiltration:        number | null;
}

interface SurveyResponse {
  question_type: string;
  question_text: string;
  reason:        string | null;
  choice:        string | null;
  text_answer:   string | null;
}

interface EMR {
  S: string;
  O: string;
  A: string;
  P: string;
}

interface RecordDetail {
  record_id:             number;
  patient_name:          string;
  record_date:           string;
  submitted_at:          string;
  status:                string;
  turbid_peritoneal:     boolean;
  weight:                number | null;
  blood_pressure:        string | null;
  urine_count:           number | null;
  total_ultrafiltration: number | null;
  fasting_blood_glucose: number | null;
  memo:                  string | null;
  exchange_records:      ExchangeRecord[];
  survey_responses:      SurveyResponse[];
  ai_summary:            string;
  emr:                   EMR;
}

/* ── 교환 기록 테이블 ─────────────────────────────────── */
const EXCHANGE_ROWS = [
  { label: "교환 시간",       key: "exchange_time"          },
  { label: "배액량 (g)",      key: "drainage_volume"        },
  { label: "투석액 농도 (%)", key: "infusion_concentration" },
  { label: "주입액 (g)",      key: "infusion_weight"        },
  { label: "한외여과 (g)",    key: "ultrafiltration"        },
] as const;

function ExchangeTable({ exchanges }: { exchanges: ExchangeRecord[] }) {
  const bySession: Record<number, ExchangeRecord> = {};
  exchanges.forEach((e) => { bySession[e.session_number] = e; });

  return (
    <table style={table.root}>
      <thead>
        <tr>
          <th style={table.thDark}>구분</th>
          {[1, 2, 3, 4, 5].map((n) => (
            <th key={n} style={table.thLight}>{n}회차</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {EXCHANGE_ROWS.map((row, ri) => (
          <tr key={row.key}>
            <td style={table.tdLabel}>{row.label}</td>
            {[1, 2, 3, 4, 5].map((n) => {
              const val = bySession[n]?.[row.key];
              const display = val != null ? String(val) : "-";
              return (
                <td key={n} style={ri % 2 === 0 ? table.tdEven : table.tdOdd}>{display}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── 설문 응답 섹션 ───────────────────────────────────── */
function SurveySection({ responses, type }: { responses: SurveyResponse[]; type: "common" | "ai" }) {
  const filtered = responses.filter((r) => r.question_type === type);
  if (filtered.length === 0) return <p style={{ fontSize: 12, color: COLOR.textMuted }}>응답 없음</p>;

  return (
    <>
      {filtered.map((item, i) => (
        <div key={i}>
          {type === "ai" && item.reason && (
            <p style={{ fontSize: 9, color: COLOR.primary, marginTop: i === 0 ? 0 : 12, marginBottom: 2 }}>
              💡 {item.reason}
            </p>
          )}
          <p style={{ ...typography.qaQuestion, marginTop: type === "ai" ? 0 : i === 0 ? 0 : 12 }}>
            {item.question_text}
          </p>
          <p style={typography.qaAnswer}>
            {item.choice === "yes" ? "예" : item.choice === "no" ? "아니오" : "-"}
            {item.text_answer ? ` — ${item.text_answer}` : ""}
          </p>
        </div>
      ))}
    </>
  );
}

/* ── 메인 ─────────────────────────────────────────────── */
export default function RecordDetailPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { recordId, patientName } = (location.state ?? {}) as { recordId?: number; patientName?: string };

  const [detail, setDetail]   = useState<RecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [approving, setApproving] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    const token = localStorage.getItem("access_token");
    if (!token) { navigate("/login"); return; }

    fetch(`${API}/api/v1/records/${recordId}/detail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) { localStorage.clear(); navigate("/login"); return null; }
        if (!res.ok) throw new Error("서버 오류");
        return res.json();
      })
      .then((json) => { if (json) setDetail(json); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [recordId, navigate]);

  const handleApprove = async () => {
    if (!recordId || approving) return;
    const token = localStorage.getItem("access_token");
    setApproving(true);
    try {
      const res = await fetch(`${API}/api/v1/records/${recordId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail ?? "승인 실패");
        return;
      }
      setDetail((prev) => prev ? { ...prev, status: "reviewed" } : prev);
    } catch {
      alert("승인 중 오류가 발생했습니다.");
    } finally {
      setApproving(false);
    }
  };

  const handleRevert = async () => {
    if (!recordId || reverting) return;
    if (!window.confirm("승인을 취소하고 검토 중 상태로 되돌릴까요?")) return;
    const token = localStorage.getItem("access_token");
    setReverting(true);
    try {
      const res = await fetch(`${API}/api/v1/records/${recordId}/revert`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail ?? "되돌리기 실패");
        return;
      }
      setDetail((prev) => prev ? { ...prev, status: "submitted" } : prev);
    } catch {
      alert("되돌리기 중 오류가 발생했습니다.");
    } finally {
      setReverting(false);
    }
  };

  /* 직접 URL 접근 (recordId 없음) */
  if (!recordId) {
    return (
      <main style={{ padding: 24 }}>
        <p>기록을 찾을 수 없습니다.</p>
        <button onClick={() => navigate("/doctor")} style={btn.ghost}>← 대시보드로</button>
      </main>
    );
  }

  if (loading) return <div style={{ padding: 24, color: COLOR.textMuted, fontSize: 13 }}>불러오는 중...</div>;
  if (error)   return <div style={{ padding: 24, color: COLOR.danger,    fontSize: 13 }}>오류: {error}</div>;
  if (!detail) return null;

  const isApproved = detail.status === "reviewed";
  const submitTime = new Date(detail.submitted_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <style>{`
        .back-btn:hover    { background-color: #c8c8c8 !important; }
        .approve-btn:hover { background-color: ${COLOR.successDark} !important; }
      `}</style>

      <main style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={typography.pageTitle}>
              {detail.patient_name} 환자 — {detail.record_date} {submitTime}
            </h1>
            <button className="back-btn" style={btn.ghost} onClick={() => navigate(-1)}>← 목록</button>
          </div>
          {!isApproved ? (
            <button
              className="approve-btn"
              style={btn.success}
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? "처리 중..." : "✅ 기록 승인"}
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: COLOR.success, fontWeight: 700, fontSize: 13 }}>✅ 승인 완료</span>
              <button
                className="revert-btn"
                style={{
                  padding: "6px 14px",
                  backgroundColor: "#fff",
                  color: COLOR.textMuted,
                  border: `1px solid ${COLOR.textMuted}`,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={handleRevert}
                disabled={reverting}
              >
                {reverting ? "처리 중..." : "↩ 검토 중으로 되돌리기"}
              </button>
            </div>
          )}
        </div>

        {/* CAPD 투석 기록 테이블 */}
        <div style={card.base}>
          <p style={typography.cardTitle}>CAPD 투석 기록</p>
          <ExchangeTable exchanges={detail.exchange_records} />

          {/* 기타 바이탈 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 16px", marginTop: 12 }}>
            {[
              { label: "복막액 혼탁",   value: detail.turbid_peritoneal ? "있음 ⚠️" : "없음" },
              { label: "체중 (kg)",     value: detail.weight != null ? `${detail.weight} kg` : "-" },
              { label: "혈압 (mmHg)",   value: detail.blood_pressure ?? "-" },
              { label: "소변 횟수",     value: detail.urine_count != null ? `${detail.urine_count}회` : "-" },
              { label: "총 한외여과량", value: detail.total_ultrafiltration != null ? `${detail.total_ultrafiltration} g` : "-" },
              { label: "공복 혈당",     value: detail.fasting_blood_glucose != null ? `${detail.fasting_blood_glucose} mg/dL` : "-" },
            ].map((item) => (
              <div key={item.label}>
                <p style={{ fontSize: 9, color: COLOR.textMuted, margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: COLOR.text, margin: "2px 0 0" }}>{item.value}</p>
              </div>
            ))}
          </div>

          {detail.memo && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 9, color: COLOR.textMuted, margin: 0 }}>메모</p>
              <p style={{ fontSize: 12, color: COLOR.text, margin: "2px 0 0" }}>{detail.memo}</p>
            </div>
          )}
        </div>

        {/* AI 요약 */}
        <div style={card.base}>
          <p style={typography.cardTitle}>🤖 AI 일일 요약</p>
          <div style={contentBox.ai}>{detail.ai_summary}</div>
        </div>

        {/* EMR 형식 */}
        <div style={card.base}>
          <p style={typography.cardTitle}>📄 EMR 형식 요약</p>
          <div style={contentBox.emr}>
            <span>S: {detail.emr.S}</span>
            <span>O: {detail.emr.O}</span>
            <span>A: {detail.emr.A}</span>
            <span>P: {detail.emr.P}</span>
          </div>
        </div>

        {/* 설문 응답 (2열) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card.base}>
            <p style={typography.cardTitle}>💬 공통 질문 응답</p>
            <SurveySection responses={detail.survey_responses} type="common" />
          </div>
          <div style={card.base}>
            <p style={typography.cardTitle}>🤖 AI 맞춤 질문 응답</p>
            <SurveySection responses={detail.survey_responses} type="ai" />
          </div>
        </div>

      </main>
    </>
  );
}
