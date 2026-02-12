import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const shipmentNo = formData.get('shipmentNo') as string;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'L\'image ne doit pas dépasser 10MB' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    // Sur Vercel, on utilise /tmp pour les écritures, puis on copie dans public si possible
    const isVercel = !!process.env.VERCEL;
    const uploadsDir = isVercel ? join('/tmp', 'uploads', 'returns') : join(process.cwd(), 'public', 'uploads', 'returns');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${shipmentNo}_${timestamp}_${randomId}.${fileExtension}`;
    const filepath = join(uploadsDir, filename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Return file info
    // Sur Vercel, l'URL doit pointer vers l'API qui sert les fichiers depuis /tmp
    const url = isVercel ? `/api/uploads/${filename}` : `/uploads/returns/${filename}`;
    return NextResponse.json({
      id: `${timestamp}_${randomId}`,
      url,
      name: file.name,
      size: file.size,
      type: file.type
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error.message || 'Erreur lors du téléchargement du fichier' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'Nom de fichier manquant' }, { status: 400 });
    }

    const filepath = join(process.cwd(), 'public', 'uploads', 'returns', filename);
    
    // Check if file exists and delete it
    if (existsSync(filepath)) {
      const { unlink } = require('fs/promises');
      await unlink(filepath);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ 
      error: error.message || 'Erreur lors de la suppression du fichier' 
    }, { status: 500 });
  }
}
