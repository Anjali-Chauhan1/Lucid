import { NextResponse } from "next/server";
import { getAssignment } from "@/lib/assignments";

export const runtime = "nodejs";

/**
 * GET — looks up what an assignment code points to. The join page only
 * needs `assignment`; the teacher dashboard also reads `submissions`.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const data = await getAssignment(code);
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
