const STORAGE_KEYS = {
  accounts: 'sitranskip_lite_accounts',
  students: 'sitranskip_lite_students',
  transcripts: 'sitranskip_lite_transcripts',
  session: 'sitranskip_lite_session'
}

let appState = {
  user: null,
  students: [],
  transcripts: []
}

function getStorage(key, fallback) {
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : fallback
}

function setStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function generateId() {
  return 'id-' + Math.random().toString(36).slice(2, 10)
}

function getTranscriptFileLabel(item) {
  if (item.fileDataUrl) {
    return `<a class="file-link" href="${item.fileDataUrl}" download="${item.fileName || 'transkip'}">${item.fileName || item.file || 'Lihat file'}</a>`
  }

  return `<span>${item.fileName || item.file || '-'}</span>`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.readAsDataURL(file)
  })
}

async function initData() {
  const storedAccounts = getStorage(STORAGE_KEYS.accounts, null)
  const storedStudents = getStorage(STORAGE_KEYS.students, null)
  const storedTranscripts = getStorage(STORAGE_KEYS.transcripts, null)

  if (!storedAccounts) {
    const defaultAccounts = [
      { id: 'admin', name: 'Administrator', npm: 'admin', passwordHash: await hashPassword('admin123'), role: 'admin' },
      { id: 's1', name: 'Budi Santoso', npm: '2021TI001', passwordHash: await hashPassword('student123'), role: 'mahasiswa' }
    ]
    setStorage(STORAGE_KEYS.accounts, defaultAccounts)
  }

  if (!storedStudents) {
    const defaultStudents = [
      { id: 's1', name: 'Budi Santoso', npm: '2021TI001', prodi: 'Teknik Informatika' },
      { id: 's2', name: 'Siti Rahayu', npm: '2021TI002', prodi: 'Sistem Informasi' }
    ]
    setStorage(STORAGE_KEYS.students, defaultStudents)
  }

  if (!storedTranscripts) {
    const defaultTranscripts = [
      { id: 't1', studentId: 's1', semester: 'kumulatif', fileName: 'transkip_budi.pdf', fileDataUrl: '' },
      { id: 't2', studentId: 's2', semester: '4', fileName: 'transkip_siti_s4.pdf', fileDataUrl: '' }
    ]
    setStorage(STORAGE_KEYS.transcripts, defaultTranscripts)
  }
}

async function initApp() {
  await initData()
  appState.students = getStorage(STORAGE_KEYS.students, [])
  appState.transcripts = getStorage(STORAGE_KEYS.transcripts, [])

  const session = getStorage(STORAGE_KEYS.session, null)
  if (session) {
    appState.user = session
    enterApp()
  }
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('page-active'))
  document.getElementById(id).classList.add('page-active')
  clearAlert('login-alert')
  clearAlert('register-alert')
}

function showToast(message) {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), 2200)
}

function setAlert(id, message) {
  const el = document.getElementById(id)
  if (el) el.textContent = message
}

function clearAlert(id) {
  const el = document.getElementById(id)
  if (el) el.textContent = ''
}

async function handleLogin() {
  const npm = document.getElementById('login-npm').value.trim()
  const password = document.getElementById('login-password').value

  if (!npm || !password) return setAlert('login-alert', 'NPM dan password wajib diisi.')

  const accounts = getStorage(STORAGE_KEYS.accounts, [])
  const passwordHash = await hashPassword(password)
  const account = accounts.find(acc => {
    const matchesNpm = acc.npm && acc.npm.toLowerCase() === npm.toLowerCase()
    const matchesPassword = acc.passwordHash ? acc.passwordHash === passwordHash : acc.password === password
    return matchesNpm && matchesPassword
  })

  if (!account) {
    setAlert('login-alert', 'NPM atau password salah.')
    return
  }

  appState.user = account
  setStorage(STORAGE_KEYS.session, account)
  enterApp()
}

async function handleRegister() {
  const name = document.getElementById('reg-name').value.trim()
  const npm = document.getElementById('reg-npm').value.trim()
  const prodi = document.getElementById('reg-prodi').value.trim()
  const password = document.getElementById('reg-password').value
  const confirmPassword = document.getElementById('reg-confirm-password').value
  const fileInput = document.getElementById('reg-file-input')
  const file = fileInput.files[0]

  if (!name || !npm || !prodi || !password || !confirmPassword) {
    return setAlert('register-alert', 'Semua field wajib diisi, termasuk password dan konfirmasi password.')
  }
  if (password.length < 6) return setAlert('register-alert', 'Password minimal 6 karakter.')
  if (password !== confirmPassword) return setAlert('register-alert', 'Konfirmasi password tidak cocok.')

  const accounts = getStorage(STORAGE_KEYS.accounts, [])
  const existingNpm = accounts.some(acc => acc.npm && acc.npm.toLowerCase() === npm.toLowerCase())
  if (existingNpm) {
    return setAlert('register-alert', 'NPM sudah terdaftar.')
  }

  const passwordHash = await hashPassword(password)
  const fileDataUrl = file ? await readFileAsDataUrl(file) : ''
  const user = {
    id: npm.toLowerCase(),
    name,
    npm,
    passwordHash,
    role: 'mahasiswa',
    prodi,
    fileName: file ? file.name : '',
    fileDataUrl
  }

  accounts.push(user)
  setStorage(STORAGE_KEYS.accounts, accounts)
  appState.students.push({
    id: user.id,
    name,
    npm,
    prodi,
    fileName: user.fileName,
    fileDataUrl: user.fileDataUrl
  })
  setStorage(STORAGE_KEYS.students, appState.students)
  setAlert('register-alert', 'Akun berhasil dibuat. Silakan masuk.')
  setTimeout(() => showPage('page-login'), 1400)
}

function handleLogout() {
  appState.user = null
  localStorage.removeItem(STORAGE_KEYS.session)
  showPage('page-landing')
}

function enterApp() {
  if (appState.user.role === 'admin') {
    document.getElementById('admin-welcome').textContent = `Halo, ${appState.user.name}`
    showPage('page-admin')
    renderAdmin()
  } else {
    document.getElementById('mhs-welcome').textContent = `Halo, ${appState.user.name}`
    showPage('page-mahasiswa')
    renderMahasiswa()
  }
}

function renderAdmin() {
  renderStudentTable(appState.students)
  renderTranscriptTable(appState.transcripts)
  updateStats()
}

function renderMahasiswa() {
  const student = appState.students.find(s => s.id === appState.user.id) || {}
  document.getElementById('mhs-name').textContent = student.name || appState.user.name
  document.getElementById('mhs-npm').textContent = student.npm || appState.user.npm
  document.getElementById('mhs-prodi').textContent = student.prodi || '-'
  renderMahasiswaTranscripts()
}

function updateStats() {
  document.getElementById('stat-students').textContent = appState.students.length
  document.getElementById('stat-transcripts').textContent = appState.transcripts.length
}

function renderStudentTable(data) {
  const body = document.getElementById('students-body')
  if (!data.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Belum ada mahasiswa.</td></tr>'
    return
  }
  body.innerHTML = data.map((student, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${student.name}</td>
      <td>${student.npm}</td>
      <td>${student.prodi}</td>
      <td>
        <button class="btn btn-secondary btn-small" onclick="openStudentModal('${student.id}')">Edit</button>
        <button class="btn btn-danger btn-small" onclick="deleteStudent('${student.id}')">Hapus</button>
      </td>
    </tr>`).join('')
}

function renderTranscriptTable() {
  const body = document.getElementById('transcripts-body')
  if (!appState.transcripts.length) {
    body.innerHTML = '<tr><td colspan="4" class="empty">Belum ada transkip.</td></tr>'
    return
  }
  body.innerHTML = appState.transcripts.map((item, index) => {
    const student = appState.students.find(s => s.id === item.studentId) || { name: '-', npm: '-' }
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${student.name} (${student.npm})</td>
        <td>${item.semester}</td>
        <td>${getTranscriptFileLabel(item)}</td>
      </tr>`
  }).join('')
}

function renderMahasiswaTranscripts() {
  const list = document.getElementById('mhs-transcripts')
  const transcripts = appState.transcripts.filter(t => t.studentId === appState.user.id)
  if (!transcripts.length) {
    list.innerHTML = '<p class="note">Belum ada transkip untuk akun ini.</p>'
    return
  }
  list.innerHTML = transcripts.map(item => `
    <div class="transcript-card">
      <strong>${item.semester}</strong> - ${getTranscriptFileLabel(item)}
    </div>`).join('')
}

function filterStudents(query) {
  const text = query.trim().toLowerCase()
  const filtered = appState.students.filter(student =>
    student.name.toLowerCase().includes(text) || student.npm.toLowerCase().includes(text)
  )
  renderStudentTable(filtered)
}

function openStudentModal(id = '') {
  const modal = document.getElementById('modal-student')
  const title = document.getElementById('student-modal-title')
  const nameInput = document.getElementById('student-name')
  const npmInput = document.getElementById('student-npm')
  const prodiInput = document.getElementById('student-prodi')

  clearAlert('student-modal-alert')
  if (id) {
    const student = appState.students.find(s => s.id === id)
    title.textContent = 'Edit Mahasiswa'
    nameInput.value = student.name
    npmInput.value = student.npm
    prodiInput.value = student.prodi
    modal.dataset.editId = id
  } else {
    title.textContent = 'Tambah Mahasiswa'
    nameInput.value = ''
    npmInput.value = ''
    prodiInput.value = ''
    modal.dataset.editId = ''
  }
  modal.classList.remove('hidden')
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden')
}

function saveStudent() {
  const modal = document.getElementById('modal-student')
  const id = modal.dataset.editId || ''
  const name = document.getElementById('student-name').value.trim()
  const npm = document.getElementById('student-npm').value.trim()
  const prodi = document.getElementById('student-prodi').value.trim() || '-'

  if (!name || !npm) return setAlert('student-modal-alert', 'Nama dan NPM wajib diisi.')

  if (id) {
    const student = appState.students.find(s => s.id === id)
    student.name = name
    student.npm = npm
    student.prodi = prodi
    showToast('Data mahasiswa diperbarui.')
  } else {
    appState.students.push({ id: generateId(), name, npm, prodi })
    showToast('Mahasiswa ditambahkan.')
  }

  setStorage(STORAGE_KEYS.students, appState.students)
  closeModal('modal-student')
  renderAdmin()
}

function deleteStudent(id) {
  if (!confirm('Hapus mahasiswa ini?')) return
  appState.students = appState.students.filter(student => student.id !== id)
  appState.transcripts = appState.transcripts.filter(item => item.studentId !== id)
  setStorage(STORAGE_KEYS.students, appState.students)
  setStorage(STORAGE_KEYS.transcripts, appState.transcripts)
  renderAdmin()
  showToast('Mahasiswa dihapus.')
}

function openTranscriptModal() {
  const select = document.getElementById('transcript-student')
  select.innerHTML = appState.students.map(s => `<option value="${s.id}">${s.name} (${s.npm})</option>`).join('')
  document.getElementById('transcript-semester').value = ''
  document.getElementById('transcript-file-input').value = ''
  clearAlert('transcript-modal-alert')
  document.getElementById('modal-transcript').classList.remove('hidden')
}

async function saveTranscript() {
  const studentId = document.getElementById('transcript-student').value
  const semester = document.getElementById('transcript-semester').value.trim()
  const fileInput = document.getElementById('transcript-file-input')
  const file = fileInput.files[0]

  if (!studentId || !semester || !file) return setAlert('transcript-modal-alert', 'Pilih mahasiswa, semester, dan file transkip.')

  const fileDataUrl = await readFileAsDataUrl(file)
  appState.transcripts.push({ id: generateId(), studentId, semester, fileName: file.name, fileDataUrl })
  setStorage(STORAGE_KEYS.transcripts, appState.transcripts)
  closeModal('modal-transcript')
  renderAdmin()
  showToast('Transkip ditambahkan.')
}

window.addEventListener('DOMContentLoaded', () => initApp())
