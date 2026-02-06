import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../../functions/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeBase64PdfIfNeeded(buf: Buffer) {
  const headerAscii = buf.subarray(0, 8).toString("ascii");
  if (headerAscii.startsWith("%PDF-")) {
    return { ok: true as const, pdf: buf, headerAscii, mode: "pdf-bytes" as const };
  }

  const asText = buf.toString("utf8").trim();
  const cleaned = asText
    .replace(/^"|"$/g, "")
    .replace(/\s+/g, "");
  if (cleaned.startsWith("JVBER")) {
    try {
      const decoded = Buffer.from(cleaned, "base64");
      const decodedHeader = decoded.subarray(0, 8).toString("ascii");
      if (decodedHeader.startsWith("%PDF-")) {
        return { ok: true as const, pdf: decoded, headerAscii: decodedHeader, mode: "base64" as const };
      }
    } catch {
    }
  }

  return { ok: false as const, headerAscii, preview: asText.slice(0, 800) };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pdfUrl = searchParams.get("url");

    if (!pdfUrl) {
      return NextResponse.json(
        { error: "URL PDF requise" },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken();
    
    // Ajoutez cette ligne pour déboguer
    console.log("Fetching PDF from:", pdfUrl);

    const response = await fetch(pdfUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/pdf",
      },
      cache: "no-store",
    });

    // ✅ Vérification CRUCIALE
    if (!response.ok) {
      // Récupérez le corps de l'erreur
      const errorBody = await response.text();
      console.error("BC Error:", {
        status: response.status,
        body: errorBody,
        url: pdfUrl
      });
      
      return NextResponse.json(
        { error: `Erreur BC: ${response.status} - ${errorBody}` },
        { status: response.status }
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    const decoded = decodeBase64PdfIfNeeded(Buffer.from(pdfBuffer));
    if (!decoded.ok) {
      console.error("BC PDF invalid payload:", {
        headerAscii: decoded.headerAscii,
        preview: decoded.preview.slice(0, 500),
      });
      return NextResponse.json(
        { error: "BC did not return a PDF", headerAscii: decoded.headerAscii, preview: decoded.preview },
        { status: 502 }
      );
    }

    return new NextResponse(new Uint8Array(decoded.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=shipment.pdf",
      },
    });
  } catch (error: any) {
    console.error("Proxy Error:", error);
    return NextResponse.json(
      { error: "Erreur interne: " + error.message },
      { status: 500 }
    );
  }
}