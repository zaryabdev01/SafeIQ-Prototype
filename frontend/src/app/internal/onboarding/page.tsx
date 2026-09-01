"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/apiClient";
import type { ApiVideoAudience } from "@/lib/apiClient";
import {
  internalApiClient,
  putToPresignedUrl,
  type CreateVideoInput,
  type InternalVideo,
} from "@/lib/internalApiClient";
import { GripVertical, Loader2, Pencil, Plus, Trash2, GraduationCap, ExternalLink } from "lucide-react";

const GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600",
  "from-slate-600 to-slate-800",
];

const AUDIENCE_LABELS: Record<ApiVideoAudience, string> = {
  all: "Everyone",
  organisation: "Organisation",
  employee: "Employee",
};

const CATEGORIES = [
  "Getting Started",
  "Employees",
  "Training",
  "Reports",
  "Account",
  "Billing",
  "Troubleshooting",
  "General",
];


export default function InternalOnboardingPage() {
  const { currentUser } = useApp();
  const isInternal = currentUser?.role === "internal";

  const [videos, setVideos] = useState<InternalVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InternalVideo | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await internalApiClient.listVideos();
      setVideos([...list].sort((a, b) => a.order_index - b.order_index));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the video catalogue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on mount/session-change; the loading flag must flip synchronously
    if (isInternal) void refresh();
  }, [isInternal, refresh]);

  async function persistOrder(next: InternalVideo[]) {
    const previous = videos;
    setVideos(next.map((v, i) => ({ ...v, order_index: i })));
    try {
      await internalApiClient.reorderVideos(next.map((v) => v.id));
    } catch (err) {
      setVideos(previous);
      setError(err instanceof ApiError ? err.message : "Could not save the new order.");
    }
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...videos];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  }

  async function handleDelete(video: InternalVideo) {
    if (!window.confirm(`Delete “${video.title}”? This removes it for every organisation.`)) return;
    try {
      await internalApiClient.deleteVideo(video.id);
      setVideos((vs) => vs.filter((v) => v.id !== video.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that video.");
    }
  }

  if (!currentUser) return null;

  if (!isInternal) {
    return (
      <AppShell title="Onboarding CMS" subtitle="SafeIQ Internal">
        <Card className="p-6 text-sm text-slate-600">
          This area is for SafeIQ Internal accounts. <Link href="/login" className="text-brand font-medium">Sign in to the Internal console</Link>.
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Onboarding CMS" subtitle="One shared video library — every organisation sees this list">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">
          {videos.length} video{videos.length === 1 ? "" : "s"} · drag rows to reorder
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={14} /> Add video
        </Button>
      </div>

      {error && <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <Card className="divide-y divide-slate-100">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : videos.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            <GraduationCap size={20} className="mx-auto mb-2 opacity-50" />
            No videos yet. Add the first one.
          </div>
        ) : (
          videos.map((video, index) => (
            <div
              key={video.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className={`flex items-center gap-3 px-4 py-3 ${dragIndex === index ? "opacity-40" : ""}`}
            >
              <GripVertical size={16} className="text-slate-300 cursor-grab shrink-0" />
              <div className={`h-10 w-16 rounded-md bg-gradient-to-br ${video.thumbnail_gradient} shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{video.title}</p>
                <p className="text-xs text-slate-400 truncate">{video.description}</p>
              </div>
              {video.media_url && (
                <a
                  href={video.media_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-brand shrink-0"
                  title="Open media"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              {video.category && <Badge tone="indigo">{video.category}</Badge>}
              <Badge tone="slate">{AUDIENCE_LABELS[video.audience]}</Badge>
              <button
                onClick={() => { setEditing(video); setFormOpen(true); }}
                className="text-slate-400 hover:text-brand p-1.5 rounded-md hover:bg-slate-100 shrink-0"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(video)}
                className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 shrink-0"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </Card>

      {formOpen && (
        <VideoForm
          existing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={(video) => {
            setFormOpen(false);
            setVideos((vs) => {
              const without = vs.filter((v) => v.id !== video.id);
              return [...without, video].sort((a, b) => a.order_index - b.order_index);
            });
          }}
          onError={setError}
        />
      )}
    </AppShell>
  );
}

function VideoForm({
  existing,
  onClose,
  onSaved,
  onError,
}: {
  existing: InternalVideo | null;
  onClose: () => void;
  onSaved: (video: InternalVideo) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [gradient, setGradient] = useState(existing?.thumbnail_gradient ?? GRADIENTS[0]);
  const [audience, setAudience] = useState<ApiVideoAudience>(existing?.audience ?? "all");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [mediaUrl, setMediaUrl] = useState(existing?.media_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim() || !description.trim()) {
      onError("Title and description are required.");
      return;
    }
    setBusy(true);
    try {
      const payload: CreateVideoInput = {
        title: title.trim(),
        description: description.trim(),
        thumbnail_gradient: gradient,
        audience,
        category: category || null,
        media_url: mediaUrl.trim() || null,
        media_key: null,
      };

      if (file) {
        const upload = await internalApiClient.createUploadUrl(file.name, file.type || "application/octet-stream");
        await putToPresignedUrl(upload.upload_url, upload.headers, file);
        payload.media_key = upload.media_key;
        payload.media_url = null;
      }

      const saved = existing
        ? await internalApiClient.updateVideo(existing.id, payload)
        : await internalApiClient.createVideo(payload);
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        onError("Media upload isn’t enabled on this environment yet — paste a link instead.");
      } else {
        onError(err instanceof ApiError ? err.message : "Could not save that video.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={existing ? "Edit video" : "Add video"}>
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Creating your first RAG" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label>Audience</Label>
          <Select value={audience} onChange={(e) => setAudience(e.target.value as ApiVideoAudience)}>
            <option value="all">Everyone</option>
            <option value="organisation">Organisation</option>
            <option value="employee">Employee</option>
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Uncategorised</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Thumbnail</Label>
          <div className="flex gap-2">
            {GRADIENTS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradient(g)}
                className={`h-8 w-8 rounded-md bg-gradient-to-br ${g} ${gradient === g ? "ring-2 ring-offset-2 ring-brand" : ""}`}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Media file (optional)</Label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-200"
          />
          <p className="mt-1 text-xs text-slate-400">
            {file ? `Selected: ${file.name}` : "Uploads straight to storage. Or paste a link below."}
          </p>
        </div>
        <div>
          <Label>…or media link</Label>
          <Input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://…"
            disabled={!!file}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {existing ? "Save changes" : "Add video"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
