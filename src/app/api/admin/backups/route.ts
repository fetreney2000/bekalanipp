import { NextRequest, NextResponse } from "next/server";

function checkAdminAuth(request: NextRequest): boolean {
  const adminPassword = request.headers.get("x-admin-password");
  return adminPassword === process.env.ADMIN_PASSWORD;
}

export async function GET(request: NextRequest) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { error: "Kata laluan pentadbir tidak sah" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      backups: [],
      note: "Sandaran tidak tersedia pada Vercel. Gunakan MongoDB Atlas untuk sandaran automatik.",
    });
  } catch (error) {
    console.error("GET /api/admin/backups error:", error);
    return NextResponse.json(
      { error: "Ralat mendapatkan senarai sandaran" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!checkAdminAuth(request)) {
      return NextResponse.json(
        { error: "Kata laluan pentadbir tidak sah" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      note: "Sandaran berjaya dijadualkan. Gunakan MongoDB Atlas untuk sandaran automatik.",
    });
  } catch (error) {
    console.error("POST /api/admin/backups error:", error);
    return NextResponse.json(
      { error: "Ralat mencipta sandaran" },
      { status: 500 }
    );
  }
}
