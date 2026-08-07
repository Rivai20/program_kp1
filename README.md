# SiTranskip Lite

Aplikasi web ringan untuk pengelolaan transkip nilai mahasiswa.

## Fitur
- Login dan register sederhana
- Dashboard admin untuk daftar mahasiswa dan transkip
- Portal mahasiswa untuk melihat profil dan transkip
- Data disimpan di `localStorage` sehingga tidak perlu backend

## Cara Menjalankan
1. Buka folder `sitranskip-lite`
2. Buka `client.js` dan isi:
   - `SUPABASE_URL` dengan URL proyek Supabase Anda
   - `SUPABASE_ANON_KEY` dengan kunci anon publik Supabase
3. Jalankan server statis lokal seperti `python -m http.server 3000` atau deploy ke Vercel
4. Buka: `http://localhost:3000`

## Supabase Setup
1. Buat proyek baru di Supabase
2. Buat bucket `support-files` dan `transcripts` di Storage, lalu beri akses public untuk bucket tersebut
3. Jalankan SQL ini di editor Supabase:

```sql
create table users (
  id bigserial primary key,
  name text not null,
  npm text unique not null,
  password_hash text not null,
  role text not null,
  prodi text,
  support_file_name text,
  support_file_path text,
  support_file_url text,
  created_at timestamp with time zone default now()
);

create table transcripts (
  id bigserial primary key,
  student_id bigint references users(id),
  semester text not null,
  file_name text not null,
  file_path text not null,
  file_url text not null,
  uploaded_by bigint references users(id),
  created_at timestamp with time zone default now()
);

create table messages (
  id bigserial primary key,
  sender_id bigint references users(id),
  receiver_id bigint references users(id),
  text text not null,
  created_at timestamp with time zone default now()
);
```

4. Jika ingin, tambahkan admin manual di tabel `users` dengan NPM `admin` dan password `admin123`.

## Fitur Supabase
- Login/register menggunakan tabel `users`
- Upload file pendukung saat daftar akun
- Upload transkrip nilai ke bucket `transcripts`
- Mahasiswa dapat melihat transkrip mereka sendiri
- Admin dapat melihat semua mahasiswa dan mengirim pesan
- Mahasiswa dapat mengirim pesan ke admin

## Catatan
- Supabase menyimpan data secara nyata di cloud, jadi aplikasi menjadi dinamis dan dapat di-deploy ke Vercel.
- Jangan commit kunci Supabase Anda ke publik jika ini adalah proyek nyata.

## Struktur
- `index.html` — tampilan aplikasi
- `style.css` — gaya ringan
- `app.js` — logika aplikasi dan penyimpanan data lokal

## Catatan
Proyek ini dibuat agar ringan dan mudah diunggah ke GitHub tanpa dependensi tambahan.
