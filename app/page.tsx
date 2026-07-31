"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { percentage as pct } from "../lib/analytics";

type PriorityAnswer = "sim" | "nao" | "";
type View = "avaliar" | "analises";

type Student = {
  id: string;
  name: string;
  className: string;
  course: "Administração" | "Redes de Computadores";
  initials: string;
};

type Evaluation = {
  id: number;
  studentId: string;
  teacherName: string;
  priority: number;
  aprendizagem: number;
  concentracao: number;
  tempo: number;
  emocional: number;
  relacionamento: number;
  saude: number;
  disciplina: number;
  assiduidade: number;
  notes: string;
  updatedAt: string;
};

const difficulties = [
  { id: "aprendizagem", title: "Dificuldades de Aprendizagem", description: "Problemas para entender e assimilar novos conteúdos." },
  { id: "concentracao", title: "Problemas de Concentração", description: "Dificuldade em manter o foco durante as aulas ou estudos." },
  { id: "tempo", title: "Gestão de Tempo", description: "Desafios em organizar o tempo para estudar e cumprir prazos." },
  { id: "emocional", title: "Desafios Emocionais", description: "Lidar com ansiedade, depressão ou baixa autoestima." },
  { id: "relacionamento", title: "Dificuldades de Relacionamento", description: "Problemas em interagir com colegas, professores ou familiares." },
  { id: "saude", title: "Problemas de Saúde", description: "Condições que interferem nos estudos ou na frequência às aulas." },
  { id: "disciplina", title: "Problemas Disciplinares", description: "Comportamento inadequado ou falta de respeito às regras." },
  { id: "assiduidade", title: "Falta de Assiduidade", description: "Dificuldade para manter uma frequência escolar regular." },
] as const;

const students: Student[] = [
  { id: "demo-1a-adm", name: "Estudante demonstrativo 01", className: "1º A", course: "Administração", initials: "E1" },
  { id: "demo-1b-adm", name: "Estudante demonstrativo 02", className: "1º B", course: "Administração", initials: "E2" },
  { id: "demo-2a-adm", name: "Estudante demonstrativo 03", className: "2º A", course: "Administração", initials: "E3" },
  { id: "demo-2b-adm", name: "Estudante demonstrativo 04", className: "2º B", course: "Administração", initials: "E4" },
  { id: "demo-3a-adm", name: "Estudante demonstrativo 05", className: "3º A", course: "Administração", initials: "E5" },
  { id: "demo-3b-adm", name: "Estudante demonstrativo 06", className: "3º B", course: "Administração", initials: "E6" },
  { id: "demo-1a-redes", name: "Estudante demonstrativo 07", className: "1º A", course: "Redes de Computadores", initials: "E7" },
  { id: "demo-1b-redes", name: "Estudante demonstrativo 08", className: "1º B", course: "Redes de Computadores", initials: "E8" },
  { id: "demo-2a-redes", name: "Estudante demonstrativo 09", className: "2º A", course: "Redes de Computadores", initials: "E9" },
  { id: "demo-2b-redes", name: "Estudante demonstrativo 10", className: "2º B", course: "Redes de Computadores", initials: "10" },
  { id: "demo-3a-redes", name: "Estudante demonstrativo 11", className: "3º A", course: "Redes de Computadores", initials: "11" },
  { id: "demo-3b-redes", name: "Estudante demonstrativo 12", className: "3º B", course: "Redes de Computadores", initials: "12" },
];

export default function Home() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [teacherName, setTeacherName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [view, setView] = useState<View>("avaliar");
  const [studentId, setStudentId] = useState(students[0].id);
  const [priority, setPriority] = useState<PriorityAnswer>("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const student = students.find((item) => item.id === studentId) ?? students[0];
  const studentEvaluations = useMemo(
    () => evaluations.filter((item) => item.studentId === studentId),
    [evaluations, studentId],
  );
  const total = studentEvaluations.length;
  const priorityCount = studentEvaluations.filter((item) => item.priority === 1).length;

  async function loadEvaluations() {
    const response = await fetch("/api/evaluations", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { evaluations: Evaluation[] };
      setEvaluations(data.evaluations);
    }
  }

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { teacherName: string };
        setTeacherName(data.teacherName);
        await loadEvaluations();
      })
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    const own = studentEvaluations.find((item) => item.teacherName === teacherName);
    if (!own) {
      setPriority("");
      setSelected([]);
      setNotes("");
      return;
    }
    setPriority(own.priority ? "sim" : "nao");
    setSelected(difficulties.filter((difficulty) => own[difficulty.id] === 1).map((difficulty) => difficulty.id));
    setNotes(own.notes ?? "");
  }, [studentId, teacherName, studentEvaluations]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teacherName, accessCode }),
    });
    const data = (await response.json()) as { teacherName?: string; error?: string };
    if (!response.ok) {
      setLoginError(data.error ?? "Não foi possível entrar.");
      return;
    }
    setTeacherName(data.teacherName ?? teacherName);
    setAccessCode("");
    await loadEvaluations();
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setTeacherName("");
    setEvaluations([]);
    setView("avaliar");
  }

  function toggleDifficulty(id: string) {
    setStatus("");
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!priority) return;
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, priority: priority === "sim", difficulties: priority === "sim" ? selected : [], notes: priority === "sim" ? notes : "" }),
    });
    setSaving(false);
    if (!response.ok) {
      setStatus("Não foi possível salvar. Tente novamente.");
      return;
    }
    await loadEvaluations();
    setStatus("Avaliação salva. Os gráficos foram atualizados.");
  }

  if (sessionLoading) {
    return <main className="center-screen"><div className="loading-card" role="status"><span className="spinner" />Preparando o conselho de classe…</div></main>;
  }

  if (!teacherName) {
    return (
      <main className="login-shell">
        <section className="login-story">
          <div className="brand-lockup"><span>CF</span><strong>Conselho em Foco</strong></div>
          <div>
            <p className="kicker">Decisões pedagógicas baseadas em evidências</p>
            <h1>Cada olhar importa.<br />O conjunto orienta.</h1>
            <p>Registre sua percepção sobre cada estudante e acompanhe a visão consolidada do conselho em gráficos claros.</p>
          </div>
          <div className="mini-chart" aria-hidden="true"><i style={{ height: "42%" }} /><i style={{ height: "68%" }} /><i style={{ height: "54%" }} /><i style={{ height: "86%" }} /><i style={{ height: "64%" }} /></div>
        </section>
        <section className="login-panel">
          <form className="login-card" onSubmit={login}>
            <p className="kicker">Acesso da equipe escolar</p>
            <h2>Entre para avaliar</h2>
            <p className="muted">Não é necessário usar uma conta do ChatGPT.</p>
            <label><span>Seu nome</span><input required minLength={3} value={teacherName} onChange={(event) => setTeacherName(event.target.value)} placeholder="Ex.: Prof. Marcos Silva" autoComplete="name" /></label>
            <label><span>Código de acesso da escola</span><input required value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Digite o código" type="password" autoComplete="current-password" /></label>
            {loginError && <p className="error" role="alert">{loginError}</p>}
            <button type="submit" className="primary-button">Entrar na plataforma <span>→</span></button>
            <small>Ambiente demonstrativo. Os dados reais serão inseridos após a conferência das listas e fotos.</small>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup"><span>CF</span><div><strong>Conselho em Foco</strong><small>Plataforma pedagógica</small></div></div>
        <nav aria-label="Navegação principal">
          <button className={view === "avaliar" ? "active" : ""} onClick={() => setView("avaliar")}>Avaliar</button>
          <button className={view === "analises" ? "active" : ""} onClick={() => setView("analises")}>Análises</button>
        </nav>
        <div className="user-menu"><span>{teacherName.slice(0, 1).toUpperCase()}</span><div><strong>{teacherName}</strong><button onClick={logout}>Sair</button></div></div>
      </header>

      <section className="demo-banner"><strong>Versão demonstrativa</strong><span>As 12 turmas estão estruturadas com estudantes fictícios. Nenhum dado pessoal está publicado.</span></section>

      <div className="dashboard">
        <aside className="student-browser">
          <div className="browser-heading"><p className="kicker">Turmas de 2026</p><h2>Estudantes</h2><span>12 turmas</span></div>
          <div className="student-list">
            {students.map((item) => (
              <button key={item.id} className={item.id === studentId ? "selected" : ""} onClick={() => setStudentId(item.id)}>
                <span className={`avatar ${item.course === "Redes de Computadores" ? "purple" : ""}`}>{item.initials}</span>
                <span><strong>{item.name}</strong><small>{item.className} · {item.course}</small></span>
                {evaluations.some((evaluation) => evaluation.studentId === item.id && evaluation.teacherName === teacherName) && <i title="Avaliado por você">✓</i>}
              </button>
            ))}
          </div>
        </aside>

        <section className="content-panel">
          <header className="student-header">
            <div className={`large-avatar ${student.course === "Redes de Computadores" ? "purple" : ""}`}>{student.initials}</div>
            <div><p className="kicker">{student.className} · {student.course}</p><h1>{student.name}</h1><p>Cadastro fictício para validação do fluxo.</p></div>
            <div className="response-pill"><strong>{total}</strong><span>{total === 1 ? "resposta" : "respostas"}</span></div>
          </header>

          {view === "avaliar" ? (
            <form className="assessment" onSubmit={saveEvaluation}>
              <div className="section-title"><div><p className="kicker">Sua percepção</p><h2>Avaliação individual</h2></div><span>Uma resposta por professor</span></div>
              <fieldset className="question-card">
                <legend>O estudante é prioritário e necessita de intervenção? <b>*</b></legend>
                <p>Selecione uma opção para continuar.</p>
                <div className="radio-grid">
                  <label className={priority === "sim" ? "selected" : ""}><input type="radio" name="priority" checked={priority === "sim"} onChange={() => { setPriority("sim"); setStatus(""); }} /><span><strong>Sim</strong><small>Exibir as perguntas de detalhamento.</small></span></label>
                  <label className={priority === "nao" ? "selected no" : ""}><input type="radio" name="priority" checked={priority === "nao"} onChange={() => { setPriority("nao"); setSelected([]); setStatus(""); }} /><span><strong>Não</strong><small>Salvar sem perguntas adicionais.</small></span></label>
                </div>
              </fieldset>

              {priority === "sim" && (
                <section className="question-card reveal">
                  <div className="question-heading"><div><p className="kicker">Detalhamento</p><h3>Quais dificuldades foram encontradas?</h3></div><span>{selected.length} marcadas</span></div>
                  <p>Marque todas as alternativas que se aplicam.</p>
                  <div className="checkbox-grid">
                    {difficulties.map((difficulty) => (
                      <label key={difficulty.id} className={selected.includes(difficulty.id) ? "selected" : ""}>
                        <input type="checkbox" checked={selected.includes(difficulty.id)} onChange={() => toggleDifficulty(difficulty.id)} />
                        <span><strong>{difficulty.title}</strong><small>{difficulty.description}</small></span>
                      </label>
                    ))}
                  </div>
                  <label className="notes"><span>Observações pedagógicas <small>(opcional)</small></span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Registre evidências ou encaminhamentos sugeridos." /></label>
                </section>
              )}

              {priority === "nao" && <div className="success-note reveal"><span>✓</span><div><strong>Pronto para salvar.</strong><p>As perguntas adicionais permanecem ocultas.</p></div></div>}
              <div className="form-footer"><p className={status.includes("Não") ? "error" : "saved"} role="status">{status}</p><button className="primary-button" disabled={!priority || saving}>{saving ? "Salvando…" : "Salvar avaliação"}</button></div>
            </form>
          ) : (
            <section className="analytics">
              <div className="section-title"><div><p className="kicker">Visão consolidada</p><h2>Análise das respostas</h2></div><span>Atualização automática</span></div>
              <div className="metric-grid">
                <article><span>Professores participantes</span><strong>{total}</strong><small>Total de avaliações</small></article>
                <article className="blue"><span>Consideram prioritário</span><strong>{pct(priorityCount, total)}%</strong><small>{priorityCount} de {total} professores</small></article>
                <article className="amber"><span>Principal dificuldade</span><strong>{total ? difficulties.reduce((best, item) => studentEvaluations.filter((evaluation) => evaluation[item.id] === 1).length > studentEvaluations.filter((evaluation) => evaluation[best.id] === 1).length ? item : best).title : "—"}</strong><small>Item com mais marcações</small></article>
              </div>

              <article className="chart-card">
                <div className="chart-heading"><div><h3>Dificuldades identificadas</h3><p>Percentual calculado sobre todos os professores que avaliaram o estudante.</p></div><span>Base: {total} {total === 1 ? "professor" : "professores"}</span></div>
                <div className="bars">
                  {difficulties.map((difficulty) => {
                    const count = studentEvaluations.filter((evaluation) => evaluation[difficulty.id] === 1).length;
                    const percentage = pct(count, total);
                    return (
                      <div className="bar-row" key={difficulty.id}>
                        <div><strong>{difficulty.title}</strong><span>{count} de {total}</span></div>
                        <div className="bar-track" aria-label={`${difficulty.title}: ${percentage}%`}><i style={{ width: `${percentage}%` }} /></div>
                        <b>{percentage}%</b>
                      </div>
                    );
                  })}
                </div>
                <p className="chart-note">Como cada professor pode marcar várias alternativas, a soma dos percentuais pode ultrapassar 100%.</p>
              </article>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
