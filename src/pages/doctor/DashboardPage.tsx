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
  record_id:    number;
  patient_id:   number;
  patient_name: string;
  status:       string;
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

/* ── 환자 카드 ────────────────────────────────────────── */
interface PatientCardProps {
  patient:       PatientInfo;
  todayRecord:   TodayRecord | null;
  onClickRecord: (recordId: number, patientName: string) => void;
  onClickPast:   (patientId: number, patientName: string) => void;
}

function PatientCard({ patient, todayRecord, onClickRecord, onClickPast }: PatientCardProps) {
  const hasPending  = todayRecord !== null && todayRecord.status === "submitted";
  const hasApproved = todayRecord !== null && todayRecord.status === "reviewed";
  const hasRecord   = todayRecord !== null;

  const borderColor = hasPending ? COLOR.danger : hasApproved ? COLOR.success : COLOR.grayLight;
  const bgColor     = hasPending ? "#fff8f8"    : hasApproved ? "#f4fff7"     : COLOR.white;

  return (
    <div
      style={{
        ...card.base,
        border: `1.5px solid ${borderColor}`,
        backgroundColor: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 18px",
        cursor: hasRecord ? "pointer" : "default",
        transition: "box-shadow 0.15s",
      }}
      onClick={() => {
        if (hasPending || hasApproved) onClickRecord(todayRecord!.record_id, patient.name);
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: hasPending ? "#ffeaea" : hasApproved ? "#e6f7ec" : COLOR.grayBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          👤
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLOR.text }}>{patient.name}</p>
          <p style={{ margin: 0, fontSize: 10, color: COLOR.textMuted }}>{patient.phone_number}</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {hasPending && (
          <span style={{ backgroundColor: "#ffe5e5", color: COLOR.danger, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            ● 미확인 기록
          </span>
        )}
        {hasApproved && (
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
