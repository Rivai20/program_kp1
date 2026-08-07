const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('page-active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('page-active');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function setAlert(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

function clearAlerts() {
  setAlert('login-alert', '');
  setAlert('register-alert', '');
}

async function registerUser() {
  clearAlerts();
  const name = document.getElementById('reg-name').value.trim();
  const npm = document.getElementById('reg-npm').value.trim();
  const prodi = document.getElementById('reg-prodi').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmPassword = document.getElementById('reg-confirm-password').value;
  const fileInput = document.getElementById('reg-file-input');
  const supportFile = fileInput.files[0];

  if (!name || !npm || !prodi || !password || !confirmPassword) {
    return setAlert('register-alert', 'Semua field wajib diisi.');
  }
  if (password.length < 6) return setAlert('register-alert', 'Password minimal 6 karakter.');
  if (password !== confirmPassword) return setAlert('register-alert', 'Konfirmasi password tidak cocok.');

  const { data: existing, error: selectError } = await supabaseClient
    .from('users')
    .select('id')
    .eq('npm', npm)
    .limit(1)
    .maybeSingle();

  if (selectError) return setAlert('register-alert', selectError.message);
  if (existing) return setAlert('register-alert', 'NPM sudah terdaftar.');

  let supportFilePath = '';
  let supportFileUrl = '';
  if (supportFile) {
    const storagePath = `support/${Date.now()}-${supportFile.name}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('support-files')
      .upload(storagePath, supportFile, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      return setAlert('register-alert', uploadError.message);
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from('support-files')
      .getPublicUrl(storagePath);
    supportFilePath = storagePath;
    supportFileUrl = publicUrlData.publicUrl;
  }

  const passwordHash = await hashPassword(password);
  const role = npm.toLowerCase() === 'admin' ? 'admin' : 'mahasiswa';

  const { error: insertError } = await supabaseClient.from('users').insert([{ 
    name,
    npm,
    password_hash: passwordHash,
    role,
    prodi,
    support_file_name: supportFile ? supportFile.name : '',
    support_file_path: supportFilePath,
    support_file_url: supportFileUrl
  }]);

  if (insertError) return setAlert('register-alert', insertError.message);

  showToast('Akun berhasil dibuat. Silakan masuk.');
  document.getElementById('register-form').reset();
  setTimeout(() => showPage('page-login'), 800);
}

async function loginUser() {
  clearAlerts();
  const npm = document.getElementById('login-npm').value.trim();
  const password = document.getElementById('login-password').value;

  if (!npm || !password) return setAlert('login-alert', 'NPM dan password wajib diisi.');

  const { data: users, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('npm', npm)
    .limit(1);

  if (error) return setAlert('login-alert', error.message);
  const user = users?.[0];
  if (!user) return setAlert('login-alert', 'NPM atau password salah.');

  const passwordHash = await hashPassword(password);
  if (user.password_hash !== passwordHash) return setAlert('login-alert', 'NPM atau password salah.');

  const sessionUser = {
    id: user.id,
    name: user.name,
    npm: user.npm,
    role: user.role,
    prodi: user.prodi
  };
  localStorage.setItem('sitranskip_user', JSON.stringify(sessionUser));
  initApp();
}

async function loadStudents() {
  const { data, error } = await supabaseClient
    .from('users')
    .select('id,name,npm,prodi')
    .eq('role', 'mahasiswa');

  if (error) return console.error(error);

  const list = document.getElementById('student-list');
  if (list) {
    list.innerHTML = data.map(student => `<li><strong>${student.name}</strong> - ${student.npm} (${student.prodi || '-'})</li>`).join('');
  }

  const select = document.getElementById('admin-message-to');
  if (select) {
    select.innerHTML = data.map(student => `<option value="${student.id}">${student.name} (${student.npm})</option>`).join('');
  }

  document.getElementById('stat-students').textContent = data.length;
}

async function openTranscriptModal() {
  const select = document.getElementById('transcript-student');
  const { data, error } = await supabaseClient
    .from('users')
    .select('id,name,npm')
    .eq('role', 'mahasiswa');

  if (error) return console.error(error);
  select.innerHTML = data.map(student => `<option value="${student.id}">${student.name} (${student.npm})</option>`).join('');
  document.getElementById('modal-transcript').classList.remove('hidden');
}

async function uploadTranscript() {
  const form = document.getElementById('transcript-form');
  const formData = new FormData(form);
  const file = formData.get('file');
  const studentId = formData.get('studentId');
  const semester = formData.get('semester');
  const user = JSON.parse(localStorage.getItem('sitranskip_user') || '{}');

  if (!studentId || !semester || !file || file.size === 0) {
    return setAlert('transcript-modal-alert', 'Pilih mahasiswa, semester, dan file transkip.');
  }

  const storagePath = `transcripts/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabaseClient.storage
    .from('transcripts')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) return setAlert('transcript-modal-alert', uploadError.message);

  const { data: publicUrlData } = supabaseClient.storage
    .from('transcripts')
    .getPublicUrl(storagePath);

  const { error: insertError } = await supabaseClient.from('transcripts').insert([{ 
    student_id: Number(studentId),
    semester,
    file_name: file.name,
    file_path: storagePath,
    file_url: publicUrlData.publicUrl,
    uploaded_by: user.id
  }]);

  if (insertError) return setAlert('transcript-modal-alert', insertError.message);

  closeModal('modal-transcript');
  showToast('Transkip berhasil diupload.');
  initApp();
}

async function loadTranscripts(studentId) {
  let query = supabaseClient.from('transcripts').select('id,student_id,semester,file_name,file_url,uploaded_by,created_at');
  if (studentId) query = query.eq('student_id', Number(studentId));
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return console.error(error);

  const list = document.getElementById('transcript-list');
  if (list) {
    list.innerHTML = data.length ? data.map(item => `
      <li>
        <strong>${item.semester}</strong> - ${item.file_name}
        <br>
        <a href="${item.file_url}" target="_blank" rel="noreferrer">Lihat file</a>
      </li>`).join('') : '<li>Belum ada transkip.</li>';
  }

  document.getElementById('stat-transcripts').textContent = data.length;
}

async function loadMessages(userId) {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: true });

  if (error) return console.error(error);
  const box = document.getElementById('message-box');
  if (box) {
    box.innerHTML = data.length ? data.map(message => `<div class="message-item">${message.text}</div>`).join('') : '<p class="note">Belum ada pesan.</p>';
  }
}

async function sendMessage(senderId, receiverId, text) {
  const { error } = await supabaseClient.from('messages').insert([{ sender_id: Number(senderId), receiver_id: Number(receiverId), text }]);
  if (error) return error.message;
  return null;
}

async function sendStudentMessage() {
  const user = JSON.parse(localStorage.getItem('sitranskip_user') || '{}');
  const text = document.getElementById('student-message-text').value.trim();
  if (!text) return showToast('Tulis pesan terlebih dahulu.');

  const { data: adminData, error } = await supabaseClient.from('users').select('id').eq('role', 'admin').limit(1);
  if (error || !adminData.length) return showToast('Admin tidak ditemukan.');

  const messageError = await sendMessage(user.id, adminData[0].id, text);
  if (messageError) return showToast(messageError);

  document.getElementById('student-message-text').value = '';
  showToast('Pesan terkirim ke admin.');
  loadMessages(user.id);
}

async function sendAdminMessage() {
  const user = JSON.parse(localStorage.getItem('sitranskip_user') || '{}');
  const receiverId = document.getElementById('admin-message-to').value;
  const text = document.getElementById('admin-message-text').value.trim();
  if (!receiverId || !text) return showToast('Pilih mahasiswa dan tulis pesan.');

  const messageError = await sendMessage(user.id, receiverId, text);
  if (messageError) return showToast(messageError);

  document.getElementById('admin-message-text').value = '';
  showToast('Pesan terkirim ke mahasiswa.');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

async function initApp() {
  const user = JSON.parse(localStorage.getItem('sitranskip_user') || 'null');
  if (!user) {
    showPage('page-landing');
    return;
  }

  if (user.role === 'admin') {
    document.getElementById('admin-welcome').textContent = `Halo, ${user.name}`;
    showPage('page-admin');
    loadStudents();
    loadTranscripts();
  } else {
    document.getElementById('mhs-welcome').textContent = `Halo, ${user.name}`;
    document.getElementById('mhs-name').textContent = user.name;
    document.getElementById('mhs-npm').textContent = user.npm;
    document.getElementById('mhs-prodi').textContent = user.prodi || '-';
    showPage('page-mahasiswa');
    loadTranscripts(user.id);
    loadMessages(user.id);
  }
}

document.addEventListener('DOMContentLoaded', () => initApp());
