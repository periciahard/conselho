window.CF_CLOUD_READY = (async () => {
  const config = window.CF_SUPABASE_CONFIG || {};
  const configured = Boolean(config.url && config.publishableKey);
  let setupError = '';
  if (configured && !window.supabase?.createClient) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Não foi possível carregar a biblioteca do Supabase.'));
        document.head.appendChild(script);
      });
    } catch (error) {
      setupError = error.message;
    }
  }
  const enabled = Boolean(configured && window.supabase?.createClient);
  const client = enabled
    ? window.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
  let currentUser = null;
  let channel = null;
  const PHOTO_BUCKET = 'student-photos';
  const PHOTO_URL_TTL = 3600;

  function throwIfError(error) {
    if (error) throw new Error(error.message || 'Erro de comunicação com o Supabase.');
  }

  function normalizePhotoPath(value, classId) {
    if (!value) return null;
    if (/^(data:|blob:|https?:)/i.test(value)) return null;
    const filename = String(value).replace(/\\/g, '/').split('/').pop();
    return String(value).startsWith('assets/photos/') ? `${classId}/${filename}` : String(value);
  }

  function mapStudent(row) {
    const photoPath = normalizePhotoPath(row.photo, row.class_id);
    return {
      id: row.id,
      number: Number(row.number),
      name: row.name,
      nameOriginal: row.name_original || row.name?.toUpperCase(),
      classId: row.class_id,
      className: row.class_name,
      course: row.course,
      photo: null,
      photoPath,
      active: row.active !== false,
    };
  }

  function studentRow(student, photoPath = student.photoPath || null) {
    return {
      id: student.id,
      number: Number(student.number),
      name: student.name,
      name_original: student.nameOriginal || student.name?.toUpperCase(),
      class_id: student.classId,
      class_name: student.className,
      course: student.course,
      photo: photoPath,
      active: student.active !== false,
      updated_by: currentUser?.id || null,
    };
  }

  function mapEvaluation(row) {
    return {
      id: row.id,
      studentId: row.student_id,
      teacherId: row.teacher_id,
      teacher: row.teacher_name,
      teacherName: row.teacher_name,
      teacherEmail: '',
      teacherKey: row.teacher_id,
      trimester: Number(row.trimester),
      priority: Boolean(row.priority),
      difficulties: Array.isArray(row.difficulties) ? row.difficulties : [],
      notes: row.notes || '',
      updatedAt: row.updated_at,
    };
  }

  function mapClass(row) {
    return {
      id: row.id,
      label: row.label,
      className: row.class_name,
      course: row.course,
      year: Number(row.school_year),
      active: row.active !== false,
      archivedAt: row.archived_at || null,
    };
  }

  async function hydratePhotoUrls(students) {
    const targets = students.filter((student) => student.photoPath);
    for (let offset = 0; offset < targets.length; offset += 75) {
      const chunk = targets.slice(offset, offset + 75);
      const { data, error } = await client.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(chunk.map((student) => student.photoPath), PHOTO_URL_TTL);
      if (error) {
        console.warn('Não foi possível carregar um lote de fotos privadas.', error);
        continue;
      }
      (data || []).forEach((item, index) => {
        if (item?.signedUrl) chunk[index].photo = item.signedUrl;
      });
    }
    return students;
  }

  async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error('Não foi possível preparar a foto para envio.');
    return response.blob();
  }

  async function signStudentPhoto(student) {
    if (!student.photoPath) return student;
    const { data, error } = await client.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(student.photoPath, PHOTO_URL_TTL);
    if (!error && data?.signedUrl) student.photo = data.signedUrl;
    return student;
  }

  async function loginWithCode({ name, accessCode }) {
    if (!enabled) throw new Error('O Supabase ainda não foi configurado.');
    let sessionResult = await client.auth.getSession();
    throwIfError(sessionResult.error);
    if (!sessionResult.data.session) {
      const anonymousResult = await client.auth.signInAnonymously();
      throwIfError(anonymousResult.error);
      sessionResult = await client.auth.getSession();
      throwIfError(sessionResult.error);
    }
    currentUser = sessionResult.data.session?.user || null;
    if (!currentUser) throw new Error('Não foi possível criar sua sessão de acesso.');
    const { error } = await client.rpc('join_with_access_code', {
      p_full_name: name,
      p_access_code: accessCode,
    });
    if (error) {
      const message = /codigo|code/i.test(error.message || '')
        ? 'Código da escola incorreto.'
        : error.message;
      throw new Error(message || 'Não foi possível validar o acesso.');
    }
    return getTeacher();
  }

  async function getTeacher() {
    if (!enabled) return null;
    const { data, error } = await client.auth.getSession();
    throwIfError(error);
    const user = data.session?.user;
    if (!user) return null;
    currentUser = user;
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id,full_name,role')
      .eq('id', user.id)
      .maybeSingle();
    throwIfError(profileError);
    if (!profile) return null;
    return {
      id: user.id,
      name: profile.full_name,
      role: profile.role || 'teacher',
    };
  }

  async function loadData() {
    if (!enabled || !currentUser) throw new Error('Sessão não autenticada.');
    const [classResult, studentResult, evaluationResult] = await Promise.all([
      client.from('classes').select('*').order('school_year', { ascending: false }).order('label'),
      client.from('students').select('*').order('class_id').order('number'),
      client.from('evaluations').select('*'),
    ]);
    throwIfError(classResult.error);
    throwIfError(studentResult.error);
    throwIfError(evaluationResult.error);
    const students = await hydratePhotoUrls((studentResult.data || []).map(mapStudent));
    return {
      classes: (classResult.data || []).map(mapClass),
      students,
      evaluations: (evaluationResult.data || []).map(mapEvaluation),
    };
  }

  async function saveEvaluation(record) {
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente.');
    const row = {
      student_id: record.studentId,
      teacher_id: currentUser.id,
      teacher_name: record.teacherName,
      trimester: Number(record.trimester),
      priority: Boolean(record.priority),
      difficulties: record.difficulties || [],
      notes: record.notes || '',
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client
      .from('evaluations')
      .upsert(row, { onConflict: 'student_id,teacher_id,trimester' })
      .select()
      .single();
    throwIfError(error);
    return mapEvaluation(data);
  }

  async function deleteEvaluation(evaluationId) {
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente.');
    if (!evaluationId) throw new Error('Avaliação inválida.');
    const { error } = await client.from('evaluations').delete().eq('id', evaluationId);
    throwIfError(error);
  }

  async function saveStudent(student) {
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente.');
    let photoPath = student.photoPath || null;
    if (typeof student.photo === 'string' && student.photo.startsWith('data:image/')) {
      photoPath = `${student.classId}/${student.id}.jpg`;
      const photoBlob = await dataUrlToBlob(student.photo);
      const { error: uploadError } = await client.storage
        .from(PHOTO_BUCKET)
        .upload(photoPath, photoBlob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
      throwIfError(uploadError);
    } else if (!student.photo && student.previousPhotoPath) {
      const { error: removeError } = await client.storage.from(PHOTO_BUCKET).remove([student.previousPhotoPath]);
      throwIfError(removeError);
      photoPath = null;
    }
    const { data, error } = await client
      .from('students')
      .upsert(studentRow(student, photoPath), { onConflict: 'id' })
      .select()
      .single();
    throwIfError(error);
    return signStudentPhoto(mapStudent(data));
  }

  async function deleteStudent(student) {
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente.');
    const { error } = await client.from('students').delete().eq('id', student.id);
    throwIfError(error);
    if (student.photoPath) {
      const { error: photoError } = await client.storage.from(PHOTO_BUCKET).remove([student.photoPath]);
      if (photoError) console.warn('Cadastro excluído, mas a foto não pôde ser removida.', photoError);
    }
  }

  async function importSchoolData(payload) {
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente.');
    const classRows = payload.classes.map((item) => ({
      id: item.id,
      label: item.label,
      class_name: item.className,
      course: item.course,
      school_year: Number(item.year),
      active: true,
      archived_at: null,
      updated_by: currentUser.id,
    }));
    const studentRows = payload.students.map((student) => studentRow(student, student.photoPath || null));
    const classResult = await client.from('classes').upsert(classRows, { onConflict: 'id' });
    throwIfError(classResult.error);
    for (let offset = 0; offset < studentRows.length; offset += 150) {
      const result = await client.from('students').upsert(studentRows.slice(offset, offset + 150), { onConflict: 'id' });
      throwIfError(result.error);
    }
  }

  async function archiveSchoolYear(year) {
    if (!currentUser) throw new Error('Sua sessão expirou. Entre novamente.');
    const { error } = await client.rpc('archive_school_year', { p_school_year: Number(year) });
    throwIfError(error);
  }

  function subscribe(onChange) {
    if (!enabled || channel) return;
    channel = client
      .channel('conselho-em-foco')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, onChange)
      .subscribe();
  }

  async function signOut() {
    if (!enabled) return;
    if (channel) await client.removeChannel(channel);
    channel = null;
    currentUser = null;
    const { error } = await client.auth.signOut();
    throwIfError(error);
  }

  const api = { enabled, setupError, loginWithCode, getTeacher, loadData, saveEvaluation, deleteEvaluation, saveStudent, deleteStudent, importSchoolData, archiveSchoolYear, subscribe, signOut };
  window.CF_CLOUD = api;
  return api;
})();
