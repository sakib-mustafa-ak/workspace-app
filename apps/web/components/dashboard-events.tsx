'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Clock3, Loader2, MapPin, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { eventsApi, type PersonalEvent } from '@/lib/events';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useToast } from '@/contexts/toast-context';
import { ConfirmModal } from './confirm-modal';

function localDateInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function EventEditor({ event, onClose, onSaved }: { event: PersonalEvent | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [start, setStart] = useState(localDateInput(event?.startsAt ?? new Date(Date.now() + 3600000).toISOString()));
  const [end, setEnd] = useState(event?.endsAt ? localDateInput(event.endsAt) : '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const close = useCallback(() => { if (!saving) onClose(); }, [saving, onClose]);
  const trapRef = useFocusTrap(true, close);
  const fieldClass = 'mt-1.5 block w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2.5 text-sm text-surface-200 outline-none focus:border-primary-400';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError('');
    const startsAt = new Date(start);
    const endsAt = end ? new Date(end) : null;
    if (!title.trim() || !Number.isFinite(startsAt.getTime())) { setError('Enter a title and valid start time.'); return; }
    if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)) { setError('End time must be after the start time.'); return; }
    if ((endsAt ?? startsAt).getTime() < Date.now()) { setError('Choose a future time for this event.'); return; }
    setSaving(true);
    try {
      const input = { title: title.trim(), startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null, location: location.trim() || null, notes: notes.trim() || null };
      if (event) await eventsApi.update(event.id, input);
      else await eventsApi.create(input);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this event.');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/60 p-4" onClick={close}>
      <section ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="event-editor-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-surface-700 bg-surface-900 p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between"><h2 id="event-editor-title" className="text-base font-semibold">{event ? 'Edit event' : 'New event'}</h2><button type="button" disabled={saving} onClick={close} aria-label="Close event editor" className="rounded-lg p-2 text-surface-400 hover:bg-surface-800"><X size={16} /></button></div>
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          <label className="block text-xs text-surface-400">Event title<input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design review" className={fieldClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs text-surface-400">Starts<input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={fieldClass} /></label>
            <label className="block text-xs text-surface-400">Ends (optional)<input type="datetime-local" min={start} value={end} onChange={(e) => setEnd(e.target.value)} className={fieldClass} /></label>
          </div>
          <p className="text-[11px] text-surface-500">Times use your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
          <label className="block text-xs text-surface-400">Location (optional)<input maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, address, or meeting link" className={fieldClass} /></label>
          <label className="block text-xs text-surface-400">Notes (optional)<textarea maxLength={2000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} /></label>
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-surface-800 pt-4"><button type="button" disabled={saving} onClick={close} className="rounded-lg px-4 py-2 text-xs text-surface-400 hover:bg-surface-800">Cancel</button><button disabled={saving || !title.trim()} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">{saving && <Loader2 size={13} className="animate-spin" />}{saving ? 'Saving…' : 'Save event'}</button></div>
        </form>
      </section>
    </div>
  );
}

export function DashboardEvents() {
  const [events, setEvents] = useState<PersonalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ event: PersonalEvent | null } | null>(null);
  const [deleting, setDeleting] = useState<PersonalEvent | null>(null);
  const [removing, setRemoving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const generation = useRef(0);
  const toast = useToast();
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const next = await eventsApi.list();
      if (request === generation.current) setEvents(next);
    } catch {
      if (request === generation.current) setError('Could not load events. Try again.');
    } finally { if (request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void reload();
    return () => {
      // Invalidate pending requests; this ref is a counter, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [reload]);

  async function remove() {
    if (!deleting || removing) return;
    setRemoving(true);
    try {
      await eventsApi.remove(deleting.id);
      setDeleting(null);
      await reload();
      toast.success('Event deleted');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not delete event.'); }
    finally { setRemoving(false); }
  }

  return (
    <section aria-labelledby="dashboard-events-title" className="rounded-xl border border-surface-800 bg-surface-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dashboard-events-title" className="text-sm font-semibold text-surface-200">Events</h2>
        <div className="flex items-center gap-1"><button type="button" disabled={loading} aria-label="Refresh events" onClick={() => void reload()} className="rounded-lg p-2 text-surface-500 hover:bg-surface-800"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button><button type="button" onClick={() => setEditor({ event: null })} className="flex items-center gap-1 rounded-lg border border-surface-700 px-2.5 py-1.5 text-xs text-surface-300 hover:bg-surface-800"><Plus size={13} />New event</button></div>
      </div>
      <p className="mb-4 mt-1 text-xs text-surface-500">Your upcoming schedule · private to you</p>
      {loading ? <p role="status" className="py-6 text-center text-xs text-surface-500">Loading events…</p> : error ? <div role="alert" className="py-4 text-xs text-surface-400"><p>{error}</p><button onClick={() => void reload()} className="mt-3 text-primary-400">Try again</button></div> : events.length === 0 ? <div className="rounded-lg border border-dashed border-surface-800 p-4"><CalendarDays size={18} className="mb-3 text-surface-500" /><p className="text-xs text-surface-300">No upcoming events</p><p className="mt-2 text-xs leading-relaxed text-surface-500">Plan a meeting, deadline, or time to focus.</p></div> : (
        <>
          <ul className="max-h-96 divide-y divide-surface-800 overflow-y-auto">
            {(expanded ? events : events.slice(0, 5)).map((event) => {
              const start = new Date(event.startsAt);
              return <li key={event.id} className="py-3">
                <div className="flex items-start gap-3">
                  <div aria-hidden="true" className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-surface-800 py-1.5"><span className="text-[9px] uppercase text-surface-500">{start.toLocaleDateString(undefined, { month: 'short' })}</span><span className="text-sm font-semibold text-surface-300">{start.getDate()}</span></div>
                  <div className="min-w-0 flex-1"><button onClick={() => setEditor({ event })} className="w-full break-words text-left text-xs font-medium leading-relaxed text-surface-200">{event.title}</button><p className="mt-1.5 flex items-center gap-1 text-[11px] text-surface-500"><Clock3 size={11} className="shrink-0" /><time dateTime={event.startsAt}>{start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>{event.endsAt && <span>– {new Date(event.endsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}</p>{event.location && <p className="mt-1 flex items-center gap-1 text-[11px] text-surface-500"><MapPin size={11} className="shrink-0" /><span className="truncate">{event.location}</span></p>}</div>
                </div>
                <div className="mt-2 flex justify-end gap-1"><button onClick={() => setEditor({ event })} aria-label={`Edit ${event.title}`} className="rounded p-1.5 text-surface-500 hover:bg-surface-800"><Pencil size={12} /></button><button onClick={() => setDeleting(event)} aria-label={`Delete ${event.title}`} className="rounded p-1.5 text-surface-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={12} /></button></div>
              </li>;
            })}
          </ul>
          {events.length > 5 && <button onClick={() => setExpanded(!expanded)} className="mt-3 text-xs text-surface-400 hover:underline">{expanded ? 'Show fewer events' : `Show all ${events.length} events`}</button>}
          {events.length === 100 && <p className="mt-3 text-[11px] text-surface-500">Showing the next 100 events.</p>}
        </>
      )}
      {editor && <EventEditor event={editor.event} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); void reload(); toast.success('Event saved'); }} />}
      <ConfirmModal open={Boolean(deleting)} title="Delete this event?" description={`Remove “${deleting?.title ?? ''}” from your schedule?`} confirmLabel="Delete event" variant="danger" loading={removing} onCancel={() => { if (!removing) setDeleting(null); }} onConfirm={() => void remove()} />
    </section>
  );
}
