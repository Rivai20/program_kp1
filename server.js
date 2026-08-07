const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, 'uploads');
const storePath = path.join(__dirname, 'data.json');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(storePath)) {
  fs.writeFileSync(storePath, JSON.stringify({ users: [], students: [], transcripts: [], messages: [] }, null, 2));
}

function readStore() {
  const raw = fs.readFileSync(storePath, 'utf8');
  return raw ? JSON.parse(raw) : { users: [], students: [], transcripts: [], messages: [] };
}

function writeStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function nextId(items) {
  return items.length ? Math.max(...items.map(item => item.id)) + 1 : 1;
}

function seedDefaults() {
  const store = readStore();
  if (!store.users.some(user => user.npm === 'admin')) {
    const adminId = nextId(store.users);
    store.users.push({ id: adminId, name: 'Administrator', npm: 'admin', password_hash: hashPassword('admin123'), role: 'admin', prodi: 'Administrator', created_at: new Date().toISOString() });
    store.students.push({ id: nextId(store.students), user_id: adminId, name: 'Administrator', npm: 'admin', prodi: 'Administrator', created_at: new Date().toISOString() });
  }

  if (!store.users.some(user => user.npm === '2021TI001')) {
    const studentUserId = nextId(store.users);
    store.users.push({ id: studentUserId, name: 'Budi Santoso', npm: '2021TI001', password_hash: hashPassword('student123'), role: 'mahasiswa', prodi: 'Teknik Informatika', created_at: new Date().toISOString() });
    store.students.push({ id: nextId(store.students), user_id: studentUserId, name: 'Budi Santoso', npm: '2021TI001', prodi: 'Teknik Informatika', created_at: new Date().toISOString() });
  }

  writeStore(store);
}

seedDefaults();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({ storage });

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/register', upload.single('file'), (req, res) => {
  const { name, npm, prodi, password, confirmPassword } = req.body;
  const supportFile = req.file;
  if (!name || !npm || !prodi || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'Konfirmasi password tidak cocok' });

  const store = readStore();
  if (store.users.some(user => user.npm.toLowerCase() === npm.toLowerCase())) {
    return res.status(409).json({ error: 'NPM sudah terdaftar' });
  }

  const userId = nextId(store.users);
  const supportFilePath = supportFile ? `uploads/${supportFile.filename}` : '';
  store.users.push({
    id: userId,
    name,
    npm,
    password_hash: hashPassword(password),
    role: 'mahasiswa',
    prodi,
    support_file_name: supportFile ? supportFile.originalname : '',
    support_file_path: supportFilePath,
    created_at: new Date().toISOString()
  });

  store.students.push({
    id: nextId(store.students),
    user_id: userId,
    name,
    npm,
    prodi,
    created_at: new Date().toISOString()
  });

  writeStore(store);
  res.json({ ok: true, message: 'Akun berhasil dibuat' });
});

app.post('/api/login', (req, res) => {
  const { npm, password } = req.body;
  if (!npm || !password) return res.status(400).json({ error: 'NPM dan password wajib diisi' });

  const store = readStore();
  const user = store.users.find(u => u.npm.toLowerCase() === npm.toLowerCase());
  if (!user) return res.status(401).json({ error: 'NPM atau password salah' });

  const enteredHash = hashPassword(password);
  if (user.password_hash !== enteredHash) return res.status(401).json({ error: 'NPM atau password salah' });

  res.json({ ok: true, user: { id: user.id, name: user.name, npm: user.npm, role: user.role, prodi: user.prodi } });
});

app.get('/api/students', (req, res) => {
  const store = readStore();
  res.json(store.students);
});

app.post('/api/transcripts', upload.single('file'), (req, res) => {
  const { studentId, semester, uploadedBy } = req.body;
  const file = req.file;
  if (!studentId || !semester || !file) return res.status(400).json({ error: 'Pilih mahasiswa, semester, dan file' });

  const store = readStore();
  const uploader = store.users.find(u => Number(u.id) === Number(uploadedBy));
  if (!uploader || uploader.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang boleh upload transkip' });

  const student = store.students.find(s => Number(s.id) === Number(studentId));
  if (!student) return res.status(404).json({ error: 'Mahasiswa tidak ditemukan' });

  const transcript = {
    id: nextId(store.transcripts),
    student_id: Number(studentId),
    semester,
    file_name: file.originalname,
    file_path: `uploads/${file.filename}`,
    uploaded_by: uploader.id,
    created_at: new Date().toISOString()
  };
  store.transcripts.push(transcript);
  writeStore(store);

  res.json({ ok: true, message: 'Transkip berhasil diupload' });
});

app.get('/api/transcripts', (req, res) => {
  const store = readStore();
  const { studentId } = req.query;
  if (studentId) {
    return res.json(store.transcripts.filter(item => String(item.student_id) === String(studentId)));
  }
  res.json(store.transcripts);
});

app.get('/api/messages', (req, res) => {
  const store = readStore();
  const { userId } = req.query;
  if (!userId) return res.json([]);
  res.json(store.messages.filter(item => String(item.sender_id) === String(userId) || String(item.receiver_id) === String(userId)));
});

app.post('/api/messages', (req, res) => {
  const { senderId, receiverId, text } = req.body;
  if (!senderId || !receiverId || !text) return res.status(400).json({ error: 'Data pesan tidak lengkap' });

  const store = readStore();
  store.messages.push({
    id: nextId(store.messages),
    sender_id: Number(senderId),
    receiver_id: Number(receiverId),
    text,
    created_at: new Date().toISOString()
  });
  writeStore(store);

  res.json({ ok: true, message: 'Pesan terkirim' });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
