import React, { useEffect, useState } from "react";
import {
  AIQuestionRow,
  listAIQuestions,
  rejectAIQuestion,
  restoreAIQuestion,
  reviewAIQuestion,
  promoteToCommonQuestion,
} from "../../api/questions";
import { COLOR, card, typography } from "../../styles/doctor";
import { useToast } from "../../hooks/useToast";

const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconStar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IconGlobe = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);
const IconRotate = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
  </svg>
);

type TabType = "pending" | "approved" | "rejected";

const typeLabel = (t: string) =>
  ({ yes_no: "예/아니오", single_select: "단일선택", multi_select: "다중선택", short_text: "단답" }[t] ?? t);

const calcAge = (b: string | null, ref?: string) => {
  if (!b) return null;
  const refD  = ref ? new Date(ref + "T00:00:00") : new Date();
  const birth = new Date(b + "T00:00:00");
  let age = refD.getFullYear() - birth.getFullYear();
  const m = refD.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && refD.getDate() < birth.getDate())) age--;
  return age;
};
const patientLabel = (name: string, birth: string | null, gender: string | null, ref?: string) => {
  const age = calcAge(birth, ref);
  const g = gender === "m" ? "남" : gender === "f" ? "여" : null;
  if (age !== null && g) return `${name}(${age}/${g})`;
  if (age !== null) return `${name}(${age})`;
  if (g) return `${name}(${g})`;
  return name;
};
const rejectLabel = (status: string) =>
  status === "rejected_for_patient" ? "환자 숨김" : "전역 거절";

export default function AIReviewPage() {
  const [questions, setQuestions]     = useState<AIQuestionRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [patientFilter, setPatientFilter] = useState<number | "">("");
  const [activeTab, setActiveTab]     = useState<TabType>("pending");
  const [busyId, setBusyId]           = useState<number | null>(null);
  const [rejectInput, setRejectInput] = useState<{ id: number; scope: "patient" | "global"; text: string } | null>(null);
  const [isMobile, setIsMobile]       = useState(() => window.innerWidth < 640);
  const toast    = useToast(3000);
  const errToast = useToast(3000);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const patients = Array.from(
    new Map(questions.map((q) => [q.patient_id, { name: q.patient_name, birth: q.patient_birth_date, gender: q.patient_gender }])).entries()
  ).map(([id, p]) => ({ id, name: p.name, birth: p.birth, gender: p.gender }));

  useEffect(() => {
    setLoading(true);
    listAIQuestions(patientFilter !== "" ? (patientFilter as number) : undefined)
      .then(setQuestions)
      .catch(() => setError("AI 질문을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [patientFilter]);

  const pendingList  = questions.filter((q) => q.status === "pending");
  const approvedList = questions.filter((q) => q.status === "approved");
  const rejectedList = questions.filter((q) =>
    q.status === "rejected_for_patient" || q.status === "rejected_global"
  );
  const tabList = activeTab === "pending"  ? pendingList
                : activeTab === "approved" ? approvedList
                : rejectedList;

  const handleReview = async (q: AIQuestionRow) => {
    setBusyId(q.id);
    try {
      const { status } = await reviewAIQuestion(q.id);
      setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, status } : item));
    } catch {
      errToast.show("처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const openRejectInput = (q: AIQuestionRow, scope: "patient" | "global") => {
    if (rejectInput?.id === q.id && rejectInput.scope === scope) {
      setRejectInput(null);
    } else {
      setRejectInput({ id: q.id, scope, text: "" });
    }
  };

  const handleReject = async (q: AIQuestionRow) => {
    if (!rejectInput) return;
    setBusyId(q.id);
    try {
      await rejectAIQuestion(q.id, rejectInput.scope, rejectInput.text || undefined);
      setQuestions((prev) =>
        prev.map((item) =>
          item.id === q.id
            ? { ...item, status: rejectInput.scope === "global" ? "rejected_global" : "rejected_for_patient" }
            : item
        )
      );
      setRejectInput(null);
    } catch {
      errToast.show("처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (q: AIQuestionRow) => {
    setBusyId(q.id);
    try {
      await restoreAIQuestion(q.id);
      setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, status: "pending" } : item));
    } catch {
      errToast.show("복구 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const handlePromote = async (q: AIQuestionRow) => {
    setBusyId(q.id);
    try {
      await promoteToCommonQuestion(q);
      if (q.status === "pending") {
        await reviewAIQuestion(q.id);
        setQuestions((prev) => prev.map((item) => item.id === q.id ? { ...item, status: "approved" } : item));
      }
      toast.show("공통질문에 추가됐어요. 공통질문 페이지에서 편집 후 활성화하세요.");
    } catch {
      errToast.show("공통질문 등록 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const tabStyle = (tab: TabType): React.CSSProperties => ({
    padding: isMobile ? "8px 10px" : "8px 16px",
    fontSize: isMobile ? 12 : 13, fontWeight: 600, cursor: "pointer",
    border: "none", background: "transparent", fontFamily: "inherit",
    color: activeTab === tab ? COLOR.primary : COLOR.textMuted,
    borderBottom: activeTab === tab ? `2px solid ${COLOR.primary}` : "2px solid transparent",
    transition: "all 0.15s", display: "flex", alignItems: "center", gap: 4,
  });

  const badge = (count: number, urgent?: boolean): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
    background: urgent && count > 0 ? COLOR.danger : COLOR.grayBg,
    color: urgent && count > 0 ? "#fff" : COLOR.textMuted,
    minWidth: 18, textAlign: "center" as const,
  });

  const btnBase: React.CSSProperties = {
    border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s",
    display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 11px",
  };
  const btnPrimary : React.CSSProperties = { ...btnBase, background: COLOR.primary, color: "#fff" };
  const btnSuccess : React.CSSProperties = { ...btnBase, background: COLOR.success,  color: "#fff" };
  const btnOutline : React.CSSProperties = { ...btnBase, background: "#fff", border: `1px solid ${COLOR.grayLight}`, color: COLOR.text };
  const btnDanger  : React.CSSProperties = { ...btnBase, background: "#fff", border: `1px solid ${COLOR.danger}`, color: COLOR.danger };
  const btnWarning : React.CSSProperties = { ...btnBase, background: "#fff", border: `1px solid #e6a817`, color: "#b07a00" };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: isMobile ? 14 : 24 }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ ...typography.pageTitle, fontSize: isMobile ? 17 : undefined }}>AI 맞춤 질문 검토</h1>
        {!isMobile && (
          <p style={typography.pageSubtitle}>
            AI가 환자 기록을 분석해 생성한 질문을 검토하고, 필요한 조치를 취하세요.
          </p>
        )}
      </div>

      <div style={{ marginBottom: 10 }}>
        <select
          value={patientFilter}
          onChange={(e) => setPatientFilter(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLOR.grayLight}`, fontSize: 13, color: COLOR.text, background: "#fff", width: isMobile ? "100%" : "auto" }}
        >
          <option value="">전체 환자</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{patientLabel(p.name, p.birth, p.gender)}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${COLOR.grayLight}`, marginBottom: 16 }}>
        <button style={tabStyle("pending")} onClick={() => setActiveTab("pending")}>
          미확인 <span style={badge(pendingList.length, true)}>{pendingList.length}</span>
        </button>
        <button style={tabStyle("approved")} onClick={() => setActiveTab("approved")}>
          확인됨 <span style={badge(approvedList.length)}>{approvedList.length}</span>
        </button>
        <button style={tabStyle("rejected")} onClick={() => setActiveTab("rejected")}>
          거절됨 <span style={badge(rejectedList.length)}>{rejectedList.length}</span>
        </button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: COLOR.textMuted, alignSelf: "center", paddingRight: 4 }}>
          {tabList.length}개
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: COLOR.textMuted, fontSize: 13 }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: COLOR.danger, fontSize: 13 }}>{error}</div>
      ) : tabList.length === 0 ? (
        <div style={{ ...card.base, textAlign: "center", padding: "40px 20px", color: COLOR.textMuted, fontSize: 13 }}>
          {activeTab === "pending" ? "검토 대기 중인 질문이 없어요." :
           activeTab === "approved" ? "확인된 질문이 없어요." : "거절된 질문이 없어요."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tabList.map((q) => {
            const isBusy     = busyId === q.id;
            const isRejected = q.status === "rejected_for_patient" || q.status === "rejected_global";
            const isApproved = q.status === "approved";
            const showRejectPanel = rejectInput?.id === q.id;

            return (
              <div
                key={q.id}
                style={{
                  ...card.base, padding: 0, overflow: "hidden",
                  borderLeft: isApproved ? `3px solid ${COLOR.success}`
                    : isRejected ? `3px solid ${COLOR.grayLight}`
                    : `3px solid ${COLOR.primary}`,
                  opacity: isRejected ? 0.8 : 1, transition: "opacity 0.15s",
                }}
              >
                <div style={{ padding: "14px 16px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.text }}>
                      {patientLabel(q.patient_name, q.patient_birth_date, q.patient_gender, q.record_date)}
                    </span>
                    <span style={{ fontSize: 11, color: COLOR.textMuted }}>{q.record_date}</span>
                    <span style={{ fontSize: 11, color: COLOR.gray, background: COLOR.grayBg, padding: "1px 7px", borderRadius: 99 }}>
                      {typeLabel(q.question_type)}
                    </span>
                    {isRejected && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99,
                        color: q.status === "rejected_global" ? "#7a4f00" : COLOR.danger,
                        background: q.status === "rejected_global" ? "#fff8e1" : "#fff0f0",
                      }}>
                        {rejectLabel(q.status)}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: "0 0 6px", fontSize: 14, color: COLOR.text, fontWeight: 500, lineHeight: 1.5 }}>
                    {q.question_text}
                  </p>

                  {q.reason && (
                    <p style={{ margin: "0 0 4px", fontSize: 12, color: COLOR.textMuted, lineHeight: 1.4, borderLeft: `2px solid ${COLOR.grayLight}`, paddingLeft: 8 }}>
                      {q.reason}
                    </p>
                  )}
                  {q.rejected_reason && (
                    <p style={{ margin: 0, fontSize: 12, color: "#b07a00", lineHeight: 1.4, borderLeft: "2px solid #e6a817", paddingLeft: 8, background: "#fffdf0", borderRadius: "0 4px 4px 0", padding: "3px 8px" }}>
                      거절 이유: {q.rejected_reason}
                    </p>
                  )}
                </div>

                <div style={{
                  padding: "10px 16px 12px", borderTop: `1px solid ${COLOR.grayBg}`,
                  background: "#fafbfc", display: "flex", alignItems: "center", gap: 6,
                  flexWrap: "wrap", rowGap: isMobile ? 8 : 6,
                }}>
                  {isRejected ? (
                    <button onClick={() => handleRestore(q)} disabled={isBusy} style={{ ...btnOutline, opacity: isBusy ? 0.6 : 1 }}>
                      <IconRotate /> {isBusy ? "처리 중..." : "복구"}
                    </button>
                  ) : isApproved ? (
                    /* 확인됨 탭: 정적 뱃지만 표시 (되돌리기 버튼 없음) */
                    <>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 11px", borderRadius: 6,
                        background: "#edfff2", color: COLOR.success,
                        fontSize: 12, fontWeight: 700,
                        border: `1px solid ${COLOR.success}33`,
                      }}>
                        <IconCheck /> 확인됨
                      </span>
                      <span style={{ width: 1, height: 20, background: COLOR.grayLight, margin: "0 2px" }} />
                      <button onClick={() => handlePromote(q)} disabled={isBusy} style={{ ...btnOutline, opacity: isBusy ? 0.6 : 1 }}>
                        <IconStar /> 공통질문 등록
                      </button>
                    </>
                  ) : (
                    /* 미확인 탭: 전체 액션 버튼 */
                    <>
                      <button onClick={() => handleReview(q)} disabled={isBusy} style={{ ...btnPrimary, opacity: isBusy ? 0.6 : 1 }}>
                        <IconCheck /> {isBusy ? "처리 중..." : "확인"}
                      </button>
                      <span style={{ width: 1, height: 20, background: COLOR.grayLight, margin: "0 2px" }} />
                      <button onClick={() => handlePromote(q)} disabled={isBusy} style={{ ...btnOutline, opacity: isBusy ? 0.6 : 1 }}>
                        <IconStar /> {isMobile ? "공통등록" : "공통질문 등록"}
                      </button>
                      <button
                        onClick={() => openRejectInput(q, "patient")}
                        disabled={isBusy}
                        style={{ ...btnWarning, opacity: isBusy ? 0.6 : 1, background: showRejectPanel && rejectInput?.scope === "patient" ? "#fff8e1" : "#fff" }}
                      >
                        <IconEyeOff /> {isMobile ? "숨김" : "이 환자 숨김"}
                      </button>
                      <button
                        onClick={() => openRejectInput(q, "global")}
                        disabled={isBusy}
                        style={{ ...btnDanger, opacity: isBusy ? 0.6 : 1, background: showRejectPanel && rejectInput?.scope === "global" ? "#fff0f0" : "#fff" }}
                      >
                        <IconGlobe /> {isMobile ? "전역거절" : "전역 거절"}
                      </button>
                    </>
                  )}
                </div>

                {showRejectPanel && rejectInput && (
                  <div style={{
                    padding: "10px 16px 14px",
                    borderTop: `1px solid ${rejectInput.scope === "global" ? "#ffd6d6" : "#ffe8b0"}`,
                    background: rejectInput.scope === "global" ? "#fff8f8" : "#fffdf0",
                  }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600,
                      color: rejectInput.scope === "global" ? COLOR.danger : "#b07a00" }}>
                      {rejectInput.scope === "global" ? "전역 거절 이유" : "이 환자 숨김 이유"}
                      <span style={{ fontWeight: 400, color: COLOR.textMuted }}> (선택)</span>
                    </p>
                    <textarea
                      value={rejectInput.text}
                      onChange={(e) => setRejectInput({ ...rejectInput, text: e.target.value })}
                      placeholder="이유를 입력하면 나중에 참고할 수 있어요."
                      rows={2}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "7px 10px", borderRadius: 6, fontSize: 13,
                        border: `1px solid ${COLOR.grayLight}`, resize: "vertical",
                        fontFamily: "inherit", color: COLOR.text, outline: "none", lineHeight: 1.5,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => handleReject(q)}
                        disabled={isBusy}
                        style={{ ...btnBase, background: rejectInput.scope === "global" ? COLOR.danger : "#e6a817", color: "#fff", opacity: isBusy ? 0.6 : 1 }}
                      >
                        {isBusy ? "처리 중..." : "거절 확정"}
                      </button>
                      <button onClick={() => setRejectInput(null)} disabled={isBusy} style={{ ...btnOutline }}>
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast.message && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1a1a2e", color: "#fff", padding: "10px 20px", borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          whiteSpace: "nowrap",
        }}>
          {toast.message}
        </div>
      )}
      {errToast.message && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: COLOR.danger, color: "#fff", padding: "10px 20px", borderRadius: 8,
          fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {errToast.message}
        </div>
      )}
    </main>
  );
}
