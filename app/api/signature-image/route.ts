import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shipmentNo = searchParams.get("shipmentNo");
  
  if (!shipmentNo) {
    return NextResponse.json({ error: "shipmentNo is required" }, { status: 400 });
  }

  try {
    // Créer une image PNG simple avec Canvas (simulé avec un fichier SVG converti en PNG)
    const svgContent = `
      <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="200" fill="white"/>
        <rect x="10" y="10" width="380" height="180" fill="none" stroke="#ccc" stroke-width="1"/>
        <text x="20" y="30" font-family="Arial" font-size="12" fill="#666">Signature client</text>
        <path d="M 50 100 Q 100 80, 150 100 T 250 100 Q 300 90, 350 100" 
              stroke="#0e112c" stroke-width="2" fill="none"/>
        <text x="20" y="180" font-family="Arial" font-size="10" fill="#999">Shipment: ${shipmentNo}</text>
        <text x="300" y="180" font-family="Arial" font-size="10" fill="#999">${new Date().toLocaleDateString()}</text>
      </svg>
    `;

    // Créer le répertoire des signatures s'il n'existe pas
    const signaturesDir = path.join(process.cwd(), "public", "mock-signatures");
    await mkdir(signaturesDir, { recursive: true });

    // Sauvegarder le fichier SVG
    const svgPath = path.join(signaturesDir, `${shipmentNo}.svg`);
    await writeFile(svgPath, svgContent);

    // Retourner l'image SVG
    return new NextResponse(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400", // Cache pour 24h
      },
    });
  } catch (error) {
    console.error("Error generating signature:", error);
    return NextResponse.json({ error: "Failed to generate signature" }, { status: 500 });
  }
}
