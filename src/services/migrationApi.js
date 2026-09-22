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
