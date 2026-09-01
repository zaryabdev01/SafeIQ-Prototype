"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { isOrgLevel } from "@/lib/permissions";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormRow, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { AiSearchPanel } from "@/components/onboarding/AiSearchPanel";
import { HelpSprintBar } from "@/components/onboarding/HelpSprintBar";
import { VideoCard, type VideoCardAction } from "@/components/onboarding/VideoCard";
import { ShareModal } from "@/components/onboarding/ShareModal";
import { formatDuration, timeAgo } from "@/lib/format";
import { TEAMS, DEPARTMENTS, LOCATIONS } from "@/lib/mockData";
import {
  Play,
  Plus,
  Clock,
  Send,
  Loader2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Headphones,
  History,
  GraduationCap,
} from "lucide-react";
import type { HelpAudienceType, HelpCardStatus, HelpCategory, OnboardingVideo, ShareChannel, VideoAudience } from "@/lib/types";
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
// Maps the mock Help-Hub card status onto VideoCard's Figma badge tones.
const STATUS_CARD_TONE: Record<HelpCardStatus, "recommended" | "next" | "new" | "required" | "neutral"> = {
  recommended: "recommended",
  next: "next",
  new: "new",
  completed: "neutral",
  required: "required",
};
const PAGE_SIZE = 9;

function audienceTag(a: VideoAudience): { label: string; tone: "grey" | "violet" } {
  return { label: a, tone: a === "organisation" ? "violet" : "grey" };
}

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
      <AppShell title="Onboarding" subtitle="Video library to help you get started with SafeIQ" icon={GraduationCap}>
        {realError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{realError}</p>}

        <AiSearchPanel
          query={query}
          onQueryChange={setQuery}
          onSearch={runAiSearch}
          loading={realLoading}
          filters={
            <>
              <Select value={audience} onChange={(e) => setAudience(e.target.value as never)} className="!w-auto">
                <option value="all">User type: All</option>
                <option value="organisation">Organisation</option>
                <option value="employee">Employee</option>
              </Select>
              <button onClick={() => setViewAll((v) => !v)} className="text-sm font-bold text-white hover:underline">
                {viewAll ? "Show default 9" : "View all"}
              </button>
              {committedQuery && (
                <button onClick={clearSearch} className="text-xs text-white/70 hover:text-white">
                  Clear AI suggestions
                </button>
              )}
            </>
          }
          trailing={
            isAdmin ? (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={openAnalytics} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25">
                  <BarChart3 size={14} /> Analytics
                </button>
              </div>
            ) : null
          }
        />
        {noMatches && <p className="-mt-3 mb-4 text-xs text-amber-600">No matching videos found - try different wording, or browse all videos below.</p>}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((v) => (
            <VideoCard
              key={v.id}
              title={v.title}
              description={v.description}
              thumbnailGradient={v.thumbnailGradient}
              durationLabel={formatDuration(v.durationSeconds)}
              tags={[audienceTag(v.audience)]}
              onOpen={() => openVideoAndTrackView(v)}
              actions={[{ label: "Share", kind: "share", onClick: () => setShareVideo(v) }]}
            />
          ))}
        </div>

        {visible.length === 0 && !noMatches && <p className="py-16 text-center text-sm text-slate-400">No videos to show for this filter.</p>}

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

        {shareVideo && (
          <ShareModal
            open={!!shareVideo}
            onClose={() => setShareVideo(null)}
            videoTitle={shareVideo.title}
            channels={["email", "inplatform"]}
            users={realTeamForShare.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
            onShare={({ channel, target }) =>
              handleShare(shareVideo, channel === "email" ? { email: target } : { userId: realTeamForShare.find((u) => u.name === target)?.id })
            }
          />
        )}

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
    <AppShell title="Onboarding" subtitle="Video library to help you get started with SafeIQ" icon={GraduationCap}>
      <AiSearchPanel
        query={query}
        onQueryChange={setQuery}
        onSearch={runAiSearch}
        filters={
          <>
            <Select
              value={userTypeFilter}
              onChange={(e) => {
                setUserTypeFilter(e.target.value as "all" | HelpAudienceType);
                setPage(0);
              }}
              className="!w-auto"
            >
              <option value="all">User type: All</option>
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
              <option value="">Categories: All</option>
              {HELP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <button onClick={() => setViewAll((v) => !v)} className="text-sm font-bold text-white hover:underline">
              {viewAll ? "Show paginated" : "View all"}
            </button>
            {aiSuggestions && (
              <button onClick={clearSearch} className="text-xs text-white/70 hover:text-white">
                Clear AI suggestions
              </button>
            )}
          </>
        }
        trailing={
          isAdmin ? (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setManageOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/25">
                <History size={14} /> Access log ({helpAccessLog.length})
              </button>
              <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand hover:bg-white/90">
                <Plus size={14} /> Add help item
              </button>
            </div>
          ) : null
        }
      />
      {recommendedMatch && (
        <div className="-mt-3 mb-6 flex items-center justify-between gap-3 rounded-[var(--r-field)] bg-[var(--brand-tint-2)] px-4 py-2.5">
          <p className="text-xs text-[var(--brand-dark)]">
            Recommended: start with <span className="font-semibold">&ldquo;{recommendedMatch.title}&rdquo;</span>
          </p>
          <Button size="sm" onClick={() => openVideoAndTrackView(recommendedMatch)}>
            Start recommended
          </Button>
        </div>
      )}
      {noMatches && <p className="-mt-3 mb-4 text-xs text-amber-600">No matching help items found - try different wording, or browse below.</p>}

      <div className="mb-6">
        <SegmentedTabs
          fluid={false}
          options={[
            { value: "platform", label: "Platform Help", icon: LayoutGrid },
            { value: "general", label: "General Support", icon: Headphones },
          ]}
          value={supportTab}
          onChange={(v) => {
            setSupportTab(v);
            setPage(0);
          }}
        />
      </div>

      {mySprintItems.length > 0 && (
        <HelpSprintBar
          completed={completedIds.filter((id) => mySprintItems.some((v) => v.id === id)).length}
          total={mySprintItems.length}
          nextLabel={nextItem?.title ?? null}
          onNext={() => nextItem && openVideoAndTrackView(nextItem)}
          categories={[
            { label: "Getting Started", unlocked: unlockedAchievementIds.has("ach-getting-started") },
            { label: "Platform Explorer", unlocked: unlockedAchievementIds.has("ach-platform-explorer") },
            { label: "Organization Ready", unlocked: unlockedAchievementIds.has("ach-org-ready") },
          ]}
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((v) => {
          const status = cardStatus(v);
          const actions: VideoCardAction[] = [{ label: "Share", kind: "share", onClick: () => setShareVideo(v) }];
          if (isAdmin) {
            actions.push({
              label: "Edit",
              kind: "edit",
              onClick: () => {
                setEditingVideoId(v.id);
                setAddOpen(true);
              },
            });
            actions.push({ label: "Assign", kind: "assign", onClick: () => setAssigningVideo(v) });
          }
          return (
            <VideoCard
              key={v.id}
              title={v.title}
              description={v.description}
              thumbnailGradient={v.thumbnailGradient}
              durationLabel={v.estimatedMinutes ? `${v.estimatedMinutes} min` : formatDuration(v.durationSeconds)}
              statusLabel={STATUS_LABEL[status]}
              statusTone={STATUS_CARD_TONE[status]}
              tags={[...(v.category ? [{ label: v.category, tone: "grey" as const }] : []), audienceTag(v.audience)]}
              onOpen={() => openVideoAndTrackView(v)}
              actions={actions}
            />
          );
        })}
      </div>

      {visible.length === 0 && !noMatches && <p className="py-16 text-center text-sm text-slate-400">No help items to show for this filter.</p>}

      {!viewAll && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-end gap-1.5 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={clampedPage === 0}
            className="flex items-center gap-1 rounded-[var(--r-control)] px-3 py-1.5 font-medium text-[var(--text-soft)] hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`h-8 min-w-8 rounded-[var(--r-control)] px-2 text-sm font-semibold ${
                i === clampedPage ? "bg-brand text-white" : "text-[var(--text-soft)] hover:bg-slate-100"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={clampedPage >= totalPages - 1}
            className="flex items-center gap-1 rounded-[var(--r-control)] px-3 py-1.5 font-medium text-[var(--text-soft)] hover:bg-slate-100 disabled:opacity-30"
          >
            Next <ChevronRight size={14} />
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

      {shareVideo && (
        <ShareModal
          open={!!shareVideo}
          onClose={() => setShareVideo(null)}
          videoTitle={shareVideo.title}
          users={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
          groups={{ team: [...TEAMS], department: [...DEPARTMENTS], location: [...LOCATIONS] }}
          onShare={({ channel, target }) => handleShare(shareVideo, channel, target)}
        />
      )}

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
