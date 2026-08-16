(async () => {
  const EVALUATIONS_KEY = 'conselho_em_foco_local_avaliacoes_v1';
  const STUDENTS_KEY = 'conselho_em_foco_local_alunos_v2';
  const SESSION_KEY = 'cf_local_teacher_v2';
  const ACTIVE_TERMS = [1, 2, 3];
  const difficulties = [
    { id: 'aprendizagem', title: 'Dificuldades de Aprendizagem', description: 'Problemas para entender e assimilar novos conteúdos.' },
    { id: 'concentracao', title: 'Problemas de Concentração', description: 'Dificuldade em manter o foco durante as aulas ou estudos.' },
    { id: 'tempo', title: 'Gestão de Tempo', description: 'Desafios em organizar o tempo para estudar e cumprir prazos.' },
    { id: 'emocional', title: 'Desafios Emocionais', description: 'Lidar com ansiedade, depressão ou baixa autoestima.' },
    { id: 'relacionamento', title: 'Dificuldades de Relacionamento', description: 'Problemas em interagir com colegas, professores ou familiares.' },
    { id: 'saude', title: 'Problemas de Saúde', description: 'Condições que interferem nos estudos ou na frequência às aulas.' },
    { id: 'disciplina', title: 'Problemas Disciplinares', description: 'Comportamento inadequado ou falta de respeito às regras.' },
    { id: 'assiduidade', title: 'Falta de Assiduidade', description: 'Dificuldade para manter uma frequência escolar regular.' },
  ];

  const data = window.CF_DATA;
  const cloud = await (window.CF_CLOUD_READY || Promise.resolve(window.CF_CLOUD));
  const cloudEnabled = Boolean(cloud?.enabled);
  document.documentElement.dataset.xlsxVersion = window.XLSX?.version || 'missing';
  const $ = (id) => document.getElementById(id);
  const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const percentage = (count, total) => total ? Math.round((count / total) * 100) : 0;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const classById = (id) => data.classes.find((item) => item.id === id);
  const activeClasses = () => data.classes.filter((item) => item.active !== false);
  const classDetails = (id) => {
    const classRecord = classById(id);
    if (classRecord?.className && classRecord?.course) return { className: classRecord.className, course: classRecord.course };
    const sample = data.students.find((student) => student.classId === id);
    if (sample) return { className: sample.className, course: sample.course };
    const label = classById(id)?.label || 'Turma';
    const parts = label.split(' - ');
    return { className: parts[0], course: parts.slice(1).join(' - ') };
  };

  let teacher = loadTeacherSession();
  let evaluations = normalizeEvaluations(loadJson(EVALUATIONS_KEY, []));
  let students = loadStudents();
  let currentTerm = Number(sessionStorage.getItem('cf_local_trimester')) || 2;
  if (!ACTIVE_TERMS.includes(currentTerm)) currentTerm = 2;
  let currentClassId = activeClasses()[0]?.id || '';
  let currentStudentId = activeStudents()[0]?.id || '';
  let reportClassId = currentClassId;
  let currentView = 'evaluate';
  let search = '';
  let prioritySearch = '';
  let priorityClassId = 'all';
  let adminSearch = '';
  let adminClassId = activeClasses()[0]?.id || data.classes[0]?.id || '';
  let adminPhotoData = null;
  let adminPhotoPath = null;
  let pendingSchoolImport = null;
  let cloudRefreshTimer = null;

  function loadJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch { return fallback; }
  }

  function loadTeacherSession() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return parsed && typeof parsed.name === 'string' && typeof parsed.id === 'string' ? parsed : null;
    } catch { return null; }
  }

  function normalizeEvaluations(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({ ...row, trimester: ACTIVE_TERMS.includes(Number(row.trimester)) ? Number(row.trimester) : 2 }));
  }

  function termLabel(term = currentTerm) { return `${term}º trimestre`; }

  function loadStudents() {
    const stored = loadJson(STUDENTS_KEY, null);
    if (Array.isArray(stored) && stored.length) return stored.map((student) => ({ ...student, active: student.active !== false }));
    return data.students.map((student) => ({ ...student, active: true }));
  }

  function persistEvaluations() {
    localStorage.setItem(EVALUATIONS_KEY, JSON.stringify(evaluations));
  }

  function persistStudents() {
    try {
      localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
      return true;
    } catch {
      alert('Não foi possível salvar o cadastro. O armazenamento do navegador pode estar cheio. Exporte um backup e tente usar uma foto menor.');
      return false;
    }
  }

  async function syncFromCloud(render = false) {
    const shared = await cloud.loadData();
    if (shared.classes?.length) data.classes = shared.classes;
    if (shared.students.length) students = shared.students;
    evaluations = normalizeEvaluations(shared.evaluations);
    if (!activeClasses().some((item) => item.id === currentClassId)) currentClassId = activeClasses()[0]?.id || '';
    if (!data.classes.some((item) => item.id === adminClassId)) adminClassId = activeClasses()[0]?.id || data.classes[0]?.id || '';
    if (reportClassId !== 'all' && !data.classes.some((item) => item.id === reportClassId)) reportClassId = currentClassId || 'all';
    if (!currentStudentId || !currentStudent()) setCurrentToFirstInClass();
    if (render) renderAll();
  }

  function scheduleCloudRefresh() {
    clearTimeout(cloudRefreshTimer);
    cloudRefreshTimer = setTimeout(() => {
      syncFromCloud(true).catch(() => {
        $('baseSummary').textContent = 'Falha temporária de sincronização. Verifique a internet.';
      });
    }, 250);
  }

  function activeStudents() { return students.filter((student) => student.active !== false); }
  function teacherKey() { return teacher?.id || ''; }
  function fullNameIsValid(name) {
    const value = name.trim().replace(/\s+/g, ' ');
    const coordinatorProfile = /^[a-z]+_coord$/i.test(value);
    return coordinatorProfile || (value.length >= 5 && value.length <= 120 && value.split(' ').filter(Boolean).length >= 2);
  }
  function studentsInClass(classId, includeInactive = false) {
    const source = includeInactive ? students : activeStudents();
    return source.filter((student) => student.classId === classId).sort((a, b) => Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, 'pt-BR'));
  }
  function classStudents() {
    return studentsInClass(currentClassId).filter((student) => normalize(student.name).includes(normalize(search)));
  }
  function currentStudent() {
    return students.find((student) => student.id === currentStudentId && student.active !== false) || activeStudents()[0] || null;
  }
  function studentEvaluations(studentId = currentStudentId, trimester = currentTerm) {
    return evaluations.filter((evaluation) => evaluation.studentId === studentId && evaluation.trimester === trimester);
  }
  function ownEvaluation() {
    return evaluations.find((evaluation) => evaluation.studentId === currentStudentId && evaluation.teacherKey === teacherKey() && evaluation.trimester === currentTerm);
  }
  function setCurrentToFirstInClass() {
    const first = studentsInClass(currentClassId)[0] || activeStudents()[0];
    currentStudentId = first?.id || '';
    if (first) currentClassId = first.classId;
  }

  function enterApp() {
    $('welcomeScreen')?.classList.add('hidden');
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('userName').textContent = teacher.name;
    const isCoordination = teacher.role === 'coordinator';
    $('userEmail').textContent = isCoordination ? 'Coordenação' : (teacher.role === 'admin' ? 'Administrador' : (cloudEnabled ? 'Professor' : 'Modo local'));
    $('userInitial').textContent = initials(teacher.name).charAt(0) || 'P';
    const isAdmin = !cloudEnabled || teacher.role === 'admin' || isCoordination;
    $('navAnalysis').classList.toggle('hidden', cloudEnabled && !isCoordination);
    $('navPriority').classList.toggle('hidden', cloudEnabled && !isCoordination);
    $('navReport').classList.toggle('hidden', cloudEnabled && !isCoordination);
    $('navAdmin').classList.toggle('hidden', !isAdmin);
    $('backupButton').classList.toggle('hidden', cloudEnabled && !isAdmin);
    $('importInput').closest('label').classList.toggle('hidden', cloudEnabled);
    renderAll();
  }

  function openLoginFromWelcome() {
    $('welcomeScreen')?.classList.add('hidden');
    $('login')?.classList.remove('hidden');
    window.setTimeout(() => $('teacherNameInput')?.focus(), 50);
  }

  const passwordInput = $('schoolCodeInput');
  const passwordToggle = $('togglePassword');
  passwordToggle?.addEventListener('click', () => {
    const showing = passwordInput.type === 'text';
    passwordInput.type = showing ? 'password' : 'text';
    passwordToggle.setAttribute('aria-pressed', String(!showing));
    passwordToggle.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
    passwordToggle.setAttribute('title', showing ? 'Mostrar senha' : 'Ocultar senha');
    const icon = passwordToggle.querySelector('.password-eye');
    if (icon) icon.textContent = showing ? '👁' : '🙈';
    passwordInput.focus({ preventScroll: true });
  });

  $('welcomeEnter')?.addEventListener('click', openLoginFromWelcome);
  $('welcomeScreen')?.addEventListener('click', (event) => {
    if (event.target?.id !== 'welcomeEnter') openLoginFromWelcome();
  });

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('teacherNameInput').value.trim().replace(/\s+/g, ' ');
    const accessCode = $('schoolCodeInput').value.trim().toUpperCase();
    if (!fullNameIsValid(name)) {
      $('loginError').textContent = 'Informe nome e sobrenome ou um perfil da coordenação.';
      return;
    }
    if (accessCode.length < 8) {
      $('loginError').textContent = 'Informe o código de acesso fornecido pela escola.';
      return;
    }
    if (cloudEnabled) {
      $('loginButton').disabled = true;
      $('loginButtonText').textContent = 'Validando acesso...';
      $('loginError').classList.remove('success-message');
      try {
        teacher = await cloud.loginWithCode({ name, accessCode });
        await syncFromCloud(false);
        $('loginError').textContent = '';
        enterApp();
        cloud.subscribe(scheduleCloudRefresh);
      } catch (error) {
        $('loginError').textContent = error.message;
        $('loginButtonText').textContent = 'Entrar na plataforma';
      } finally {
        $('loginButton').disabled = false;
      }
      return;
    }
    teacher = { id: `local:${normalize(name)}`, name, role: 'admin' };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(teacher));
    $('loginError').textContent = '';
    enterApp();
  });

  $('logout').addEventListener('click', async () => {
    try {
      if (cloudEnabled) await cloud.signOut();
      else sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    } catch (error) {
      alert(error.message);
    }
  });

  function openView(view) {
    currentView = view;
    renderView();
  }
  $('navEvaluate').addEventListener('click', () => openView('evaluate'));
  $('navAnalysis').addEventListener('click', () => openView('analysis'));
  $('navPriority').addEventListener('click', () => openView('priority'));
  $('navAdmin').addEventListener('click', () => openView('admin'));
  $('navReport').addEventListener('click', () => openView('report'));

  $('classSelect').addEventListener('change', (event) => {
    currentClassId = event.target.value;
    search = '';
    $('searchInput').value = '';
    setCurrentToFirstInClass();
    renderAll();
  });
  $('searchInput').addEventListener('input', (event) => { search = event.target.value; renderStudentList(); });
  $('priorityClassSelect').addEventListener('change', (event) => { priorityClassId = event.target.value; renderPriorities(); });
  $('prioritySearchInput').addEventListener('input', (event) => { prioritySearch = event.target.value; renderPriorities(); });
  $('termSelect').addEventListener('change', (event) => {
    currentTerm = Number(event.target.value);
    sessionStorage.setItem('cf_local_trimester', String(currentTerm));
    renderAll();
  });
  document.querySelectorAll('input[name="priority"]').forEach((radio) => radio.addEventListener('change', updateConditional));

  function renderBaseSummary() {
    const active = activeStudents().length;
    const inactive = students.length - active;
    $('modeBadge').textContent = cloudEnabled ? 'Sincronizado' : 'Modo local';
    $('modeBadge').classList.toggle('online', cloudEnabled);
    const destination = cloudEnabled ? 'dados compartilhados no Supabase' : 'dados salvos neste navegador';
    $('baseSummary').textContent = `${active} alunos ativos · ${data.classes.length} turmas${inactive ? ` · ${inactive} inativo${inactive === 1 ? '' : 's'}` : ''} · ${destination}`;
    $('termSelect').value = String(currentTerm);
  }

  function classOptions(selectedId, includeAll = false, includeArchived = false) {
    const all = includeAll ? '<option value="all">Todas as turmas</option>' : '';
    const source = includeArchived ? data.classes : activeClasses();
    return all + source.map((item) => {
      const year = item.year ? ` · ${item.year}` : '';
      const archived = item.active === false ? ' · arquivada' : '';
      return `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.label)}${year}${archived} (${studentsInClass(item.id, true).length})</option>`;
    }).join('');
  }

  function renderClassSelect() {
    $('classSelect').innerHTML = classOptions(currentClassId);
    $('classSelect').value = currentClassId;
  }

  function studentPhotoMarkup(student, className = 'mini-photo') {
    return student.photo
      ? `<span class="${className}"><img src="${escapeHtml(student.photo)}" alt=""></span>`
      : `<span class="${className}">${escapeHtml(initials(student.name))}</span>`;
  }

  function renderStudentList() {
    const roster = classStudents();
    if (!roster.length) {
      $('studentList').innerHTML = '<div class="empty-list">Nenhum estudante encontrado.</div>';
      return;
    }
    $('studentList').innerHTML = roster.map((student) => {
      const evaluated = evaluations.some((evaluation) => evaluation.studentId === student.id && evaluation.teacherKey === teacherKey() && evaluation.trimester === currentTerm);
      return `<button type="button" data-id="${student.id}" class="${student.id === currentStudentId ? 'selected' : ''}">${studentPhotoMarkup(student)}<span><strong>${escapeHtml(student.name)}</strong><small>Nº ${student.number} · ${escapeHtml(student.className)}</small></span>${evaluated ? '<i title="Avaliado por você">✓</i>' : ''}</button>`;
    }).join('');
    $('studentList').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      currentStudentId = button.dataset.id;
      renderAll();
    }));
  }

  function renderClassProgress() {
    const roster = studentsInClass(currentClassId);
    const evaluatedIds = new Set(evaluations.filter((evaluation) => evaluation.teacherKey === teacherKey() && evaluation.trimester === currentTerm).map((evaluation) => evaluation.studentId));
    const completed = roster.filter((student) => evaluatedIds.has(student.id)).length;
    const pct = percentage(completed, roster.length);
    $('classProgressText').textContent = `${completed} de ${roster.length} avaliados`;
    $('classProgressPct').textContent = `${pct}%`;
    $('classProgressBar').style.width = `${pct}%`;
  }

  function renderStudentHeader() {
    const student = currentStudent();
    if (!student) return;
    currentStudentId = student.id;
    $('studentContext').textContent = `${student.className} · ${student.course}`;
    $('studentName').textContent = student.name;
    $('studentNumber').textContent = `Número ${student.number} na lista da turma`;
    $('studentInitials').textContent = initials(student.name);
    $('totalResponses').textContent = studentEvaluations().length;
    $('responseLabel').textContent = `respostas · ${currentTerm}º tri`;
    if (student.photo) {
      $('studentPhoto').src = student.photo;
      $('studentPhoto').alt = `Foto de ${student.name}`;
      $('studentPhoto').classList.remove('hidden');
      $('noPhotoLabel').classList.add('hidden');
    } else {
      $('studentPhoto').removeAttribute('src');
      $('studentPhoto').alt = '';
      $('studentPhoto').classList.add('hidden');
      $('noPhotoLabel').classList.remove('hidden');
    }
  }

  function renderForm() {
    if (!currentStudent()) return;
    const own = ownEvaluation();
    $('ownStatus').textContent = own ? `${termLabel()} · atualizado em ${new Date(own.updatedAt).toLocaleString('pt-BR')}` : `${termLabel()} · ainda não avaliado por você`;
    document.querySelectorAll('input[name="priority"]').forEach((radio) => {
      radio.checked = own ? (own.priority ? 'sim' : 'nao') === radio.value : false;
    });
    $('difficultyList').innerHTML = difficulties.map((difficulty) => {
      const checked = !!own?.difficulties?.includes(difficulty.id);
      return `<label class="${checked ? 'selected' : ''}"><input type="checkbox" data-id="${difficulty.id}" ${checked ? 'checked' : ''}><span><strong>${difficulty.title}</strong><small>${difficulty.description}</small></span></label>`;
    }).join('');
    $('difficultyList').querySelectorAll('input').forEach((checkbox) => checkbox.addEventListener('change', () => {
      checkbox.closest('label').classList.toggle('selected', checkbox.checked);
      updateSelectedCount();
    }));
    $('notes').value = own?.notes || '';
    $('saveStatus').textContent = '';
    updateConditional();
  }

  function selectedPriority() { return document.querySelector('input[name="priority"]:checked')?.value || ''; }
  function updateConditional() {
    const priority = selectedPriority();
    $('yesLabel').classList.toggle('selected', priority === 'sim');
    $('noLabel').classList.toggle('selected', priority === 'nao');
    $('noLabel').classList.toggle('no', priority === 'nao');
    $('details').classList.toggle('hidden', priority !== 'sim');
    $('noDetails').classList.toggle('hidden', priority !== 'nao');
    $('saveButton').disabled = !priority;
    updateSelectedCount();
  }
  function updateSelectedCount() {
    const count = $('difficultyList').querySelectorAll('input:checked').length;
    $('selectedCount').textContent = `${count} marcada${count === 1 ? '' : 's'}`;
  }

  $('assessmentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const priority = selectedPriority();
    if (!priority) return;
    const selected = priority === 'sim' ? Array.from($('difficultyList').querySelectorAll('input:checked')).map((input) => input.dataset.id) : [];
    const record = {
      studentId: currentStudentId,
      teacher: teacher.name,
      teacherName: teacher.name,
      teacherEmail: '',
      teacherKey: teacherKey(),
      trimester: currentTerm,
      priority: priority === 'sim',
      difficulties: selected,
      notes: priority === 'sim' ? $('notes').value.trim() : '',
      updatedAt: new Date().toISOString(),
    };
    $('saveButton').disabled = true;
    $('saveStatus').textContent = cloudEnabled ? 'Sincronizando avaliação...' : 'Salvando avaliação...';
    try {
      const saved = cloudEnabled ? await cloud.saveEvaluation(record) : record;
      evaluations = evaluations.filter((evaluation) => !(evaluation.studentId === currentStudentId && evaluation.teacherKey === teacherKey() && evaluation.trimester === currentTerm));
      evaluations.push(saved);
      if (!cloudEnabled) persistEvaluations();
    } catch (error) {
      $('saveStatus').textContent = `Não foi possível salvar: ${error.message}`;
      $('saveButton').disabled = false;
      return;
    }
    $('saveStatus').textContent = cloudEnabled ? 'Avaliação sincronizada com sucesso.' : 'Avaliação salva. Os gráficos e a lista de prioritários foram atualizados.';
    renderStudentList();
    renderClassProgress();
    renderStudentHeader();
    setTimeout(goNext, 350);
  });

  function moveStudent(offset) {
    const roster = studentsInClass(currentClassId);
    if (!roster.length) return;
    const index = Math.max(0, roster.findIndex((student) => student.id === currentStudentId));
    const next = roster[Math.min(roster.length - 1, Math.max(0, index + offset))];
    currentStudentId = next.id;
    renderAll();
  }
  function goNext() { moveStudent(1); }
  $('previousButton').addEventListener('click', () => moveStudent(-1));

  function analysisFor(studentId) {
    const rows = studentEvaluations(studentId);
    const total = rows.length;
    const priorityCount = rows.filter((row) => row.priority).length;
    const counts = Object.fromEntries(difficulties.map((difficulty) => [difficulty.id, rows.filter((row) => row.difficulties?.includes(difficulty.id)).length]));
    const main = total && Math.max(...Object.values(counts)) > 0 ? difficulties.reduce((best, item) => counts[item.id] > counts[best.id] ? item : best) : null;
    return { rows, total, priorityCount, counts, main, priorityPct: percentage(priorityCount, total) };
  }

  function renderAnalysis() {
    const result = analysisFor(currentStudentId);
    $('metricTotal').textContent = result.total;
    $('metricPriority').textContent = `${result.priorityPct}%`;
    $('priorityDetail').textContent = `${result.priorityCount} de ${result.total} professores`;
    $('metricMain').textContent = result.main?.title || '—';
    $('chartBase').textContent = `${termLabel()} · base: ${result.total} professor${result.total === 1 ? '' : 'es'}`;
    $('bars').innerHTML = difficulties.map((difficulty) => {
      const count = result.counts[difficulty.id];
      const pct = percentage(count, result.total);
      return `<div class="bar-row"><div><strong>${difficulty.title}</strong><span>${count} de ${result.total}</span></div><div class="bar-track" aria-label="${difficulty.title}: ${pct}%"><i style="width:${pct}%"></i></div><b>${pct}%</b></div>`;
    }).join('');

    const rows = [...result.rows].sort((a, b) => (a.teacherName || a.teacher || '').localeCompare(b.teacherName || b.teacher || '', 'pt-BR'));
    if (!rows.length) {
      $('teacherEvaluations').innerHTML = '<div class="evaluation-empty">Nenhuma avaliação registrada para este estudante neste trimestre.</div>';
    } else {
      $('teacherEvaluations').innerHTML = rows.map((row) => {
        const teacherName = row.teacherName || row.teacher || 'Professor';
        const priorityLabel = row.priority ? 'Prioritário' : 'Não prioritário';
        const difficultyCount = Array.isArray(row.difficulties) ? row.difficulties.length : 0;
        const updated = row.updatedAt ? new Date(row.updatedAt).toLocaleString('pt-BR') : '—';
        const canDelete = !cloudEnabled || teacher?.role === 'coordinator' || row.teacherKey === teacherKey();
        return `<div class="teacher-evaluation-row">
          <div class="teacher-evaluation-main"><strong>${escapeHtml(teacherName)}</strong><span>${escapeHtml(priorityLabel)} · ${difficultyCount} dificuldade${difficultyCount === 1 ? '' : 's'} marcada${difficultyCount === 1 ? '' : 's'}</span><small>Atualizada em ${escapeHtml(updated)}</small></div>
          ${canDelete ? `<button type="button" class="secondary danger delete-evaluation-button" data-evaluation-id="${escapeHtml(row.id || '')}" data-teacher-key="${escapeHtml(row.teacherKey || '')}">Excluir avaliação</button>` : ''}
        </div>`;
      }).join('');
    }
    $('teacherEvaluationStatus').textContent = '';
    $('teacherEvaluations').querySelectorAll('.delete-evaluation-button').forEach((button) => button.addEventListener('click', async () => {
      const evaluationId = button.dataset.evaluationId;
      const teacherKeyValue = button.dataset.teacherKey;
      const row = rows.find((item) => (item.id && item.id === evaluationId) || (!item.id && item.teacherKey === teacherKeyValue));
      if (!row) return;
      const teacherName = row.teacherName || row.teacher || 'este professor';
      const student = currentStudent();
      if (!confirm(`Excluir a avaliação de ${teacherName} para ${student?.name || 'este estudante'} no ${termLabel()}?\n\nEsta ação remove somente essa avaliação.`)) return;
      button.disabled = true;
      $('teacherEvaluationStatus').textContent = 'Excluindo avaliação...';
      try {
        if (cloudEnabled) {
          if (!row.id) throw new Error('Identificador da avaliação não encontrado.');
          await cloud.deleteEvaluation(row.id);
        }
        evaluations = evaluations.filter((item) => item !== row && !(row.id && item.id === row.id));
        if (!cloudEnabled) persistEvaluations();
        renderStudentList();
        renderClassProgress();
        renderStudentHeader();
        renderAnalysis();
        $('teacherEvaluationStatus').textContent = 'Avaliação excluída com sucesso.';
      } catch (error) {
        $('teacherEvaluationStatus').textContent = `Não foi possível excluir: ${error.message}`;
        button.disabled = false;
      }
    }));
  }

  function renderPriorities() {
    $('priorityClassSelect').innerHTML = classOptions(priorityClassId, true);
    $('priorityClassSelect').value = priorityClassId;
    $('priorityCopy').textContent = `Aparecem aqui os alunos ativos que receberam pelo menos uma indicação de prioridade no ${termLabel()}.`;
    const rows = activeStudents().map((student) => ({ student, analysis: analysisFor(student.id) }))
      .filter((item) => item.analysis.priorityCount > 0)
      .filter((item) => priorityClassId === 'all' || item.student.classId === priorityClassId)
      .filter((item) => normalize(item.student.name).includes(normalize(prioritySearch)))
      .sort((a, b) => b.analysis.priorityPct - a.analysis.priorityPct || b.analysis.priorityCount - a.analysis.priorityCount || a.student.name.localeCompare(b.student.name, 'pt-BR'));
    $('priorityCount').textContent = `${rows.length} aluno${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      $('priorityList').innerHTML = `<div class="card empty-state"><strong>Nenhum aluno prioritário neste filtro.</strong><p>O aluno aparecerá aqui assim que pelo menos um professor marcar “Sim” no ${termLabel()}.</p></div>`;
      return;
    }
    $('priorityList').innerHTML = rows.map(({ student, analysis }) => {
      const main = analysis.main?.title || 'Sem dificuldade marcada';
      return `<button type="button" class="priority-card" data-id="${student.id}">${studentPhotoMarkup(student, 'priority-photo')}<span class="priority-info"><small>${escapeHtml(student.className)} · ${escapeHtml(student.course)}</small><strong>${escapeHtml(student.name)}</strong><em>${escapeHtml(main)}</em></span><span class="priority-score"><strong>${analysis.priorityPct}%</strong><small>${analysis.priorityCount} de ${analysis.total} professor${analysis.total === 1 ? '' : 'es'}</small><i>Ver análise →</i></span></button>`;
    }).join('');
    $('priorityList').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      const student = students.find((item) => item.id === button.dataset.id);
      if (!student) return;
      currentStudentId = student.id;
      currentClassId = student.classId;
      openView('analysis');
      renderAll();
    }));
  }

  function renderAdminSelectors() {
    $('adminClassSelect').innerHTML = classOptions(adminClassId, false, true);
    $('adminClassSelect').value = adminClassId;
    $('adminStudentClassInput').innerHTML = activeClasses().map((item) => `<option value="${item.id}">${escapeHtml(item.label)}${item.year ? ` · ${item.year}` : ''}</option>`).join('');
  }

  function renderAdminList() {
    const includeInactive = $('showInactiveInput').checked;
    const roster = studentsInClass(adminClassId, true)
      .filter((student) => includeInactive || student.active !== false)
      .filter((student) => normalize(student.name).includes(normalize(adminSearch)));
    if (!roster.length) {
      $('adminStudentList').innerHTML = '<div class="empty-list">Nenhum aluno encontrado.</div>';
      return;
    }
    $('adminStudentList').innerHTML = roster.map((student) => `<button type="button" data-id="${student.id}" class="${student.active === false ? 'inactive' : ''}">${studentPhotoMarkup(student)}<span><strong>${escapeHtml(student.name)}</strong><small>Nº ${student.number}${student.active === false ? ' · Inativo' : ''}</small></span></button>`).join('');
    $('adminStudentList').querySelectorAll('button').forEach((button) => button.addEventListener('click', () => loadStudentForm(button.dataset.id)));
  }

  function showAdminPhoto(photo, name = '') {
    if (photo) $('adminPhotoPreview').innerHTML = `<img src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(name)}">`;
    else $('adminPhotoPreview').innerHTML = `<span>${escapeHtml(initials(name) || 'Foto')}</span>`;
  }

  function resetStudentForm() {
    $('studentForm').reset();
    $('adminStudentId').value = '';
    $('studentFormTitle').textContent = 'Novo aluno';
    $('studentActiveBadge').classList.add('hidden');
    $('toggleStudentButton').classList.add('hidden');
    $('deleteStudentButton').classList.add('hidden');
    $('studentFormStatus').textContent = '';
    $('adminStudentClassInput').value = adminClassId;
    const nextNumber = Math.max(0, ...studentsInClass(adminClassId, true).map((student) => Number(student.number) || 0)) + 1;
    $('adminNumberInput').value = nextNumber;
    adminPhotoData = null;
    adminPhotoPath = null;
    showAdminPhoto(null);
  }

  function loadStudentForm(id) {
    const student = students.find((item) => item.id === id);
    if (!student) return;
    $('adminStudentId').value = student.id;
    $('studentFormTitle').textContent = student.name;
    $('adminNameInput').value = student.name;
    $('adminNumberInput').value = student.number;
    $('adminStudentClassInput').value = student.classId;
    $('studentActiveBadge').textContent = student.active === false ? 'Inativo' : 'Ativo';
    $('studentActiveBadge').className = `status-badge ${student.active === false ? 'inactive' : ''}`;
    $('toggleStudentButton').textContent = student.active === false ? 'Reativar aluno' : 'Arquivar aluno';
    $('toggleStudentButton').classList.remove('hidden');
    $('deleteStudentButton').classList.remove('hidden');
    $('studentFormStatus').textContent = '';
    adminPhotoData = student.photo || null;
    adminPhotoPath = student.photoPath || null;
    showAdminPhoto(adminPhotoData, student.name);
  }

  function renderAdmin() {
    renderAdminSelectors();
    renderAdminList();
    renderAnnualManagement();
  }

  function renderAnnualManagement() {
    const activeYears = [...new Set(activeClasses().map((item) => item.year).filter(Boolean))].sort((a, b) => b - a);
    $('archiveYearSelect').innerHTML = activeYears.map((year) => `<option value="${year}">${year}</option>`).join('');
    $('archiveYearButton').disabled = !activeYears.length || !cloudEnabled;
    const grouped = new Map();
    data.classes.forEach((item) => {
      const year = item.year || 'Sem ano';
      const group = grouped.get(year) || { active: 0, archived: 0 };
      if (item.active === false) group.archived += 1;
      else group.active += 1;
      grouped.set(year, group);
    });
    $('classYearSummary').innerHTML = [...grouped.entries()].sort((a, b) => Number(b[0]) - Number(a[0])).map(([year, counts]) => {
      const archived = counts.active === 0;
      return `<span class="${archived ? 'archived' : ''}">${year}: ${counts.active} ativa(s)${counts.archived ? ` · ${counts.archived} arquivada(s)` : ''}</span>`;
    }).join('');
  }

  function reportStudents() {
    const source = reportClassId === 'all' ? activeStudents() : students;
    return source
      .filter((student) => reportClassId === 'all' || student.classId === reportClassId)
      .sort((a, b) => a.classId.localeCompare(b.classId) || Number(a.number) - Number(b.number) || a.name.localeCompare(b.name, 'pt-BR'));
  }

  function renderReport() {
    $('reportClassSelect').innerHTML = classOptions(reportClassId, true, true);
    $('reportClassSelect').value = reportClassId;
    const roster = reportStudents();
    const analyses = roster.map((student) => ({ student, analysis: analysisFor(student.id) }));
    const evaluated = analyses.filter(({ analysis }) => analysis.total > 0).length;
    const totalResponses = analyses.reduce((sum, { analysis }) => sum + analysis.total, 0);
    const priorities = analyses.filter(({ analysis }) => analysis.priorityCount > 0).length;
    const includeNotes = $('reportNotesInput').checked;
    const summary = `<div class="report-summary"><article><span>Alunos no relatório</span><strong>${roster.length}</strong></article><article><span>Alunos avaliados</span><strong>${evaluated}</strong></article><article><span>Avaliações registradas</span><strong>${totalResponses}</strong></article><article><span>Com indicação prioritária</span><strong>${priorities}</strong></article></div>`;
    const classes = data.classes
      .filter((item) => reportClassId === 'all' || item.id === reportClassId)
      .map((item) => {
        const rows = analyses.filter(({ student }) => student.classId === item.id);
        if (!rows.length) return '';
        const studentCards = rows.map(({ student, analysis }) => {
          const difficultyChips = difficulties.map((difficulty) => {
            const count = analysis.counts[difficulty.id];
            if (!count) return '';
            return `<span class="report-chip">${escapeHtml(difficulty.title)} <b>${count}/${analysis.total}</b></span>`;
          }).join('') || '<span class="report-empty">Nenhuma dificuldade marcada.</span>';
          const notes = includeNotes ? analysis.rows.filter((row) => row.notes).map((row) => `<li><b>${escapeHtml(row.teacherName || row.teacher)}:</b> ${escapeHtml(row.notes)}</li>`).join('') : '';
          return `<article class="card report-student"><div class="report-student-head"><div><h4>${escapeHtml(student.name)}<small>Nº ${student.number} · ${escapeHtml(student.className)} · ${escapeHtml(student.course)}</small></h4></div><div class="report-stat"><span>Respostas</span><strong>${analysis.total}</strong></div><div class="report-stat"><span>Prioritário</span><strong>${analysis.priorityPct}%</strong></div><div class="report-stat"><span>Principal dificuldade</span><strong>${escapeHtml(analysis.main?.title || '—')}</strong></div></div><div class="report-detail"><div class="report-difficulties">${difficultyChips}</div>${notes ? `<div class="report-notes"><strong>Observações pedagógicas</strong><ul>${notes}</ul></div>` : ''}</div></article>`;
        }).join('');
        return `<section class="report-class"><div class="report-class-header"><h3>${escapeHtml(item.label)}</h3><span>${rows.length} alunos · ${termLabel()}</span></div><div class="report-students">${studentCards}</div></section>`;
      }).join('');
    $('reportContent').innerHTML = summary + (classes || '<div class="card empty-state"><strong>Nenhum aluno encontrado.</strong></div>');
  }

  function csvCell(value) {
    let text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadReportCsv() {
    const header = ['Trimestre', 'Turma', 'Curso', 'Número', 'Aluno', 'Total de respostas', 'Percentual prioritário', 'Principal dificuldade', 'Professor', 'Prioritário', 'Dificuldades', 'Observações', 'Atualizado em'];
    const rows = [header];
    reportStudents().forEach((student) => {
      const analysis = analysisFor(student.id);
      const entries = analysis.rows.length ? analysis.rows : [null];
      entries.forEach((evaluation) => rows.push([
        termLabel(), student.className, student.course, student.number, student.name,
        analysis.total, `${analysis.priorityPct}%`, analysis.main?.title || '',
        evaluation?.teacherName || '',
        evaluation ? (evaluation.priority ? 'Sim' : 'Não') : '',
        evaluation?.difficulties?.map((id) => difficulties.find((item) => item.id === id)?.title || id).join(' | ') || '',
        evaluation?.notes || '', evaluation?.updatedAt ? new Date(evaluation.updatedAt).toLocaleString('pt-BR') : '',
      ]));
    });
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    const classSuffix = reportClassId === 'all' ? 'todas-as-turmas' : reportClassId;
    link.href = url;
    link.download = `conselho-em-foco-${currentTerm}tri-${classSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  $('reportClassSelect').addEventListener('change', (event) => { reportClassId = event.target.value; renderReport(); });
  $('reportNotesInput').addEventListener('change', renderReport);
  $('csvReportButton').addEventListener('click', downloadReportCsv);
  $('printReportButton').addEventListener('click', () => window.print());

  $('adminClassSelect').addEventListener('change', (event) => {
    adminClassId = event.target.value;
    adminSearch = '';
    $('adminSearchInput').value = '';
    renderAdminList();
    resetStudentForm();
  });
  $('adminSearchInput').addEventListener('input', (event) => { adminSearch = event.target.value; renderAdminList(); });
  $('showInactiveInput').addEventListener('change', renderAdminList);
  $('newStudentButton').addEventListener('click', resetStudentForm);
  $('removePhotoButton').addEventListener('click', () => {
    adminPhotoData = null;
    adminPhotoPath = null;
    showAdminPhoto(null, $('adminNameInput').value);
    $('adminPhotoInput').value = '';
  });
  $('adminNameInput').addEventListener('input', () => { if (!adminPhotoData) showAdminPhoto(null, $('adminNameInput').value); });

  function resizePhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const maxWidth = 420;
          const maxHeight = 520;
          const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $('adminPhotoInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecione uma imagem válida.'); return; }
    try {
      adminPhotoData = await resizePhoto(file);
      showAdminPhoto(adminPhotoData, $('adminNameInput').value);
    } catch { alert('Não foi possível processar esta imagem.'); }
  });

  $('studentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('adminStudentId').value;
    const previousStudent = id ? students.find((student) => student.id === id) : null;
    const classId = $('adminStudentClassInput').value;
    const detail = classDetails(classId);
    const entry = {
      id: id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number: Number($('adminNumberInput').value),
      name: $('adminNameInput').value.trim(),
      nameOriginal: $('adminNameInput').value.trim().toUpperCase(),
      classId,
      className: detail.className,
      course: detail.course,
      photo: adminPhotoData,
      photoPath: adminPhotoPath,
      previousPhotoPath: previousStudent?.photoPath || null,
      active: id ? students.find((student) => student.id === id)?.active !== false : true,
    };
    if (!entry.name || !entry.number || !classId) return;
    const previousStudents = students.map((student) => ({ ...student }));
    try {
      const saved = cloudEnabled ? await cloud.saveStudent(entry) : entry;
      if (id) students = students.map((student) => student.id === id ? saved : student);
      else students.push(saved);
      if (!cloudEnabled && !persistStudents()) { students = previousStudents; return; }
    } catch (error) {
      $('studentFormStatus').textContent = `Não foi possível salvar: ${error.message}`;
      return;
    }
    adminClassId = classId;
    currentClassId = classId;
    currentStudentId = entry.id;
    renderBaseSummary();
    renderClassSelect();
    renderAdminSelectors();
    renderAdminList();
    loadStudentForm(entry.id);
    $('studentFormStatus').textContent = id ? 'Alterações salvas.' : 'Aluno incluído com sucesso.';
  });

  $('toggleStudentButton').addEventListener('click', async () => {
    const id = $('adminStudentId').value;
    const index = students.findIndex((student) => student.id === id);
    if (index < 0) return;
    const willDeactivate = students[index].active !== false;
    if (willDeactivate && !confirm(`Arquivar ${students[index].name}? As avaliações serão preservadas.`)) return;
    const previous = { ...students[index] };
    students[index] = { ...students[index], active: !willDeactivate };
    try {
      if (cloudEnabled) students[index] = await cloud.saveStudent(students[index]);
      else if (!persistStudents()) { students[index] = previous; return; }
    } catch (error) {
      students[index] = previous;
      alert(`Não foi possível alterar o aluno: ${error.message}`);
      return;
    }
    if (willDeactivate && currentStudentId === id) setCurrentToFirstInClass();
    renderBaseSummary();
    renderAdminList();
    loadStudentForm(id);
  });

  $('deleteStudentButton').addEventListener('click', async () => {
    const id = $('adminStudentId').value;
    const student = students.find((item) => item.id === id);
    if (!student) return;
    if (evaluations.some((evaluation) => evaluation.studentId === id)) {
      alert('Este aluno possui avaliações e não pode ser excluído definitivamente. Use “Arquivar aluno” para preservar o histórico.');
      return;
    }
    if (!confirm(`Excluir definitivamente ${student.name}? Esta ação não poderá ser desfeita.`)) return;
    try {
      if (cloudEnabled) await cloud.deleteStudent(student);
      students = students.filter((item) => item.id !== id);
      if (!cloudEnabled) persistStudents();
      setCurrentToFirstInClass();
      renderAll();
      renderAdmin();
      resetStudentForm();
    } catch (error) {
      alert(`Não foi possível excluir. Se houver avaliações históricas, arquive o aluno.\n\n${error.message}`);
    }
  });

  function importHeader(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function importSlug(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55);
  }

  function rowValue(row, aliases) {
    const entries = Object.entries(row).map(([key, value]) => [importHeader(key), value]);
    for (const alias of aliases) {
      const found = entries.find(([key]) => key === alias);
      if (found && String(found[1] ?? '').trim()) return String(found[1]).trim();
    }
    return '';
  }

  async function parseSchoolWorkbook(file) {
    if (!window.XLSX) throw new Error('O leitor de Excel não foi carregado. Atualize a página e tente novamente.');
    const workbook = window.XLSX.read(await file.arrayBuffer());
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
    if (!rows.length) throw new Error('A primeira aba da planilha está vazia.');
    const classes = new Map();
    const importedStudents = [];
    const errors = [];
    const seenNumbers = new Set();

    rows.forEach((row, index) => {
      const line = index + 2;
      const year = Number(rowValue(row, ['ano_letivo', 'ano']));
      const className = rowValue(row, ['turma', 'nome_turma']);
      const course = rowValue(row, ['curso']);
      const number = Number(rowValue(row, ['numero', 'n_chamada', 'numero_chamada']));
      const name = rowValue(row, ['aluno', 'nome_aluno', 'nome']);
      if (!year || year < 2020 || year > 2100 || !className || !course || !number || number < 1 || !name) {
        errors.push(`Linha ${line}: preencha ano_letivo, turma, curso, numero e aluno.`);
        return;
      }
      const classId = rowValue(row, ['id_turma', 'id_turma_opcional']) || `y${year}-${importSlug(className)}-${importSlug(course)}`;
      const studentId = rowValue(row, ['id_aluno', 'id_aluno_opcional']) || `${classId}-s${String(number).padStart(3, '0')}`;
      const duplicateKey = `${classId}:${number}`;
      if (seenNumbers.has(duplicateKey)) {
        errors.push(`Linha ${line}: número ${number} repetido na turma ${className}.`);
        return;
      }
      seenNumbers.add(duplicateKey);
      classes.set(classId, {
        id: classId,
        label: `${className} - ${course}`,
        className,
        course,
        year,
        active: true,
      });
      importedStudents.push({
        id: studentId,
        number,
        name,
        nameOriginal: name.toUpperCase(),
        classId,
        className,
        course,
        photo: null,
        photoPath: null,
        active: true,
      });
    });

    if (errors.length) throw new Error(errors.slice(0, 12).join('\n'));
    if (!importedStudents.length) throw new Error('Nenhum aluno válido foi encontrado.');
    return { classes: [...classes.values()], students: importedStudents };
  }

  $('classImportInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    pendingSchoolImport = null;
    $('importClassesButton').disabled = true;
    if (!file) return;
    $('classImportStatus').textContent = 'Lendo a planilha...';
    try {
      pendingSchoolImport = await parseSchoolWorkbook(file);
      const years = [...new Set(pendingSchoolImport.classes.map((item) => item.year))].sort().join(', ');
      $('classImportStatus').textContent = `${pendingSchoolImport.classes.length} turma(s) e ${pendingSchoolImport.students.length} aluno(s) prontos para importar · ano(s): ${years}.`;
      $('importClassesButton').disabled = false;
    } catch (error) {
      $('classImportStatus').textContent = `Planilha inválida: ${error.message}`;
    }
  });

  $('importClassesButton').addEventListener('click', async () => {
    if (!pendingSchoolImport || !cloudEnabled) return;
    const { classes, students: importedStudents } = pendingSchoolImport;
    if (!confirm(`Importar ${classes.length} turma(s) e ${importedStudents.length} aluno(s) para o Supabase?`)) return;
    $('importClassesButton').disabled = true;
    $('classImportStatus').textContent = 'Importando turmas e alunos...';
    try {
      await cloud.importSchoolData(pendingSchoolImport);
      await syncFromCloud(false);
      $('classImportStatus').textContent = 'Importação concluída com sucesso.';
      pendingSchoolImport = null;
      $('classImportInput').value = '';
      renderAll();
      renderAdmin();
    } catch (error) {
      $('classImportStatus').textContent = `Não foi possível importar: ${error.message}`;
      $('importClassesButton').disabled = false;
    }
  });

  $('archiveYearButton').addEventListener('click', async () => {
    const year = Number($('archiveYearSelect').value);
    if (!year || !cloudEnabled) return;
    if (!confirm(`Arquivar todas as turmas e alunos de ${year}? As avaliações serão preservadas e continuarão disponíveis à coordenação nos relatórios.`)) return;
    $('archiveYearButton').disabled = true;
    $('classImportStatus').textContent = `Arquivando ${year}...`;
    try {
      await cloud.archiveSchoolYear(year);
      await syncFromCloud(false);
      $('classImportStatus').textContent = `Ano letivo ${year} arquivado com sucesso.`;
      renderAll();
      renderAdmin();
    } catch (error) {
      $('classImportStatus').textContent = `Não foi possível arquivar: ${error.message}`;
      $('archiveYearButton').disabled = false;
    }
  });

  function renderView() {
    const studentView = currentView === 'evaluate' || currentView === 'analysis';
    $('workspace').classList.toggle('wide-workspace', !studentView);
    $('sidebar').classList.toggle('hidden', !studentView);
    $('studentHeader').classList.toggle('hidden', !studentView);
    $('evaluateView').classList.toggle('hidden', currentView !== 'evaluate');
    $('analysisView').classList.toggle('hidden', currentView !== 'analysis');
    $('priorityView').classList.toggle('hidden', currentView !== 'priority');
    $('adminView').classList.toggle('hidden', currentView !== 'admin');
    $('reportView').classList.toggle('hidden', currentView !== 'report');
    ['Evaluate', 'Analysis', 'Priority', 'Admin', 'Report'].forEach((name) => $(`nav${name}`).classList.toggle('active', currentView === name.toLowerCase()));
    if (currentView === 'analysis') renderAnalysis();
    if (currentView === 'priority') renderPriorities();
    if (currentView === 'admin') renderAdmin();
    if (currentView === 'report') renderReport();
  }

  function renderAll() {
    if (!currentStudentId || !currentStudent()) setCurrentToFirstInClass();
    renderBaseSummary();
    renderClassSelect();
    renderStudentList();
    renderClassProgress();
    renderStudentHeader();
    renderForm();
    renderView();
  }

  $('backupButton').addEventListener('click', () => {
    const payload = { version: 3, exportedAt: new Date().toISOString(), evaluations, students };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conselho-em-foco-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  $('importInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const v1 = payload.version === 1 && Array.isArray(payload.evaluations);
      const v2 = payload.version === 2 && Array.isArray(payload.evaluations) && Array.isArray(payload.students);
      const v3 = payload.version === 3 && Array.isArray(payload.evaluations) && Array.isArray(payload.students);
      if (!v1 && !v2 && !v3) throw new Error('Formato inválido');
      const message = v3
        ? `Substituir avaliações por trimestre e cadastro de alunos pelos dados deste backup?`
        : `Este backup é anterior à divisão por trimestre. As avaliações serão importadas para o 2º trimestre. Deseja continuar?`;
      if (!confirm(message)) return;
      evaluations = normalizeEvaluations(payload.evaluations);
      persistEvaluations();
      if (v2 || v3) {
        students = payload.students.map((student) => ({ ...student, active: student.active !== false }));
        persistStudents();
      }
      setCurrentToFirstInClass();
      renderAll();
      alert('Backup importado com sucesso.');
    } catch { alert('O arquivo selecionado não é um backup válido do Conselho em Foco.'); }
    event.target.value = '';
  });

  resetStudentForm();
  if (cloudEnabled) {
    $('loginButtonText').textContent = 'Entrar na plataforma';
    $('loginIntro').textContent = 'Use seu nome completo e a senha fornecida pela escola.';
    $('loginHelp').innerHTML = 'Não é necessário e-mail. Sua sessão fica salva neste navegador.';
    try {
      teacher = await cloud.getTeacher();
      if (teacher) {
        await syncFromCloud(false);
        enterApp();
        cloud.subscribe(scheduleCloudRefresh);
      }
    } catch (error) {
      $('loginError').textContent = `Não foi possível conectar: ${error.message}`;
    }
  } else if (teacher && fullNameIsValid(teacher.name) && teacher.id) {
    teacher.role = 'admin';
    enterApp();
  } else if (teacher) {
    sessionStorage.removeItem(SESSION_KEY);
  }
  if (cloud?.setupError) $('loginError').textContent = cloud.setupError;
})();
