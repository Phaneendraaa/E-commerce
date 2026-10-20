'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, ImagePlus, Upload, X } from 'lucide-react';
import { Img, Sheet, Spinner } from '@/components/ui';

interface MediaFile {
  path: string;
  size: number;
}

/** Browse /public/images or upload new images. Returns chosen paths. */
export function MediaPicker({ open, onClose, onPick, multiple = true }: { open: boolean; onClose: () => void; onPick: (paths: string[]) => void; multiple?: boolean }) {
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = async () => {
    const r = await fetch(`/media-api?q=${encodeURIComponent(q)}`, { credentials: 'include' });
    const d = await r.json();
    if (!r.ok) return toast.error(d.error?.message ?? 'Could not load images');
    setFiles(d.files);
  };

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    const fd = new FormData();
    [...list].forEach((f) => fd.append('files', f));
    try {
      const r = await fetch('/media-api', { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message ?? 'Upload failed');
      toast.success(`${d.paths.length} image${d.paths.length === 1 ? '' : 's'} uploaded`);
      setPicked((p) => (multiple ? [...p, ...d.paths] : d.paths.slice(0, 1)));
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Media library" side="center" width="max-w-4xl">
      <div
        className="p-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by file name" className="field !h-9 max-w-xs text-sm" aria-label="Filter images" />
          <input ref={input} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={(e) => upload(e.target.files)} />
          <button onClick={() => input.current?.click()} disabled={uploading} className="btn btn-outline btn-sm">
            {uploading ? <Spinner size={14} /> : <Upload size={15} />} Upload
          </button>
          <span className="text-xs text-muted">or drop files here · JPG, PNG, WebP, SVG up to 5 MB</span>
        </div>
        <div className="mt-4 grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5 lg:grid-cols-6">
          {!files && <Spinner />}
          {files?.map((f) => {
            const on = picked.includes(f.path);
            return (
              <button
                key={f.path}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== f.path) : multiple ? [...p, f.path] : [f.path]))}
                className={`relative overflow-hidden rounded-[var(--radius-sm)] bg-tile ring-offset-2 ${on ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:ring-ink'}`}
                title={f.path}
              >
                <Img src={f.path} alt="" className="aspect-square w-full object-cover" />
                {on && (
                  <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink text-white">
                    <Check size={14} />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-surface/90 px-1.5 py-0.5 text-left text-[10px]">{f.path.split('/').pop()}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm text-muted">{picked.length} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button
              disabled={!picked.length}
              onClick={() => {
                onPick(picked);
                onClose();
              }}
              className="btn btn-primary btn-sm"
            >
              <ImagePlus size={15} /> Use {picked.length > 1 ? `${picked.length} images` : 'image'}
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Ordered image list with add/remove/reorder. */
export function ImageListField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState('');
  const move = (i: number, d: -1 | 1) => {
    const n = [...value];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {value.map((src, i) => (
          <div key={src + i} className="group relative overflow-hidden rounded-[var(--radius-sm)] bg-tile ring-1 ring-line">
            <Img src={src} alt="" className="aspect-square w-full object-cover" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">Main</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-surface/90 p-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <button type="button" onClick={() => move(i, -1)} className="px-1.5 text-sm" aria-label="Move left">
                ←
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="px-1.5 text-danger" aria-label="Remove image">
                <X size={14} />
              </button>
              <button type="button" onClick={() => move(i, 1)} className="px-1.5 text-sm" aria-label="Move right">
                →
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="grid aspect-square place-items-center rounded-[var(--radius-sm)] border-[1.5px] border-dashed border-line text-sm text-muted hover:border-ink hover:text-ink">
          <span className="flex flex-col items-center gap-1">
            <ImagePlus size={20} /> Add images
          </span>
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="…or paste a path like /images/products/my-photo.jpg" className="field !h-9 text-sm" aria-label="Image path" />
        <button
          type="button"
          onClick={() => {
            if (manual.trim()) onChange([...value, manual.trim()]);
            setManual('');
          }}
          className="btn btn-outline btn-sm !h-9"
        >
          Add
        </button>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onPick={(p) => onChange([...value, ...p.filter((x) => !value.includes(x))])} />
    </div>
  );
}
