import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { card, COLOR, STATUS_MAP, typography } from "../../styles/doctor";
import {
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
} from "../../api/auth";
import type { PatientRegistrationInfo } from "../../types";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/* ── 타입 ─────────────────────────────────────────────── */
interface PatientInfo {
  id:           number;
  name:         string;
  phone_number: string;
}

interface TodayRecord {
  record_id:       number;
  patient_id:      number;
  patient_name:    string;
  status:          string;
  risk_level:      "urgent" | "caution" | "normal" | null;
  ai_summary:      string | null;
  conversation_id: number | null;
}

interface DashboardStats {
  total_submitted: number;
  pending_count:   number;
  approved_count:  number;
  total_patients:  number;
  records:         TodayRecord[];
  patients:        PatientInfo[];
}

/* ── 통계 카드 ────────────────────────────────────────── */
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={card.base}>
      <p style={typography.label}>{label}</p>
      <p style={{ ...typography.value, color }}>{value}</p>
    </div>
  );
}

/* ── 위험도 뱃지 ──────────────────────────────────────── */
const RISK_CONFIG = {
  urgent:  { label: "🚨 긴급", bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
  caution: { label: "⚠️ 주의", bg: "#fffbeb", color: "#d97706", border: "#fcd34d" },
  normal:  { label: "✓ 정상",  bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
} as const;

/* ── 대화 보기 모달 ───────────────────────────────────── */
interface ConvModalProps {
  conversationId: number;
  onClose: () => void;
}

function ConversationModal({ conversationId, onClose }: ConvModalProps) {
  const [messages, setMessages] = React.useState<Array<{ role: string; content: string; is_urgent_flag: boolean }>>([]);
  const [loading,  setLoading]  = React.useState(true);

  React.useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch(`${API}/api/v1/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: "#fff", borderRadius: 16,
        width: "100%", maxWidth: 520, maxHeight: "80vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>🤖 AI 문진 대화 내용</p>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center" }}>불러오는 중...</p>
          ) : messages.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center" }}>대화 내용이 없습니다.</p>
          ) : messages.map((m, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: m.role === "ai" ? "flex-start" : "flex-end",
            }}>
              <div style={{
                maxWidth: "75%", padding: "10px 14px",
                borderRadius: m.role === "ai" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                backgroundColor: m.is_urgent_flag ? "#fef2f2" : m.role === "ai" ? "#f0f4ff" : "#1b508a",
                color: m.is_urgent_flag ? "#dc2626" : m.role === "ai" ? "#1a1a2e" : "#fff",
                fontSize: 13, lineHeight: 1.6,
                border: m.is_urgent_flag ? "1px solid #fca5a5" : "none",
              }}>
                <span style={{ fontSize: 10, opacity: 0.6, display: "block", marginBottom: 2 }}>
                  {m.role === "ai" ? "AI" : "환자"}
                </span>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 환자 카드 ────────────────────────────────────────── */
interface PatientCardProps {
  patient:       PatientInfo;
  todayRecord:   TodayRecord | null;
  onClickRecord: (recordId: number, patientName: string) => void;
  onClickPast:   (patientId: number, patientName: string) => void;
}

function PatientCard({ patient, todayRecord, onClickRecord, onClickPast }: PatientCardProps) {
  const [showConvModal, setShowConvModal] = React.useState(false);

  const hasPending  = todayRecord !== null && todayRecord.status === "submitted";
  const hasApproved = todayRecord !== null && todayRecord.status === "reviewed";
  const hasRecord   = todayRecord !== null;
  const riskLevel   = todayRecord?.risk_level ?? null;
  const riskConfig  = riskLevel ? RISK_CONFIG[riskLevel] : null;

  // 위험도 기반 테두리 색상 (위험도 > 상태)
  const borderColor = riskLevel === "urgent" ? "#fca5a5"
                    : riskLevel === "caution" ? "#fcd34d"
                    : hasPending  ? COLOR.danger
                    : hasApproved ? COLOR.success
                    : COLOR.grayLight;
  const bgColor     = riskLevel === "urgent" ? "#fff5f5"
                    : riskLevel === "caution" ? "#fffdf0"
                    : hasPending  ? "#fff8f8"
                    : hasApproved ? "#f4fff7"
                    : COLOR.white;

  return (
    <>
      {showConvModal && todayRecord?.conversation_id && (
        <ConversationModal
          conversationId={todayRecord.conversation_id}
          onClose={() => setShowConvModal(false)}
        />
      )}

      <div
        style={{
          ...card.base,
          border: `1.5px solid ${borderColor}`,
          backgroundColor: bgColor,
          padding: "14px 18px",
          cursor: hasRecord ? "pointer" : "default",
          transition: "box-shadow 0.15s",
        }}
        onClick={() => {
          if (hasPending || hasApproved) onClickRecord(todayRecord!.record_id, patient.name);
        }}
      >
        {/* 상단: 환자 정보 + 뱃지 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              backgroundColor: riskLevel === "urgent" ? "#ffeaea" : hasApproved ? "#e6f7ec" : COLOR.grayBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              👤
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLOR.text }}>{patient.name}</p>
              <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted }}>{patient.phone_number}</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* 위험도 뱃지 */}
            {riskConfig && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                backgroundColor: riskConfig.bg, color: riskConfig.color,
                border: `1px solid ${riskConfig.border}`,
              }}>
                {riskConfig.label}
              </span>
            )}
            {/* 기존 상태 뱃지 */}
            {hasPending && !riskLevel && (
              <span style={{ backgroundColor: "#ffe5e5", color: COLOR.danger, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                ● 미확인 기록
              </span>
            )}
            {hasApproved && !riskLevel && (
              <span style={{ backgroundColor: "#e6f7ec", color: COLOR.success, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                ✓ 오늘 승인됨
              </span>
            )}
            {!hasRecord && (
              <span style={{ fontSize: 10, color: COLOR.textMuted }}>오늘 미제출</span>
            )}
            <button
              style={{ fontSize: 10, padding: "4px 12px", border: `1px solid ${COLOR.grayLight}`, borderRadius: 6, backgroundColor: COLOR.white, color: COLOR.textMuted, cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); onClickPast(patient.id, patient.name); }}
            >
              과거 기록
            </button>
          </div>
        </div>

        {/* AI 요약 */}
        {todayRecord?.ai_summary && (
          <div style={{
            marginTop: 10,
            padding: "10px 12px",
            backgroundColor: "rgba(0,0,0,0.03)",
            borderRadius: 8,
            borderLeft: `3px solid ${riskConfig?.border ?? "#e5e7eb"}`,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>
              {todayRecord.ai_summary}
            </p>
            {todayRecord.conversation_id && (
              <button
                style={{
                  marginTop: 6, fontSize: 11, color: "#1b508a", fontWeight: 600,
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}
                onClick={(e) => { e.stopPropagation(); setShowConvModal(true); }}
              >
                대화 내용 보기 →
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── 환자 가입 요청 카드 ──────────────────────────────── */
function RegistrationCard({
  reg,
  onApprove,
  onReject,
}: {
  reg: PatientRegistrationInfo;
  onApprove: (id: number) => void;
  onReject:  (id: number) => void;
}) {
  return (
    <div
      style={{
        ...card.base,
        border: `1.5px solid #F59E0B`,
        backgroundColor: "#FFFBEB",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          🔔
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLOR.text }}>{reg.name}</p>
          <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted }}>
            생년월일: {reg.birth_date}
            {reg.hospital_name ? ` · ${reg.hospital_name}` : ""}
          </p>
          <p style={{ margin: 0, fontSize: 10, color: "#92400E" }}>
            {new Date(reg.created_at).toLocaleDateString("ko-KR")} 요청
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{ fontSize: 11, padding: "5px 14px", border: "none", borderRadius: 6, backgroundColor: "#059669", color: "#fff", cursor: "pointer", fontWeight: 600 }}
          onClick={() => onApprove(reg.id)}
        >
          승인
        </button>
        <button
          style={{ fontSize: 11, padding: "5px 14px", border: "none", borderRadius: 6, backgroundColor: "#EF4444", color: "#fff", cursor: "pointer", fontWeight: 600 }}
          onClick={() => onReject(reg.id)}
        >
          거절
        </button>
      </div>
    </div>
  );
}

/* ── 메인 ─────────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const [patients,     setPatients]     = useState<PatientInfo[]>([]);
  const [stats,        setStats]        = useState<DashboardStats | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [pendingRegs,  setPendingRegs]  = useState<PatientRegistrationInfo[]>([]);

  const todayStr = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const fetchData = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { navigate("/login"); return; }
    setLoading(true);
    setError("");

    Promise.all([
      fetch(`${API}/api/v1/patients`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/api/v1/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(async ([pRes, dRes]) => {
        if (pRes.status === 401 || dRes.status === 401) {
          localStorage.clear();
          navigate("/login");
          return;
        }
        if (!pRes.ok || !dRes.ok) throw new Error("서버 오류");
        const [pData, dData] = await Promise.all([pRes.json(), dRes.json()]);
        setPatients(pData as PatientInfo[]);
        setStats(dData as DashboardStats);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const fetchPendingRegs = useCallback(async () => {
    try {
      const data = await getPendingRegistrations();
      setPendingRegs(data);
    } catch { /* 무시 */ }
  }, []);

  useEffect(() => { fetchData(); fetchPendingRegs(); }, [fetchData, fetchPendingRegs]);

  const handleApprove = async (id: number) => {
    try {
      await approveRegistration(id);
      setPendingRegs(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "승인에 실패했습니다.");
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("거절 사유를 입력해주세요 (선택사항):") ?? undefined;
    try {
      await rejectRegistration(id, reason);
      setPendingRegs(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "거절에 실패했습니다.");
    }
  };

  /* 오늘 제출 기록 맵 */
  const todayRecordMap = new Map<number, TodayRecord>();
  stats?.records.forEach((r) => todayRecordMap.set(r.patient_id, r));

  /* 정렬: 미확인 → 승인됨 → 미제출 */
  const sortedPatients = [...patients].sort((a, b) => {
    const ra = todayRecordMap.get(a.id);
    const rb = todayRecordMap.get(b.id);
    const rank = (r: TodayRecord | undefined) => !r ? 2 : r.status === "submitted" ? 0 : 1;
    return rank(ra) - rank(rb) || a.name.localeCompare(b.name, "ko");
  });

  const pendingCount  = stats?.pending_count  ?? 0;
  const approvedCount = stats?.approved_count ?? 0;
  const totalPatients = patients.length;

  const statCards = [
    { label: "오늘 미확인", value: `${pendingCount}건`,  color: pendingCount > 0 ? COLOR.danger : COLOR.textMuted },
    { label: "오늘 승인",   value: `${approvedCount}건`, color: COLOR.success },
    { label: "총 환자 수",  value: `${totalPatients}명`, color: COLOR.primaryDark },
  ];

  if (loading) return <div style={{ padding: 24, color: COLOR.textMuted, fontSize: 13 }}>불러오는 중...</div>;
  if (error)   return <div style={{ padding: 24, color: COLOR.danger,    fontSize: 13 }}>오류: {error}</div>;

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={typography.pageTitle}>나의 환자</h1>
        <p style={typography.pageSubtitle}>{todayStr}</p>
      </div>

      {/* 환자 가입 요청 섹션 */}
      {pendingRegs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ ...typography.label, fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#92400E" }}>
            🔔 환자 가입 요청 ({pendingRegs.length}건)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pendingRegs.map((reg) => (
              <RegistrationCard
                key={reg.id}
                reg={reg}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        {statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* 환자 목록 */}
      {sortedPatients.length === 0 ? (
        <div style={{ ...card.base, textAlign: "center", color: COLOR.textMuted, fontSize: 13, padding: 40 }}>
          등록된 환자가 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedPatients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              todayRecord={todayRecordMap.get(p.id) ?? null}
              onClickRecord={(recordId, patientName) =>
                navigate("/doctor/record", { state: { recordId, patientName } })
              }
              onClickPast={(patientId, patientName) =>
                navigate(`/doctor/patients/${patientId}`, { state: { patientName } })
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
