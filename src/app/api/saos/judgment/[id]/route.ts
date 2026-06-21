import { NextRequest, NextResponse } from "next/server";
import { getJudgment } from "@/lib/saos";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Nieprawidłowe ID wyroku" },
        { status: 400 }
      );
    }

    const judgment = await getJudgment(id);

    return NextResponse.json(judgment);
  } catch (error) {
    console.error("SAOS judgment fetch error:", error);
    return NextResponse.json(
      { error: "Błąd podczas pobierania wyroku z SAOS" },
      { status: 500 }
    );
  }
}
