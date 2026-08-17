"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormRow, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { formatDuration, timeAgo } from "@/lib/format";
import { TEAMS, DEPARTMENTS, LOCATIONS, achievements as ACHIEVEMENTS } from "@/lib/mockData";
import {
  Sparkles,
  Play,
  Mail,
  Share2,
  Plus,
  Clock,
  Send,
  Loader2,
  BarChart3,
  Rocket,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  MessagesSquare,
  Bell,
  Users,
  Building2,
  MapPin,
  Pencil,
  UserPlus,
  History,
} from "lucide-react";
import type { Achievement, HelpAudienceType, HelpCardStatus, HelpCategory, OnboardingVideo, ShareChannel, VideoAudience } from "@/lib/types";
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

const HELP_CATEGORIES: HelpCategory[] = ["Getting Started", "Employees", "Training", "Reports", "Account", "Billing", "Troubleshooting", "General"];
const USER_TYPE_LABEL: Record<HelpAudienceType, string> = { org_admin: "Org Admin", manager: "Manager", employee: "Employee", trainer: "Trainer" };
const STATUS_LABEL: Record<HelpCardStatus, string> = { recommended: "Recommended", next: "Next", new: "New", completed: "Completed", required: "Required" };
const STATUS_TONE: Record<HelpCardStatus, BadgeTone> = { recommended: "indigo", next: "amber", new: "teal", completed: "green", required: "red" };
const PAGE_SIZE = 9;

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

function myUserType(currentUser: { role: string; teamRole?: string } | null): HelpAudienceType {
  if (!currentUser) return "employee";
  if (currentUser.role === "organisation" || currentUser.teamRole === "administrator") return "org_admin";
  if (currentUser.teamRole === "manager") return "manager";
  return "employee";
}

export default function OnboardingPage() {
  const {
    currentUser,
    isRealSession,
    onboardingVideos,
    users,
    addVideo,
    updateVideo,
    helpCompletedByUser,
    markHelpItemComplete,
    logHelpAccess,
    assignHelpItem,
    helpAccessLog,
  } = useApp();
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

  // --- Mock-mode Help Hub state (client feedback, 17/08/2026, gap-analysis §3) ---
  const [userTypeFilter, setUserTypeFilter] = useState<"all" | HelpAudienceType>("all");
  const [categoryFilter, setCategoryFilter] = useState<"" | HelpCategory>("");
  const [supportTab, setSupportTab] = useState<"platform" | "general">("platform");
  const [page, setPage] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [assigningVideo, setAssigningVideo] = useState<OnboardingVideo | null>(null);

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

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 2600);
  }

  // ============================================================
  // Real-backend mode: unchanged from Milestone 3 - see backend/README.md.
  // ============================================================
  if (isRealSession) {
    const filtered = [...onboardingVideos].sort((a, b) => a.order - b.order);
    const activeList = realVideos.map(mapApiVideo);
    const visible = viewAll ? activeList : activeList.slice(0, 9);
    const noMatches = realSearched && realVideos.length === 0;
    void filtered;

    function runAiSearch() {
      setCommittedQuery(query.trim());
    }

    function clearSearch() {
      setQuery("");
      setAiSuggestions(null);
      setCommittedQuery("");
    }

    async function openVideoAndTrackView(v: OnboardingVideo) {
      setOpenVideo(v);
      try {
        await apiClient.recordOnboardingVideoView(v.id);
      } catch {
        // best-effort analytics - never blocks viewing
      }
    }

    async function handleAddVideo(data: Omit<OnboardingVideo, "id" | "order"> & { mediaName?: string }) {
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
    }

    async function handleShare(video: OnboardingVideo, target: { email?: string; userId?: string }) {
      try {
        await apiClient.shareOnboardingVideo(video.id, { email: target.email, user_id: target.userId });
        const label = target.email ?? realTeamForShare.find((u) => u.id === target.userId)?.name ?? "that person";
        showFlash(`"${video.title}" shared with ${label}.`);
      } catch (err) {
        showFlash(err instanceof ApiError ? err.message : "Could not share that video.");
      } finally {
        setShareVideo(null);
      }
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
      <AppShell title="Onboarding" subtitle="Help videos - live from the SafeIQ API">
        {realError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{realError}</p>}

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
            <Button onClick={runAiSearch} disabled={realLoading}>
              {realLoading ? <Loader2 size={14} className="animate-spin" /> : null} Ask AI &amp; search
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
            {committedQuery && (
              <button onClick={clearSearch} className="text-xs text-slate-400 hover:text-slate-600">
                Clear AI suggestions
              </button>
            )}
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" onClick={openAnalytics}>
                  <BarChart3 size={14} /> Analytics
                </Button>
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
            <ShareForm onSubmit={(target) => handleShare(shareVideo, target)} users={realTeamForShare.map((u) => ({ id: u.id, name: u.name, email: u.email }))} />
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

  // ============================================================
  // Mock mode: the "Help & Learning Hub" redesign (client feedback, 17/08/2026)
  // ============================================================
  const myType = myUserType(currentUser);
  const completedIds = currentUser ? (helpCompletedByUser[currentUser.id] ?? []) : [];

  const mySprintItems = onboardingVideos
    .filter((v) => v.sprintPosition !== undefined && (!v.userTypes || v.userTypes.includes(myType)))
    .sort((a, b) => (a.sprintPosition ?? 0) - (b.sprintPosition ?? 0));
  const nextItem = mySprintItems.find((v) => !completedIds.includes(v.id));
  const sprintProgress = mySprintItems.length > 0 ? Math.round((completedIds.length / mySprintItems.length) * 100) : 0;

  const unlockedAchievementIds = new Set<string>();
  if (completedIds.length >= 1) unlockedAchievementIds.add("ach-getting-started");
  if (completedIds.length >= 5) unlockedAchievementIds.add("ach-platform-explorer");
  if (mySprintItems.length > 0 && mySprintItems.every((v) => completedIds.includes(v.id))) unlockedAchievementIds.add("ach-org-ready");

  function cardStatus(v: OnboardingVideo): HelpCardStatus {
    if (completedIds.includes(v.id)) return "completed";
    if (currentUser && v.requiredForUserId === currentUser.id) return "required";
    if (nextItem?.id === v.id) return "next";
    if (v.sprintPosition === undefined) return "new";
    return "recommended";
  }

  function runAiSearch() {
    if (!query.trim()) {
      setAiSuggestions(null);
      return;
    }
    const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const matches = onboardingVideos.filter(
      (v) =>
        words.some((w) => v.title.toLowerCase().includes(w) || v.description.toLowerCase().includes(w)) ||
        v.aiKeywords?.some((k) => words.some((w) => k.toLowerCase().includes(w)))
    );
    setAiSuggestions(matches.length > 0 ? matches.map((v) => v.id) : []);
    setPage(0);
  }

  function clearSearch() {
    setQuery("");
    setAiSuggestions(null);
  }

  const recommendedMatch = aiSuggestions && aiSuggestions.length > 0 ? onboardingVideos.find((v) => v.id === aiSuggestions[0]) : null;

  // Not memoized: this component already branches on isRealSession via an early
  // return above, so hooks like useMemo can't be called down here without
  // breaking React's rules-of-hooks (an inconsistent hook count across renders).
  const filtered = (() => {
    let list = onboardingVideos.filter((v) => v.published !== false);
    if (audience !== "all") list = list.filter((v) => v.audience === audience || v.audience === "all");
    if (aiSuggestions) list = list.filter((v) => aiSuggestions.includes(v.id));
    if (userTypeFilter !== "all") list = list.filter((v) => !v.userTypes || v.userTypes.includes(userTypeFilter));
    if (categoryFilter) list = list.filter((v) => v.category === categoryFilter);
    list = list.filter((v) => (supportTab === "general" ? !!v.isGeneralSupport : !v.isGeneralSupport));
    return [...list].sort((a, b) => {
      const aMine = !a.userTypes || a.userTypes.includes(myType) ? 0 : 1;
      const bMine = !b.userTypes || b.userTypes.includes(myType) ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return (a.sprintPosition ?? a.order) - (b.sprintPosition ?? b.order);
    });
  })();

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const visible = viewAll ? filtered : filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);
  const noMatches = !!aiSuggestions && aiSuggestions.length === 0;

  function openVideoAndTrackView(v: OnboardingVideo) {
    setOpenVideo(v);
    if (currentUser) {
      logHelpAccess(currentUser.id, v.id);
      markHelpItemComplete(currentUser.id, v.id);
    }
  }

  function handleAddVideo(data: Omit<OnboardingVideo, "id" | "order"> & { mediaName?: string }) {
    addVideo(data);
    setAddOpen(false);
    showFlash(`"${data.title}" added to onboarding.`);
  }

  function handleShare(video: OnboardingVideo, channel: ShareChannel, target: string) {
    showFlash(`"${video.title}" shared via ${channel === "inplatform" ? "in-platform notification" : channel} with ${target}.`);
    setShareVideo(null);
  }

  return (
    <AppShell title="Help & Learning Hub" subtitle="Guided support for your team, personalised to your role">
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Sparkles size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAiSearch()}
              placeholder="What do you need help with? e.g. 'how do I create a RAG'"
              className="pl-9"
            />
          </div>
          <Button onClick={runAiSearch}>Ask AI &amp; search</Button>
        </div>
        {recommendedMatch && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-indigo-50 px-3.5 py-2.5">
            <p className="text-xs text-indigo-700">
              Recommended: start with <span className="font-medium">&ldquo;{recommendedMatch.title}&rdquo;</span>
            </p>
            <Button size="sm" onClick={() => openVideoAndTrackView(recommendedMatch)}>
              Start recommended
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Select
            value={userTypeFilter}
            onChange={(e) => {
              setUserTypeFilter(e.target.value as "all" | HelpAudienceType);
              setPage(0);
            }}
            className="!w-auto"
          >
            <option value="all">All user types</option>
            {(Object.keys(USER_TYPE_LABEL) as HelpAudienceType[]).map((t) => (
              <option key={t} value={t}>
                {USER_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as "" | HelpCategory);
              setPage(0);
            }}
            className="!w-auto"
          >
            <option value="">All categories</option>
            {HELP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <button onClick={() => setViewAll((v) => !v)} className="text-sm font-medium text-brand hover:underline">
            {viewAll ? "Show paginated" : "View all"}
          </button>
          {aiSuggestions && (
            <button onClick={clearSearch} className="text-xs text-slate-400 hover:text-slate-600">
              Clear AI suggestions
            </button>
          )}
          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setManageOpen(true)}>
                <History size={14} /> Access log ({helpAccessLog.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Add help item
              </Button>
            </div>
          )}
        </div>
        {noMatches && <p className="text-xs text-amber-600 mt-2">No matching help items found - try different wording, or browse below.</p>}
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setSupportTab("platform");
            setPage(0);
          }}
          className={`text-sm font-medium px-3.5 py-2 rounded-lg ${supportTab === "platform" ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-600"}`}
        >
          Platform Help
        </button>
        <button
          onClick={() => {
            setSupportTab("general");
            setPage(0);
          }}
          className={`text-sm font-medium px-3.5 py-2 rounded-lg ${supportTab === "general" ? "bg-brand text-white" : "bg-white border border-slate-200 text-slate-600"}`}
        >
          General Support
        </button>
      </div>

      {mySprintItems.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Rocket size={15} className="text-brand" /> Your Help Sprint
            </p>
            <span className="text-xs text-slate-500">
              {completedIds.filter((id) => mySprintItems.some((v) => v.id === id)).length}/{mySprintItems.length} complete
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3">
            <div className="h-full bg-brand transition-all" style={{ width: `${sprintProgress}%` }} />
          </div>
          {nextItem ? (
            <button onClick={() => openVideoAndTrackView(nextItem)} className="text-xs text-brand hover:underline mb-3 block">
              Next recommended: &ldquo;{nextItem.title}&rdquo; →
            </button>
          ) : (
            <p className="text-xs text-emerald-600 mb-3">Sprint complete - nice work.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {ACHIEVEMENTS.map((a: Achievement) => {
              const unlocked = unlockedAchievementIds.has(a.id);
              return (
                <div
                  key={a.id}
                  title={a.description}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full ${unlocked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
                >
                  <span>{unlocked ? a.icon : "🔒"}</span> {a.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((v) => {
          const status = cardStatus(v);
          return (
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
                  <Clock size={9} /> {v.estimatedMinutes ? `${v.estimatedMinutes} min` : formatDuration(v.durationSeconds)}
                </span>
                <Badge tone={STATUS_TONE[status]} className="absolute top-2 left-2">
                  {STATUS_LABEL[status]}
                </Badge>
              </div>
              <div className="p-3.5">
                <p className="text-sm font-medium text-slate-800 truncate">{v.title}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {v.category && <Badge tone="slate">{v.category}</Badge>}
                  <Badge tone={v.audience === "organisation" ? "indigo" : v.audience === "employee" ? "teal" : "slate"}>{v.audience}</Badge>
                </div>
              </div>

              <div className="absolute inset-0 bg-slate-900/85 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-between text-white">
                <div>
                  <p className="text-sm font-semibold mb-1.5">{v.title}</p>
                  <p className="text-xs text-slate-300 line-clamp-4">{v.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setShareVideo(v)} className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg">
                    <Share2 size={12} /> Share
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => {
                          setEditingVideoId(v.id);
                          setAddOpen(true);
                        }}
                        className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => setAssigningVideo(v)} className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg">
                        <UserPlus size={12} /> Assign
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && !noMatches && <p className="text-sm text-slate-400 text-center py-16">No help items to show for this filter.</p>}

      {!viewAll && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0} className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-slate-500">
            Page {clampedPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 text-slate-500"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <Modal open={!!openVideo} onClose={() => setOpenVideo(null)} title={openVideo?.title ?? ""} widthClass="max-w-xl">
        {openVideo && (
          <div>
            <div className={`h-56 rounded-lg bg-gradient-to-br ${openVideo.thumbnailGradient} flex items-center justify-center mb-4`}>
              <div className="w-16 h-16 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                <Play size={26} className="text-white fill-white ml-1" />
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">{openVideo.description}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
              <Clock size={12} /> {openVideo.estimatedMinutes ? `${openVideo.estimatedMinutes} min` : formatDuration(openVideo.durationSeconds)}
              <Badge tone={openVideo.audience === "organisation" ? "indigo" : openVideo.audience === "employee" ? "teal" : "slate"}>{openVideo.audience}</Badge>
              {openVideo.category && <Badge tone="slate">{openVideo.category}</Badge>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!shareVideo} onClose={() => setShareVideo(null)} title="Share">
        {shareVideo && <HelpShareForm video={shareVideo} onSubmit={handleShare} users={users} />}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setEditingVideoId(null);
        }}
        title={editingVideoId ? "Edit help item" : "Add help item"}
        widthClass="max-w-xl"
      >
        <HelpItemForm
          existing={editingVideoId ? onboardingVideos.find((v) => v.id === editingVideoId) : undefined}
          allVideos={onboardingVideos}
          onSubmit={(data) => {
            if (editingVideoId) {
              updateVideo(editingVideoId, data);
              setAddOpen(false);
              setEditingVideoId(null);
              showFlash(`"${data.title}" updated.`);
            } else {
              handleAddVideo(data);
            }
          }}
        />
      </Modal>

      <Modal open={!!assigningVideo} onClose={() => setAssigningVideo(null)} title="Assign as required">
        {assigningVideo && (
          <AssignForm
            users={users.filter((u) => u.orgId === currentUser?.orgId)}
            onSubmit={(userId, dueDate) => {
              assignHelpItem(assigningVideo.id, userId, dueDate);
              showFlash(`"${assigningVideo.title}" assigned, due ${dueDate}.`);
              setAssigningVideo(null);
            }}
          />
        )}
      </Modal>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Recent access log" widthClass="max-w-lg">
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {helpAccessLog.slice(0, 30).map((e) => (
            <div key={e.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700 truncate">
                {users.find((u) => u.id === e.userId)?.name ?? "Unknown"} opened &ldquo;{onboardingVideos.find((v) => v.id === e.videoId)?.title ?? "a help item"}&rdquo;
              </span>
              <span className="text-xs text-slate-400 shrink-0">{timeAgo(e.at)}</span>
            </div>
          ))}
          {helpAccessLog.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No access recorded yet.</p>}
        </div>
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

// Client feedback (17/08/2026, gap-analysis §3): the fuller "Help Hub Manager"
// authoring form - title/thumbnail/description/user type(s)/category/sprint
// position/required-recommended/prerequisite/estimated time/AI keywords/
// published state.
function HelpItemForm({
  existing,
  allVideos,
  onSubmit,
}: {
  existing?: OnboardingVideo;
  allVideos: OnboardingVideo[];
  onSubmit: (data: Omit<OnboardingVideo, "id" | "order">) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [audience, setAudience] = useState<VideoAudience>(existing?.audience ?? "all");
  const [gradient, setGradient] = useState(existing?.thumbnailGradient ?? GRADIENTS[0]);
  const [category, setCategory] = useState<HelpCategory>(existing?.category ?? "Getting Started");
  const [isGeneralSupport, setIsGeneralSupport] = useState(existing?.isGeneralSupport ?? false);
  const [userTypes, setUserTypes] = useState<HelpAudienceType[]>(existing?.userTypes ?? []);
  const [inSprint, setInSprint] = useState(existing?.sprintPosition !== undefined);
  const [sprintPosition, setSprintPosition] = useState(existing?.sprintPosition ?? 1);
  const [prerequisiteId, setPrerequisiteId] = useState(existing?.prerequisiteId ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(existing?.estimatedMinutes ?? 3);
  const [aiKeywords, setAiKeywords] = useState((existing?.aiKeywords ?? []).join(", "));
  const [published, setPublished] = useState(existing?.published ?? true);

  function toggleUserType(t: HelpAudienceType) {
    setUserTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div>
      <FormRow label="Thumbnail">
        <div className="flex gap-2">
          {GRADIENTS.map((g) => (
            <button key={g} onClick={() => setGradient(g)} className={`w-8 h-8 rounded-md bg-gradient-to-br ${g} ${gradient === g ? "ring-2 ring-offset-2 ring-brand" : ""}`} />
          ))}
        </div>
      </FormRow>
      <FormRow label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="How to invite your team" />
      </FormRow>
      <FormRow label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </FormRow>
      <div className="grid grid-cols-2 gap-3">
        <FormRow label="End user type">
          <Select value={audience} onChange={(e) => setAudience(e.target.value as VideoAudience)}>
            <option value="all">All</option>
            <option value="organisation">Organisation</option>
            <option value="employee">Employee</option>
          </Select>
        </FormRow>
        <FormRow label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as HelpCategory)}>
            {HELP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>
      <FormRow label="User types (leave blank for everyone)">
        <div className="flex flex-wrap gap-3 text-sm">
          {(Object.keys(USER_TYPE_LABEL) as HelpAudienceType[]).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={userTypes.includes(t)} onChange={() => toggleUserType(t)} />
              {USER_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
      </FormRow>
      <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
        <input type="checkbox" checked={isGeneralSupport} onChange={(e) => setIsGeneralSupport(e.target.checked)} />
        General Support (account/accessibility/contacting the organisation) rather than Platform Help
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
        <input type="checkbox" checked={inSprint} onChange={(e) => setInSprint(e.target.checked)} />
        Part of the guided &ldquo;Your Help Sprint&rdquo; journey
      </label>
      {inSprint && (
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Sprint position">
            <Input type="number" min={1} value={sprintPosition} onChange={(e) => setSprintPosition(Number(e.target.value) || 1)} />
          </FormRow>
          <FormRow label="Prerequisite (optional)">
            <Select value={prerequisiteId} onChange={(e) => setPrerequisiteId(e.target.value)}>
              <option value="">None</option>
              {allVideos
                .filter((v) => v.id !== existing?.id)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
            </Select>
          </FormRow>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FormRow label="Estimated time (minutes)">
          <Input type="number" min={1} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value) || 1)} />
        </FormRow>
        <FormRow label="Published">
          <Select value={published ? "yes" : "no"} onChange={(e) => setPublished(e.target.value === "yes")}>
            <option value="yes">Published</option>
            <option value="no">Unpublished (hidden)</option>
          </Select>
        </FormRow>
      </div>
      <FormRow label="AI search keywords (comma-separated)">
        <Input value={aiKeywords} onChange={(e) => setAiKeywords(e.target.value)} placeholder="rag, create, documents" />
      </FormRow>
      <Button
        className="w-full"
        disabled={!title || !description}
        onClick={() =>
          onSubmit({
            title,
            description,
            audience,
            thumbnailGradient: gradient,
            durationSeconds: existing?.durationSeconds ?? estimatedMinutes * 60,
            category,
            isGeneralSupport,
            userTypes: userTypes.length > 0 ? userTypes : undefined,
            sprintPosition: inSprint ? sprintPosition : undefined,
            prerequisiteId: prerequisiteId || undefined,
            estimatedMinutes,
            aiKeywords: aiKeywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean),
            published,
          })
        }
      >
        {existing ? "Save changes" : "Add help item"}
      </Button>
    </div>
  );
}

function AssignForm({ users, onSubmit }: { users: { id: string; name: string }[]; onSubmit: (userId: string, dueDate: string) => void }) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");

  return (
    <div>
      <FormRow label="Assign to">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </FormRow>
      <FormRow label="Due date">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </FormRow>
      <Button className="w-full" onClick={() => onSubmit(userId, dueDate)} disabled={!userId || !dueDate}>
        Assign as required
      </Button>
    </div>
  );
}

function HelpShareForm({
  video,
  users,
  onSubmit,
}: {
  video: OnboardingVideo;
  users: { id: string; name: string; email: string }[];
  onSubmit: (video: OnboardingVideo, channel: ShareChannel, target: string) => void;
}) {
  const [channel, setChannel] = useState<ShareChannel>("email");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [teamOrDept, setTeamOrDept] = useState("");
  const [message, setMessage] = useState("");

  const CHANNELS: { key: ShareChannel; label: string; icon: typeof Mail }[] = [
    { key: "email", label: "Email", icon: Mail },
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { key: "messenger", label: "Messenger", icon: MessagesSquare },
    { key: "inplatform", label: "In-platform", icon: Bell },
    { key: "team", label: "Team", icon: Users },
    { key: "department", label: "Department", icon: Building2 },
    { key: "location", label: "Location", icon: MapPin },
  ];

  function submit() {
    if (channel === "email") onSubmit(video, channel, email);
    else if (channel === "team" || channel === "department" || channel === "location") onSubmit(video, channel, teamOrDept);
    else onSubmit(video, channel, users.find((u) => u.id === userId)?.name ?? "that person");
  }

  const targetOptions = channel === "team" ? TEAMS : channel === "department" ? DEPARTMENTS : channel === "location" ? LOCATIONS : [];

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            onClick={() => setChannel(c.key)}
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium ${channel === c.key ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}
          >
            <c.icon size={14} /> {c.label}
          </button>
        ))}
      </div>

      {channel === "email" && (
        <FormRow label="Email address">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.uk" />
        </FormRow>
      )}
      {(channel === "whatsapp" || channel === "messenger" || channel === "inplatform") && (
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
      {(channel === "team" || channel === "department" || channel === "location") && (
        <FormRow label={`Choose a ${channel}`}>
          <Select value={teamOrDept} onChange={(e) => setTeamOrDept(e.target.value)}>
            <option value="">Choose...</option>
            {targetOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </FormRow>
      )}
      <FormRow label="Optional message">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Thought this might help..." />
      </FormRow>
      <Button
        className="w-full"
        onClick={submit}
        disabled={channel === "email" ? !email : channel === "team" || channel === "department" || channel === "location" ? !teamOrDept : !userId}
      >
        Share
      </Button>
    </div>
  );
}
