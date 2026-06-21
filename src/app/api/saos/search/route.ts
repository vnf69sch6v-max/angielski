import { NextRequest, NextResponse } from "next/server";
import { searchJudgments } from "@/lib/saos";
import { SAOSSearchParams, CourtType, JudgmentType } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: SAOSSearchParams = {
      query: searchParams.get("query") || "",
      courtType: (searchParams.get("courtType") as CourtType) || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      keyword: searchParams.get("keyword") || undefined,
      judgmentType: (searchParams.get("judgmentType") as JudgmentType) || undefined,
      pageSize: parseInt(searchParams.get("pageSize") || "10", 10),
      pageNumber: parseInt(searchParams.get("pageNumber") || "0", 10),
    };

    if (!params.query && !params.keyword) {
      return NextResponse.json(
        { error: "Wymagany jest parametr 'query' lub 'keyword'" },
        { status: 400 }
      );
    }

    const data = await searchJudgments(params);

    return NextResponse.json(data);
  } catch (error) {
    console.error("SAOS search error:", error);
    return NextResponse.json(
      { error: "Błąd podczas wyszukiwania w bazie SAOS" },
      { status: 500 }
    );
  }
}
