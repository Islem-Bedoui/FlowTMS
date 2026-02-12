import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const isVercel = !!process.env.VERCEL;
    const pathSegments = params.path || [];
    const filename = pathSegments.join('/');
    
    // Sécurité : ne servir que les images dans returns
    if (!filename || filename.includes('..') || filename.includes('/') || !filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return NextResponse.json({ error: 'Fichier non autorisé' }, { status: 403 });
    }

    const filePath = isVercel 
      ? join('/tmp', 'uploads', 'returns', filename)
      : join(process.cwd(), 'public', 'uploads', 'returns', filename);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
    }

    // Vérifier que c'est bien un fichier image
    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: 'Fichier non trouvé' }, { status: 404 });
    }

    // Lire et servir le fichier
    const fileBuffer = await readFile(filePath);
    
    // Détecter le content-type
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                     ext === 'png' ? 'image/png' :
                     ext === 'gif' ? 'image/gif' :
                     ext === 'webp' ? 'image/webp' : 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000', // 1 an
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Serve image error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
