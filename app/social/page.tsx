'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

type Tab = 'feed' | 'find' | 'requests';

interface Me {
  username: string | null;
  bio: string | null;
  isPublic: boolean;
  followers: number;
  following: number;
  pendingCount: number;
}

interface Sharer {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

interface FeedItem {
  id: string;
  itemType: 'routine' | 'program';
  title: string;
  caption: string | null;
  recreateCount: number;
  createdAt: string;
  sharer: Sharer;
  isOwn: boolean;
  alreadyRecreated: boolean;
}

interface SearchUser extends Sharer {
  followState: 'none' | 'pending' | 'accepted';
}

interface FollowRequest {
  id: string;
  createdAt: string;
  follower: Sharer;
}

function Avatar({ user, size = 40 }: { user: Sharer; size?: number }) {
  const initial = (user.name || user.username || '?').charAt(0).toUpperCase();
  return user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold" style={{ width: size, height: size }}>
      {initial}
    </div>
  );
}

function userHandle(u: Sharer): string {
  return u.username ? `@${u.username}` : u.name || 'Someone';
}

export default function SocialPage() {
  const { status } = useSession();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('feed');
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(() => {
    fetch('/api/social/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMe(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === 'authenticated') loadMe();
  }, [status, loadMe]);

  if (status !== 'authenticated') {
    return <div className="p-6 text-center text-slate-400">Sign in to use Social.</div>;
  }

  // First-run: must set a username before discovery works.
  if (me && !me.username) {
    return <SetUsername onDone={loadMe} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 shrink-0 border-b border-border-dark">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Social</h1>
          {me && (
            <div className="text-right text-xs text-slate-400">
              <div className="text-primary font-semibold">@{me.username}</div>
              <div>{me.followers} followers · {me.following} following</div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          {(['feed', 'find', 'requests'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                tab === t ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'feed' ? 'FEED' : t === 'find' ? 'FIND' : 'REQUESTS'}
              {t === 'requests' && me && me.pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] w-4 h-4">
                  {me.pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {tab === 'feed' && <FeedTab toast={toast} />}
        {tab === 'find' && <FindTab toast={toast} />}
        {tab === 'requests' && <RequestsTab toast={toast} onChange={loadMe} />}
      </div>
    </div>
  );
}

// ─── Set username (first run) ────────────────────────────────────────────────

function SetUsername({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      });
      if (res.ok) {
        toast('Username set!');
        onDone();
      } else {
        const d = await res.json().catch(() => ({}));
        toast(d.error || 'Could not set username', 'error');
      }
    } catch {
      toast('Could not set username', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-2xl font-black text-white mb-2">Pick a username</h1>
      <p className="text-sm text-slate-400 mb-4">
        Your handle is how friends find and follow you. Lowercase letters, numbers, and underscores (3–20 chars).
      </p>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-slate-500 text-lg">@</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          placeholder="alex_lifts"
          className="flex-1 bg-card border border-border-dark rounded-lg px-3 py-2 text-white outline-none focus:border-primary"
          autoFocus
        />
      </div>
      <Button onClick={save} disabled={saving || value.length < 3} className="w-full">
        {saving ? 'Saving…' : 'Continue'}
      </Button>
    </div>
  );
}

// ─── Feed ────────────────────────────────────────────────────────────────────

function FeedTab({ toast }: { toast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recreating, setRecreating] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/social/feed')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeShare = async (item: FeedItem) => {
    if (!confirm('Delete this shared post? Followers will no longer see it.')) return;
    setRemoving(item.id);
    try {
      const res = await fetch(`/api/social/share?id=${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((p) => p.id !== item.id));
        toast('Share deleted');
      } else {
        toast('Could not delete', 'error');
      }
    } catch {
      toast('Could not delete', 'error');
    } finally {
      setRemoving(null);
    }
  };

  const recreate = async (item: FeedItem) => {
    setRecreating(item.id);
    try {
      const res = await fetch('/api/social/recreate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharePostId: item.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(item.itemType === 'program' ? 'Program added (inactive). Activate it in Workouts.' : 'Routine added to your workouts!');
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, alreadyRecreated: true, recreateCount: p.recreateCount + 1 } : p)));
      } else if (d.code === 'capReached') {
        toast(`You already have ${d.limit} programs. Remove one before recreating another.`, 'error');
      } else {
        toast(d.error || 'Could not recreate', 'error');
      }
    } catch {
      toast('Could not recreate', 'error');
    } finally {
      setRecreating(null);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm py-8 text-center">Loading feed…</p>;
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="font-semibold text-slate-300 mb-1">Your feed is empty</p>
        <p className="text-sm">Share a routine or program, or follow people in “Find People” to see what they share.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <div className="flex items-center gap-3 mb-3">
            <Avatar user={item.sharer} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {item.isOwn ? 'You' : userHandle(item.sharer)}
              </div>
              <div className="text-xs text-slate-500">shared a {item.itemType}</div>
            </div>
            <Badge variant={item.itemType === 'program' ? 'info' : 'default'} className="ml-auto">
              {item.itemType}
            </Badge>
          </div>
          <div className="text-white font-bold">{item.title}</div>
          {item.caption && <p className="text-sm text-slate-300 mt-1">{item.caption}</p>}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-500">{item.recreateCount} recreated</span>
            {item.isOwn ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={removing === item.id}
                onClick={() => removeShare(item)}
              >
                {removing === item.id ? 'Deleting…' : 'Delete'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant={item.alreadyRecreated ? 'ghost' : 'primary'}
                disabled={item.alreadyRecreated || recreating === item.id}
                onClick={() => recreate(item)}
              >
                {item.alreadyRecreated ? 'Added ✓' : recreating === item.id ? 'Adding…' : 'Recreate'}
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Find people ─────────────────────────────────────────────────────────────

function FindTab({ toast }: { toast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    // All state updates happen inside the (async) timeout callback so the effect
    // body itself never calls setState synchronously.
    debounce.current = setTimeout(() => {
      if (term.length < 2) { setResults([]); setLoading(false); return; }
      setLoading(true);
      fetch(`/api/social/users/search?q=${encodeURIComponent(term)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setResults(d))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  const follow = async (u: SearchUser) => {
    try {
      const res = await fetch('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: u.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setResults((prev) => prev.map((p) => (p.id === u.id ? { ...p, followState: d.status } : p)));
        toast(d.status === 'accepted' ? 'Following!' : 'Request sent');
      } else {
        toast(d.error || 'Could not follow', 'error');
      }
    } catch {
      toast('Could not follow', 'error');
    }
  };

  const unfollow = async (u: SearchUser) => {
    try {
      await fetch('/api/social/follow', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: u.id }),
      });
      setResults((prev) => prev.map((p) => (p.id === u.id ? { ...p, followState: 'none' } : p)));
    } catch {
      toast('Could not update', 'error');
    }
  };

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by username or name…"
        className="w-full bg-card border border-border-dark rounded-lg px-3 py-2 text-white outline-none focus:border-primary mb-3"
      />
      {loading && <p className="text-slate-400 text-sm py-4 text-center">Searching…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <p className="text-slate-400 text-sm py-4 text-center">No one found.</p>
      )}
      <div className="space-y-2">
        {results.map((u) => (
          <Card key={u.id} className="flex items-center gap-3">
            <Avatar user={u} size={36} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{u.name || userHandle(u)}</div>
              {u.username && <div className="text-xs text-slate-500">@{u.username}</div>}
            </div>
            <div className="ml-auto">
              {u.followState === 'accepted' ? (
                <Button size="sm" variant="ghost" onClick={() => unfollow(u)}>Following</Button>
              ) : u.followState === 'pending' ? (
                <Button size="sm" variant="secondary" onClick={() => unfollow(u)}>Requested</Button>
              ) : (
                <Button size="sm" onClick={() => follow(u)}>Follow</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Requests ────────────────────────────────────────────────────────────────

function RequestsTab({ toast, onChange }: { toast: (m: string, t?: 'success' | 'error' | 'info') => void; onChange: () => void }) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/social/requests')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRequests(d))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (req: FollowRequest, accept: boolean) => {
    try {
      const res = await fetch('/api/social/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followId: req.id, accept }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
        onChange();
        toast(accept ? `Accepted ${userHandle(req.follower)}` : 'Declined');
      } else {
        toast('Could not update', 'error');
      }
    } catch {
      toast('Could not update', 'error');
    }
  };

  if (loading) return <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>;
  if (requests.length === 0) return <p className="text-slate-400 text-sm py-8 text-center">No pending requests.</p>;

  return (
    <div className="space-y-2">
      {requests.map((req) => (
        <Card key={req.id} className="flex items-center gap-3">
          <Avatar user={req.follower} size={36} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{req.follower.name || userHandle(req.follower)}</div>
            {req.follower.username && <div className="text-xs text-slate-500">@{req.follower.username}</div>}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => act(req, true)}>Accept</Button>
            <Button size="sm" variant="ghost" onClick={() => act(req, false)}>Decline</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
