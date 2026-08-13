"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormRow, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatDuration } from "@/lib/format";
import { Sparkles, Play, Mail, Share2, Plus, Clock, Send, Loader2, BarChart3 } from "lucide-react";
import type { OnboardingVideo, VideoAudience } from "@/lib/types";
import { apiClient, ApiError, type ApiOnboardingAnalytics, type ApiOnboardingVideo, type ApiUserProfile } from "@/lib/apiClient";

const GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-teal-500 to-emerald-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-red-500 to-rose-600",
  "from-cyan-500 to-teal-600",
];

function mapApiVideo(v: ApiOnboardingVideo): OnboardingVideo {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    thumbnailGradient: v.thumbnail_gradient,
    audience: v.audience,
    order: v.order_index,
    durationSeconds: v.duration_seconds,
  };
}

export default function OnboardingPage() {
  const { currentUser, isRealSession, onboardingVideos, users, addVideo } = useApp();
  const isAdmin = isOrgLevel(currentUser);
  const [audience, setAudience] = useState<"all" | VideoAudience>("all");
  const [query, setQuery] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [viewAll, setViewAll] = useState(false);
  const [openVideo, setOpenVideo] = useState<OnboardingVideo | null>(null);
  const [shareVideo, setShareVideo] = useState<OnboardingVideo | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [flash, setFlash] = useState("");

  // --- Real-backend mode (Milestone 3's /onboarding/* - see backend/README.md) ---
  const [realVideos, setRealVideos] = useState<ApiOnboardingVideo[]>([]);
  const [realSearched, setRealSearched] = useState(false);
  const [realLoading, setRealLoading] = useState(false);
  const [realError, setRealError] = useState("");
  const [realBusy, setRealBusy] = useState(false);
  const [realTeamForShare, setRealTeamForShare] = useState<ApiUserProfile[]>([]);
  const [committedQuery, setCommittedQuery] = useState("");
  const [analytics, setAnalytics] = useState<ApiOnboardingAnalytics | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const refreshRealVideos = useCallback(async () => {
    setRealLoading(true);
    setRealError("");
    try {
      const videos = await apiClient.listOnboardingVideos({
        audience: audience === "all" ? undefined : audience,
        q: committedQuery || undefined,
      });
      setRealVideos(videos);
      setRealSearched(committedQuery.trim().length > 0);
    } catch (err) {
      setRealError(err instanceof ApiError ? err.message : "Could not load onboarding videos from the SafeIQ API.");
    } finally {
      setRealLoading(false);
    }
  }, [audience, committedQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on mount/filter-change; loading flag must flip synchronously
    if (isRealSession) void refreshRealVideos();
  }, [isRealSession, refreshRealVideos]);

  useEffect(() => {
    if (!isRealSession) return;
    apiClient
      .listTeam()
      .then(setRealTeamForShare)
      .catch(() => {});
  }, [isRealSession]);

  // --- Mock mode ---
  const filtered = useMemo(() => {
    let list = [...onboardingVideos].sort((a, b) => a.order - b.order);
    if (audience !== "all") list = list.filter((v) => v.audience === audience || v.audience === "all");
    if (aiSuggestions) list = list.filter((v) => aiSuggestions.includes(v.id));
    return list;
  }, [onboardingVideos, audience, aiSuggestions]);

  const activeList = isRealSession ? realVideos.map(mapApiVideo) : filtered;
  const visible = viewAll ? activeList : activeList.slice(0, 9);
  const noMatches = isRealSession ? realSearched && realVideos.length === 0 : !!aiSuggestions && aiSuggestions.length === 0;

  function runAiSearch() {
    if (isRealSession) {
      setCommittedQuery(query.trim());
      return;
    }
    if (!query.trim()) {
      setAiSuggestions(null);
      return;
    }
    const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const matches = onboardingVideos.filter((v) => words.some((w) => v.title.toLowerCase().includes(w) || v.description.toLowerCase().includes(w)));
    setAiSuggestions(matches.length > 0 ? matches.map((v) => v.id) : []);
  }

  function clearSearch() {
    setQuery("");
    setAiSuggestions(null);
    setCommittedQuery("");
  }

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 2600);
  }

  async function openVideoAndTrackView(v: OnboardingVideo) {
    setOpenVideo(v);
    if (isRealSession) {
      try {
        await apiClient.recordOnboardingVideoView(v.id);
      } catch {
        // best-effort analytics - never blocks viewing
      }
    }
  }

  async function handleAddVideo(data: Omit<OnboardingVideo, "id" | "order"> & { mediaName?: string }) {
    if (isRealSession) {
      setRealBusy(true);
      setRealError("");
      try {
        await apiClient.createOnboardingVideo({
          title: data.title,
          description: data.description,
          thumbnail_gradient: data.thumbnailGradient,
          media_url: data.mediaName || undefined,
          audience: data.audience,
          duration_seconds: data.durationSeconds,
        });
        await refreshRealVideos();
        setAddOpen(false);
        showFlash(`"${data.title}" added to onboarding.`);
      } catch (err) {
        setRealError(err instanceof ApiError ? err.message : "Could not add that video.");
      } finally {
        setRealBusy(false);
      }
      return;
    }
    addVideo(data);
    setAddOpen(false);
    showFlash(`"${data.title}" added to onboarding.`);
  }

  async function handleShare(video: OnboardingVideo, target: { email?: string; userId?: string }) {
    if (isRealSession) {
      try {
        await apiClient.shareOnboardingVideo(video.id, { email: target.email, user_id: target.userId });
        const label = target.email ?? realTeamForShare.find((u) => u.id === target.userId)?.name ?? "that person";
        showFlash(`"${video.title}" shared with ${label}.`);
      } catch (err) {
        showFlash(err instanceof ApiError ? err.message : "Could not share that video.");
      } finally {
        setShareVideo(null);
      }
      return;
    }
    const label = target.email ?? users.find((u) => u.id === target.userId)?.name ?? "that person";
    showFlash(`"${video.title}" shared with ${label}.`);
    setShareVideo(null);
  }

  async function openAnalytics() {
    setAnalyticsOpen(true);
    setAnalyticsLoading(true);
    try {
      setAnalytics(await apiClient.onboardingAnalytics());
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  return (
    <AppShell
      title="Onboarding"
      subtitle={isRealSession ? "Help videos - live from the SafeIQ API" : "Help videos and guided support for your team"}
    >
      {isRealSession && realError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{realError}</p>}

      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAiSearch()}
              placeholder="Describe what you want support with... e.g. 'how do I create a RAG'"
              className="pl-9"
            />
          </div>
          <Button onClick={runAiSearch} disabled={isRealSession && realLoading}>
            {isRealSession && realLoading ? <Loader2 size={14} className="animate-spin" /> : null} Ask AI &amp; search
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Select value={audience} onChange={(e) => setAudience(e.target.value as never)} className="!w-auto">
            <option value="all">All end user types</option>
            <option value="organisation">Organisation</option>
            <option value="employee">Employee</option>
          </Select>
          <button onClick={() => setViewAll((v) => !v)} className="text-sm font-medium text-brand hover:underline">
            {viewAll ? "Show default 9" : "View all videos"}
          </button>
          {(aiSuggestions || committedQuery) && (
            <button onClick={clearSearch} className="text-xs text-slate-400 hover:text-slate-600">
              Clear AI suggestions
            </button>
          )}
          {isAdmin && (
            <>
              {isRealSession && (
                <Button size="sm" variant="ghost" onClick={openAnalytics}>
                  <BarChart3 size={14} /> Analytics
                </Button>
              )}
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Add video (CRM)
              </Button>
            </>
          )}
        </div>
        {noMatches && <p className="text-xs text-amber-600 mt-2">No matching videos found - try different wording, or browse all videos below.</p>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((v) => (
          <div
            key={v.id}
            className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white cursor-pointer"
            onClick={() => openVideoAndTrackView(v)}
          >
            <div className={`h-32 bg-gradient-to-br ${v.thumbnailGradient} flex items-center justify-center relative`}>
              <div className="w-11 h-11 rounded-full bg-white/25 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play size={18} className="text-white fill-white ml-0.5" />
              </div>
              <span className="absolute bottom-2 right-2 text-[10px] bg-black/40 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock size={9} /> {formatDuration(v.durationSeconds)}
              </span>
            </div>
            <div className="p-3.5">
              <p className="text-sm font-medium text-slate-800 truncate">{v.title}</p>
              <Badge tone={v.audience === "organisation" ? "indigo" : v.audience === "employee" ? "teal" : "slate"} className="mt-1.5">
                {v.audience}
              </Badge>
            </div>

            <div className="absolute inset-0 bg-slate-900/85 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between text-white">
              <div>
                <p className="text-sm font-semibold mb-1.5">{v.title}</p>
                <p className="text-xs text-slate-300 line-clamp-4">{v.description}</p>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShareVideo(v)}
                  className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg"
                >
                  <Share2 size={12} /> Share
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {visible.length === 0 && !noMatches && <p className="text-sm text-slate-400 text-center py-16">No videos to show for this filter.</p>}

      <Modal open={!!openVideo} onClose={() => setOpenVideo(null)} title={openVideo?.title ?? ""} widthClass="max-w-xl">
        {openVideo && (
          <div>
            <div className={`h-56 rounded-lg bg-gradient-to-br ${openVideo.thumbnailGradient} flex items-center justify-center mb-4`}>
              <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                <Play size={26} className="text-white fill-white ml-1" />
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">{openVideo.description}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock size={12} /> {formatDuration(openVideo.durationSeconds)}
              <Badge tone={openVideo.audience === "organisation" ? "indigo" : openVideo.audience === "employee" ? "teal" : "slate"}>{openVideo.audience}</Badge>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!shareVideo} onClose={() => setShareVideo(null)} title="Share video">
        {shareVideo && (
          <ShareForm
            onSubmit={(target) => handleShare(shareVideo, target)}
            users={isRealSession ? realTeamForShare.map((u) => ({ id: u.id, name: u.name, email: u.email })) : users}
          />
        )}
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add onboarding video">
        <AddVideoForm onSubmit={handleAddVideo} busy={realBusy} />
      </Modal>

      <Modal open={analyticsOpen} onClose={() => setAnalyticsOpen(false)} title="Onboarding analytics" widthClass="max-w-lg">
        {analyticsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : analytics ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-800">{analytics.total_views}</p>
                <p className="text-xs text-slate-500">Views</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-800">{analytics.total_shares}</p>
                <p className="text-xs text-slate-500">Shares</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-800">{analytics.total_searches}</p>
                <p className="text-xs text-slate-500">Searches</p>
              </div>
            </div>
            {analytics.top_search_queries.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">Top search queries</p>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.top_search_queries.map((q) => (
                    <Badge key={q} tone="slate">
                      {q}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {analytics.videos.map((v) => (
                <div key={v.video_id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-slate-700 truncate">{v.title}</span>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">
                    {v.view_count} views · {v.share_count} shares
                  </span>
                </div>
              ))}
              {analytics.videos.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No videos yet.</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-6">Could not load analytics.</p>
        )}
      </Modal>

      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-[150] animate-fade-in flex items-center gap-2">
          <Send size={14} /> {flash}
        </div>
      )}
    </AppShell>
  );
}

function ShareForm({
  onSubmit,
  users,
}: {
  onSubmit: (target: { email?: string; userId?: string }) => void;
  users: { id: string; name: string; email: string }[];
}) {
  const [mode, setMode] = useState<"email" | "user">("email");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState(users[0]?.id ?? "");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("email")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium ${mode === "email" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}
        >
          <Mail size={14} /> Email
        </button>
        <button
          onClick={() => setMode("user")}
          disabled={users.length === 0}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium disabled:opacity-40 ${mode === "user" ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}
        >
          <Share2 size={14} /> Registered user
        </button>
      </div>
      {mode === "email" ? (
        <FormRow label="Email address">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.uk" />
        </FormRow>
      ) : (
        <FormRow label="Choose a registered user">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </FormRow>
      )}
      <Button
        className="w-full"
        onClick={() => onSubmit(mode === "email" ? { email } : { userId })}
        disabled={mode === "email" ? !email : !userId}
      >
        Share
      </Button>
    </div>
  );
}

function AddVideoForm({
  onSubmit,
  busy,
}: {
  onSubmit: (data: Omit<OnboardingVideo, "id" | "order"> & { mediaName?: string }) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState<VideoAudience>("all");
  const [gradient, setGradient] = useState(GRADIENTS[0]);
  const [mediaName, setMediaName] = useState("");

  return (
    <div>
      <FormRow label="Thumbnail">
        <div className="flex gap-2">
          {GRADIENTS.map((g) => (
            <button
              key={g}
              onClick={() => setGradient(g)}
              className={`w-8 h-8 rounded-md bg-gradient-to-br ${g} ${gradient === g ? "ring-2 ring-offset-2 ring-brand" : ""}`}
            />
          ))}
        </div>
      </FormRow>
      <FormRow label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to invite your team" />
      </FormRow>
      <FormRow label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </FormRow>
      <FormRow label="Upload media">
        <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-4 cursor-pointer hover:border-brand hover:bg-indigo-50/30 text-xs text-slate-500">
          {mediaName || "Click to choose a video file"}
          <input type="file" accept="video/*" className="hidden" onChange={(e) => setMediaName(e.target.files?.[0]?.name ?? "video.mp4")} />
        </label>
      </FormRow>
      <FormRow label="End user type">
        <Select value={audience} onChange={(e) => setAudience(e.target.value as VideoAudience)}>
          <option value="all">All</option>
          <option value="organisation">Organisation</option>
          <option value="employee">Employee</option>
        </Select>
      </FormRow>
      <Button
        className="w-full"
        disabled={!title || !description || busy}
        onClick={() => onSubmit({ title, description, audience, thumbnailGradient: gradient, durationSeconds: 120, mediaName })}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Add video
      </Button>
    </div>
  );
}
