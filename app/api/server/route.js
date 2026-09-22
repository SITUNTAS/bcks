import { NextResponse } from "next/server";
import { turso } from "@/lib/db";

export async function GET(request) {
  try {
    // Contoh query sederhana untuk mengetes koneksi
    const result = await turso.execute("SELECT 1 AS status");
    
    return NextResponse.json({ 
      success: true, 
      data: result.rows,
      message: "Koneksi ke Turso berhasil"
    }, { status: 200 });

  } catch (error) {
    console.error("Database connection error:", error);
    
    // Memberikan response 500 yang lebih informatif daripada 400
    return NextResponse.json({ 
      success: false, 
      error: "Gagal terhubung ke sistem database.",
      details: error.message
    }, { status: 500 });
  }
}
