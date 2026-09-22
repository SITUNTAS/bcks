import { createClient } from '@libsql/client';
import { put } from '@vercel/blob';

// Koneksi ke Database Turso
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action, args } = req.body;

  try {
    let result;
    switch (action) {
      // --- FUNGSI OTENTIKASI ---
      case 'loginUser':
        const nip = args[0]; const pass = args[1];
        const { rows: users } = await db.execute({ sql: "SELECT * FROM users WHERE nip = ? AND nik = ?", args: [nip, pass] });
        if (users.length > 0) result = { status: "success", role: users[0].role, nip: users[0].nip, nama: users[0].nama };
        else result = { status: "error", message: "NIP atau Password salah!" };
        break;

      // --- FUNGSI PENGATURAN & PENGUMUMAN ---
      case 'getPengaturanGlobal':
        const { rows: rPeng } = await db.execute("SELECT * FROM pengaturan");
        const { rows: rPengumuman } = await db.execute("SELECT * FROM pengumuman ORDER BY rowid DESC");
        
        let config = { Batas_Waktu: "", PengumumanList: [] };
        rPeng.forEach(row => {
           if(row.kunci === "Batas_Waktu" && row.nilai) {
              let tgl = new Date(row.nilai);
              if(!isNaN(tgl.getTime())) config.Batas_Waktu = tgl.toISOString();
           }
        });
        rPengumuman.forEach(p => {
           config.PengumumanList.push({ row: p.id, id: p.id, tanggal: p.tanggal, judul: p.judul, teks: p.teks, file: p.file_url });
        });
        result = config;
        break;

      case 'saveBatasWaktu':
        await db.execute({ sql: "INSERT INTO pengaturan (kunci, nilai) VALUES ('Batas_Waktu', ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai", args: [args[0]] });
        result = "Pengaturan batas waktu berhasil disimpan!";
        break;

      case 'savePengumuman':
        let [pId, pJudul, pTeks, pFileObj, pOldFile, pActionRow] = args;
        let pFileUrl = pOldFile || "";
        if (pFileObj && pFileObj.base64) {
            const base64Data = pFileObj.base64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
            const contentType = pFileObj.base64.substring(5, pFileObj.base64.indexOf(';'));
            const blob = await put(`Pengumuman_${new Date().getTime()}_${pFileObj.name}`, Buffer.from(base64Data, 'base64'), { access: 'public', contentType });
            pFileUrl = blob.url;
        }
        let tglSkrg = new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute:'2-digit'}) + " WIB";
        
        if (pActionRow && pActionRow !== "null" && pActionRow !== "") {
           await db.execute({ sql: "UPDATE pengumuman SET judul=?, teks=?, file_url=? WHERE id=?", args: [pJudul, pTeks, pFileUrl, pActionRow] });
           result = "Pengumuman berhasil diperbarui!";
        } else {
           let newId = "PENG-" + new Date().getTime();
           await db.execute({ sql: "INSERT INTO pengumuman (id, tanggal, judul, teks, file_url) VALUES (?, ?, ?, ?, ?)", args: [newId, tglSkrg, pJudul, pTeks, pFileUrl] });
           result = "Pengumuman baru berhasil ditambahkan!";
        }
        break;

      case 'deletePengumuman':
        await db.execute({ sql: "DELETE FROM pengumuman WHERE id=?", args: [args[0]] });
        result = "Pengumuman berhasil dihapus!";
        break;

      // --- FUNGSI ADMIN USER ---
      case 'getSemuaUsers':
        const { rows: rUsers } = await db.execute("SELECT * FROM users");
        result = rUsers.map(u => ({ row: u.nip, role: u.role, nip: u.nip, nik: u.nik, nama: u.nama }));
        break;
      
      case 'addUserDB':
        await db.execute({ sql: "INSERT INTO users (role, nip, nik, nama) VALUES ('Pegawai', ?, ?, ?)", args: [args[0], args[1], args[2]] });
        result = "User berhasil ditambahkan";
        break;

      case 'editUserDB':
        await db.execute({ sql: "UPDATE users SET nip=?, nik=?, nama=? WHERE nip=?", args: [args[1], args[2], args[3], args[0]] });
        result = "Data User berhasil diupdate";
        break;

      case 'deleteUserDB':
        await db.execute({ sql: "DELETE FROM users WHERE nip=?", args: [args[0]] });
        result = "User berhasil dihapus";
        break;

      case 'uploadTemplateUsersExcel':
        let excelData = args[0];
        let count = 0;
        for (let row of excelData) {
            if (row && row.length >= 3 && row[0]) {
                await db.execute({ sql: "INSERT OR REPLACE INTO users (role, nip, nik, nama) VALUES ('Pegawai', ?, ?, ?)", args: [row[0].toString().trim(), row[1].toString().trim(), row[2].toString().trim()] });
                count++;
            }
        }
        result = count + " User berhasil diimpor ke database.";
        break;

      // --- FUNGSI BIODATA & JADWAL ---
      case 'getSemuaBiodata':
      case 'getBiodataPegawai':
        const isSingle = action === 'getBiodataPegawai';
        let queryBio = isSingle ? { sql: "SELECT * FROM biodata WHERE nip=?", args: [args[0]] } : "SELECT * FROM biodata";
        const { rows: rBio } = await db.execute(queryBio);
        let parsedData = rBio.map(r => ({
           row: r.nip, NIP: r.nip, Nama: r.nama, Jenjang: r.jenjang, NIK: r.nik, NUPTK: r.nuptk, Tempat_Lahir: r.tempat_lahir,
           Tanggal_Lahir: r.tanggal_lahir, Jenis_Kelamin: r.jenis_kelamin, Agama: r.agama, Pangkat_Golongan: r.pangkat_golongan,
           Jabatan: r.jabatan, Unit_Kerja: r.unit_kerja, Email: r.email, No_HP: r.no_hp, Alamat: r.alamat,
           Status_Verifikasi: r.status_verifikasi, Catatan: r.catatan, Foto: r.foto, Ijazah: r.ijazah, Sertifikat: r.sertifikat,
           SK: r.sk, SKP: r.skp, Sehat: r.sehat, SKCK: r.skck, Pakta: r.pakta, Lokasi_Ujian: r.lokasi_ujian,
           Tanggal_Ujian: r.tanggal_ujian, Waktu_Ujian: r.waktu_ujian, Sesi_Ujian: r.sesi_ujian, Username_CAT: r.username_cat, Password_CAT: r.password_cat
        }));
        result = isSingle ? (parsedData[0] || null) : parsedData;
        break;

      case 'verifyBerkas':
        await db.execute({ sql: "UPDATE biodata SET status_verifikasi=?, catatan=? WHERE nip=?", args: [args[1], args[2], args[0]] });
        result = "Berhasil diverifikasi";
        break;

      case 'hapusPeserta':
        await db.execute({ sql: "DELETE FROM biodata WHERE nip=?", args: [args[0]] });
        result = "Data peserta berhasil dihapus";
        break;

      case 'saveJadwalMassal':
        let nips = args[0]; let jd = args[1];
        for(let n of nips) {
           let ucat = jd.Username_CAT || `CAT${n.toString().substring(0,6)}`;
           let pcat = jd.Password_CAT || Math.floor(100000 + Math.random() * 900000);
           await db.execute({ sql: "UPDATE biodata SET lokasi_ujian=?, tanggal_ujian=?, waktu_ujian=?, sesi_ujian=?, username_cat=?, password_cat=? WHERE nip=?", args: [jd.Lokasi_Ujian, jd.Tanggal_Ujian, jd.Waktu_Ujian, jd.Sesi_Ujian, ucat, pcat, n] });
        }
        result = `Jadwal & Akun CAT berhasil disimpan untuk ${nips.length} peserta!`;
        break;

      case 'saveBiodata':
        let fd = args[0]; let filesData = args[1];
        // Cek Batas Waktu
        const chkWaktu = await db.execute("SELECT nilai FROM pengaturan WHERE kunci = 'Batas_Waktu'");
        if(chkWaktu.rows.length > 0 && chkWaktu.rows[0].nilai) {
            if(new Date() > new Date(chkWaktu.rows[0].nilai)) return res.status(200).json({ result: "Maaf batas melengkapi data sudah selesai tidak menerima data baru lagi terimakasih atas kerjasamanya" });
        }

        let fUrls = {};
        for(let f of filesData) {
            if(f.base64) {
               const b64Data = f.base64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
               const cType = f.base64.substring(5, f.base64.indexOf(';'));
               const blob = await put(`Berkas/${fd.NIP}_${f.name}`, Buffer.from(b64Data, 'base64'), { access: 'public', contentType: cType });
               fUrls[f.name] = blob.url;
            }
        }

        const q = `INSERT INTO biodata (nip, nama, jenjang, nik, nuptk, tempat_lahir, tanggal_lahir, jenis_kelamin, agama, pangkat_golongan, jabatan, unit_kerja, email, no_hp, alamat, status_verifikasi, catatan, foto, ijazah, sertifikat, sk, skp, sehat, skck, pakta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Verifikasi', '', ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(nip) DO UPDATE SET nama=excluded.nama, jenjang=excluded.jenjang, nik=excluded.nik, nuptk=excluded.nuptk, tempat_lahir=excluded.tempat_lahir, tanggal_lahir=excluded.tanggal_lahir, jenis_kelamin=excluded.jenis_kelamin, agama=excluded.agama, pangkat_golongan=excluded.pangkat_golongan, jabatan=excluded.jabatan, unit_kerja=excluded.unit_kerja, email=excluded.email, no_hp=excluded.no_hp, alamat=excluded.alamat, status_verifikasi='Belum Verifikasi', catatan='',
        foto=COALESCE(NULLIF(excluded.foto, ''), biodata.foto), ijazah=COALESCE(NULLIF(excluded.ijazah, ''), biodata.ijazah), sertifikat=COALESCE(NULLIF(excluded.sertifikat, ''), biodata.sertifikat), sk=COALESCE(NULLIF(excluded.sk, ''), biodata.sk), skp=COALESCE(NULLIF(excluded.skp, ''), biodata.skp), sehat=COALESCE(NULLIF(excluded.sehat, ''), biodata.sehat), skck=COALESCE(NULLIF(excluded.skck, ''), biodata.skck), pakta=COALESCE(NULLIF(excluded.pakta, ''), biodata.pakta)`;
        
        await db.execute({ sql: q, args: [fd.NIP, fd.Nama, fd.Jenjang, fd.NIK, fd.NUPTK, fd.Tempat_Lahir, fd.Tanggal_Lahir, fd.Jenis_Kelamin, fd.Agama, fd.Pangkat_Golongan, fd.Jabatan, fd.Unit_Kerja, fd.Email, fd.No_HP, fd.Alamat, fUrls['Foto']||fd.old_Foto||'', fUrls['Ijazah']||fd.old_Ijazah||'', fUrls['Sertifikat']||fd.old_Sertifikat||'', fUrls['SK']||fd.old_SK||'', fUrls['SKP']||fd.old_SKP||'', fUrls['Sehat']||fd.old_Sehat||'', fUrls['SKCK']||fd.old_SKCK||'', fUrls['Pakta']||fd.old_Pakta||''] });
        result = "Data berhasil disimpan dan terkirim ke Admin!";
        break;

      default:
        throw new Error("Action tidak ditemukan!");
    }
    res.status(200).json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
export async function fetchMigrationJobs() {
  try {
    // 1. Dapatkan token (sesuaikan dengan metode penyimpanan Anda, misal: localStorage atau state)
    const token = localStorage.getItem('token'); 
    
    // Pastikan token tidak undefined atau null sebelum melakukan request
    if (!token) {
      throw new Error('Akses ditolak: Token tidak ditemukan.');
    }

    // 2. Lakukan request API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/migration-jobs`, {
      method: 'GET', // Ubah menjadi POST dan tambahkan properti `body: JSON.stringify(data)` jika mengirim data
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    // 3. Evaluasi status HTTP (fetch tidak otomatis error pada status 400/500)
    if (!response.ok) {
      // Ambil detail pesan error dari backend jika tersedia
      const errorDetail = await response.json().catch(() => null);
      const errorMessage = errorDetail?.message || `Gagal memuat data. Status: ${response.status}`;
      throw new Error(errorMessage);
    }

    // 4. Parse respons JSON jika berhasil
    const data = await response.json();
    return data;

  } catch (error) {
    // 5. Tangkap dan log error
    console.error('Error pada fetchMigrationJobs:', error);
    
    // Lempar kembali error agar bisa ditangani oleh UI/Komponen pemanggil (misal untuk menampilkan toast error)
    throw error; 
  }
}
