'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Address } from '@/lib/types';
import { AddressForm, type AddressInput } from '@/components/store/AddressForm';
import { Badge, Empty, Sheet } from '@/components/ui';

export default function AddressesPage() {
  const [list, setList] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);

  const load = () =>
    api<{ addresses: Address[] }>('/users/me/addresses')
      .then((r) => setList(r.addresses))
      .catch(() => setList([]));
  useEffect(() => {
    void load();
  }, []);

  const save = async (a: AddressInput) => {
    if (editing === 'new') await api('/users/me/addresses', { body: a });
    else if (editing) await api(`/users/me/addresses/${editing.id}`, { method: 'PUT', body: a });
    toast.success('Address saved');
    setEditing(null);
    await load();
  };

  const remove = async (a: Address) => {
    if (!confirm(`Delete the address for ${a.fullName}?`)) return;
    try {
      await api(`/users/me/addresses/${a.id}`, { method: 'DELETE' });
      toast.success('Address deleted');
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const makeDefault = async (a: Address) => {
    await api(`/users/me/addresses/${a.id}`, { method: 'PUT', body: { isDefault: true } });
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[22px] md:text-[28px]">Addresses</h1>
        <button onClick={() => setEditing('new')} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add address
        </button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {list?.map((a) => (
          <div key={a.id} className="rounded-[var(--radius)] bg-surface p-5 text-sm ring-1 ring-line">
            <div className="flex items-center gap-2">
              <b className="text-base">{a.fullName}</b>
              <Badge>{a.type[0] + a.type.slice(1).toLowerCase()}</Badge>
              {a.isDefault && <Badge tone="success">Default</Badge>}
            </div>
            <p className="mt-2 text-muted">
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              {a.landmark ? `, near ${a.landmark}` : ''}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              Phone: {a.phone}
            </p>
            <div className="mt-4 flex flex-wrap gap-1">
              <button onClick={() => setEditing(a)} className="btn btn-ghost btn-sm">
                <Pencil size={14} /> Edit
              </button>
              <button onClick={() => remove(a)} className="btn btn-ghost btn-sm text-danger">
                <Trash2 size={14} /> Delete
              </button>
              {!a.isDefault && (
                <button onClick={() => makeDefault(a)} className="btn btn-ghost btn-sm">
                  Set as default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {list && !list.length && <Empty icon={<MapPin size={26} />} title="No saved addresses" body="Save an address for faster checkout." />}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New address' : 'Edit address'} side="center" width="max-w-xl">
        <div className="p-5">{editing !== null && <AddressForm initial={editing === 'new' ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />}</div>
      </Sheet>
    </div>
  );
}
