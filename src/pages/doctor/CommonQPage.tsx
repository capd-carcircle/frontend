import React, { useEffect, useRef, useState } from "react";
import {
  CommonQuestion,
  createCommonQuestion,
  deleteCommonQuestion,
  listCommonQuestions,
  toggleCommonQuestion,
  updateCommonQuestion,
} from "../../api/questions";
import { COLOR, btn, card, table, typography } from "../../styles/doctor";

/* ── 아이콘 (SVG inline) ──────────────────────────────────────────── */
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

/* ── 공통 아이콘 버튼 스타일 ──────────────────────────────────────── */
const iconBtn = (color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 6,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color,
  transition: "background 0.15s",
});

/* ════════════════════════════════════════════════════════════════════ */
export default function CommonQPage() {
  const [questions, setQuestions] = useState<CommonQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* 새 질문 입력 */
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);

  /* 인라인 수정 상태 */
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  /* ── 데이터 로드 ──────────────────────────────────────────────── */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCommonQuestions();
      setQuestions(data);
    } catch {
      setError("질문 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* 인라인 수정 시작 */
  useEffect(() => {
    if (editId !== null) editInputRef.current?.focus();
  }, [editId]);

  /* ── 추가 ─────────────────────────────────────────────────────── */
  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      const created = await createCommonQuestion(text);
      setQuestions((prev) => [...prev, created]);
      setNewText("");
    } catch {
      alert("질문 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  /* ── 수정 저장 ────────────────────────────────────────────────── */
  const handleEditSave = async (id: number) => {
    const text = editText.trim();
    if (!text) return;
    try {
      const updated = await updateCommonQuestion(id, { question_text: text });
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
    } catch {
      alert("수정에 실패했습니다.");
    } finally {
      setEditId(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === "Enter") handleEditSave(id);
    if (e.key === "Escape") setEditId(null);
  };

  /* ── 삭제 ─────────────────────────────────────────────────────── */
  const handleDelete = async (id: number, text: string) => {
    if (!window.confirm(`"${text.slice(0, 30)}..." 질문을 삭제할까요?`)) return;
    try {
      await deleteCommonQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  /* ── 활성/비활성 토글 ─────────────────────────────────────────── */
  const handleToggle = async (id: number) => {
    try {
      const updated = await toggleCommonQuestion(id);
      setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
    } catch {
      alert("상태 변경에 실패했습니다.");
    }
  };

  /* ── 통계 ─────────────────────────────────────────────────────── */
  const activeCount = questions.filter((q) => q.is_active).length;
  const inactiveCount = questions.length - activeCount;

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── 헤더 ── */}
      <div>
        <h1 style={typography.pageTitle}>공통 질문 관리</h1>
        <p style={typography.pageSubtitle}>모든 환자에게 공통으로 적용되는 후속 질문을 관리합니다.</p>
      </div>

      {/* ── 통계 배지 ── */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "전체", value: questions.length, color: COLOR.primary },
          { label: "활성", value: activeCount, color: COLOR.success },
          { label: "비활성", value: inactiveCount, color: COLOR.gray },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card.base, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 90 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
            <span style={{ fontSize: 11, color: COLOR.textMuted }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── 새 질문 추가 ── */}
      <div style={{ ...card.base, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          placeholder="새 공통 질문을 입력하세요..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleAddKeyDown}
          disabled={adding}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "7px 12px",
            border: `1px solid ${COLOR.grayLight}`,
            borderRadius: 6,
            outline: "none",
            color: COLOR.text,
          }}
        />
        <button
          style={{ ...btn.primary, opacity: adding || !newText.trim() ? 0.6 : 1 }}
          onClick={handleAdd}
          disabled={adding || !newText.trim()}
        >
          + 추가
        </button>
      </div>

      {/* ── 질문 목록 ── */}
      <div style={card.base}>
        {loading ? (
          <p style={{ textAlign: "center", color: COLOR.textMuted, fontSize: 12, padding: "30px 0" }}>불러오는 중...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: COLOR.danger, fontSize: 12, padding: "30px 0" }}>{error}</p>
        ) : questions.length === 0 ? (
          <p style={{ textAlign: "center", color: COLOR.textMuted, fontSize: 12, padding: "30px 0" }}>
            등록된 공통 질문이 없습니다. 위에서 추가해보세요.
          </p>
        ) : (
          <table style={table.root}>
            <thead>
              <tr>
                <th style={{ ...table.thDark, width: 40, textAlign: "center" }}>#</th>
                <th style={table.thDark}>질문 내용</th>
                <th style={{ ...table.thDark, width: 80, textAlign: "center" }}>상태</th>
                <th style={{ ...table.thDark, width: 110, textAlign: "center" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => {
                const isEditing = editId === q.id;
                const rowBg = idx % 2 === 0 ? COLOR.white : COLOR.rowAlt;
                return (
                  <tr key={q.id} style={{ backgroundColor: rowBg }}>
                    {/* 번호 */}
                    <td style={{ ...table.tdNormal, textAlign: "center", color: COLOR.textMuted, fontSize: 11 }}>
                      {idx + 1}
                    </td>

                    {/* 질문 내용 */}
                    <td style={table.tdNormal}>
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, q.id)}
                          style={{
                            width: "100%",
                            fontSize: 12,
                            padding: "5px 10px",
                            border: `1.5px solid ${COLOR.primary}`,
                            borderRadius: 5,
                            outline: "none",
                            color: COLOR.text,
                            boxSizing: "border-box",
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: q.is_active ? COLOR.text : COLOR.textMuted, textDecoration: q.is_active ? "none" : "line-through" }}>
                          {q.question_text}
                        </span>
                      )}
                    </td>

                    {/* 상태 배지 */}
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 20,
                        backgroundColor: q.is_active ? "#edfff2" : "#f3f3f3",
                        color: q.is_active ? COLOR.success : COLOR.gray,
                      }}>
                        {q.is_active ? "활성" : "비활성"}
                      </span>
                    </td>

                    {/* 액션 버튼 */}
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                        {isEditing ? (
                          <>
                            <button
                              title="저장"
                              style={iconBtn(COLOR.success)}
                              onClick={() => handleEditSave(q.id)}
                            >
                              <IconCheck />
                            </button>
                            <button
                              title="취소"
                              style={iconBtn(COLOR.gray)}
                              onClick={() => setEditId(null)}
                            >
                              <IconX />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* 수정 */}
                            <button
                              title="수정"
                              style={iconBtn(COLOR.primary)}
                              onClick={() => { setEditId(q.id); setEditText(q.question_text); }}
                            >
                              <IconEdit />
                            </button>
                            {/* 토글 */}
                            <button
                              title={q.is_active ? "비활성화" : "활성화"}
                              style={iconBtn(q.is_active ? COLOR.gray : COLOR.success)}
                              onClick={() => handleToggle(q.id)}
                            >
                              {q.is_active ? <IconX /> : <IconCheck />}
                            </button>
                            {/* 삭제 */}
                            <button
                              title="삭제"
                              style={iconBtn(COLOR.danger)}
                              onClick={() => handleDelete(q.id, q.question_text)}
                            >
                              <IconTrash />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
