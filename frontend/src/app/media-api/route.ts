import { NextResponse, type NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Media library for the admin panel. Product images live in the frontend's
 * /public/images folder (served statically by Next.js); the database stores
 * only their paths.
 *
 *  GET  /media-api          → list images (staff only)
 *  POST /media-api (form)   → upload images to /public/images/uploads (staff only)
 *
 * Note: uploads write to the local filesystem, which works on a VPS / Docker /
 * any long-running Node host. On serverless hosts with a read-only filesystem
 * (e.g. Vercel), commit images to /public instead or switch this handler to
 * object storage (S3, Cloudinary, R2).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const UPLOAD_DIR = path.join(IMAGES_DIR, 'uploads');
const API_URL = process.env.API_URL || 'http://localhost:4000';
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);
const MAX_BYTES = 5 * 1024 * 1024;

async function isStaff(req: NextRequest) {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: { cookie: req.headers.get('cookie') ?? '' }, cache: 'no-store' });
    if (!res.ok) return false;
    const { user } = await res.json();
    return ['SUPPORT', 'MANAGER', 'ADMIN'].includes(user?.role);
  } catch {
    return false;
  }
}

async function walk(dir: string): Promise<{ path: string; size: number; modified: number }[]> {
  const out: { path: string; size: number; modified: number }[] = [];
  let entries: import('fs').Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (ALLOWED.has(path.extname(e.name).toLowerCase())) {
      const st = await fs.stat(full);
      out.push({ path: '/' + path.relative(PUBLIC_DIR, full).split(path.sep).join('/'), size: st.size, modified: st.mtimeMs });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!(await isStaff(req))) return NextResponse.json({ error: { message: 'Staff only' } }, { status: 403 });
  const q = (req.nextUrl.searchParams.get('q') ?? '').toLowerCase();
  const files = (await walk(IMAGES_DIR)).filter((f) => !q || f.path.toLowerCase().includes(q)).sort((a, b) => b.modified - a.modified);
  return NextResponse.json({ files: files.slice(0, 500), total: files.length });
}

function safeName(name: string) {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'image'}-${Date.now().toString(36)}${ext}`;
}

export async function POST(req: NextRequest) {
  if (!(await isStaff(req))) return NextResponse.json({ error: { message: 'Staff only' } }, { status: 403 });
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: { message: 'Uploads are disabled on Vercel (read-only disk). Add images to frontend/public/images in the repo and push, then pick them here.' } },
      { status: 501 },
    );
  }
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: { message: 'No files received' } }, { status: 400 });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const saved: string[] = [];
  for (const f of files.slice(0, 20)) {
    const ext = path.extname(f.name).toLowerCase();
    if (!ALLOWED.has(ext)) return NextResponse.json({ error: { message: `${f.name}: unsupported file type` } }, { status: 400 });
    if (f.size > MAX_BYTES) return NextResponse.json({ error: { message: `${f.name} is larger than 5 MB` } }, { status: 400 });
    const name = safeName(f.name);
    await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await f.arrayBuffer()));
    saved.push(`/images/uploads/${name}`);
  }
  return NextResponse.json({ paths: saved }, { status: 201 });
}
