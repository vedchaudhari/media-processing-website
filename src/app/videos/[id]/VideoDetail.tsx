"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPlay, askQuestion } from "@/lib/api";
import { isInProgress, type AskSource } from "@/lib/types";
import HlsPlayer from "@/components/HlsPlayer";
import StatusBadge from "@/components/StatusBadge";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoDetail({ id }: { id: string }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<"ai" | "transcript" | "ask">("ai");
  // Once the user picks a tab themselves, auto-selection must never override it.
  const userChoseTab = useRef(false);
  const playerRef = useRef<any>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Initialize session: clear old localStorage chats if browser session closed
  useEffect(() => {
    const isNewSession = !document.cookie.includes("session_active=true");
    if (isNewSession) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("chat_history_")) {
          localStorage.removeItem(key);
        }
      }
      document.cookie = "session_active=true; path=/";
    }
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["play", id],
    queryFn: () => getPlay(id),
    // Keep polling while the video, transcript, or AI summary is still moving through the pipeline.
    refetchInterval: (query) => {
      const result = query.state.data;
      if (result && !result.ready && isInProgress(result.status)) return 3000;
      
      // Also poll if the video is ready but transcript is still processing/pending
      if (result && result.ready && result.transcript && (result.transcript.status === "pending" || result.transcript.status === "processing")) {
        return 3000;
      }

      // Also poll if the video is ready but AI summary is still processing/pending
      if (result && result.ready && result.aiSummary && (result.aiSummary.status === "pending" || result.aiSummary.status === "processing")) {
        return 3000;
      }

      // Also poll if the video is ready but Qdrant indexing is still processing/pending
      if (result && result.ready && result.vectorIndex && (result.vectorIndex.status === "pending" || result.vectorIndex.status === "processing")) {
        return 3000;
      }
      return false;
    },
  });

  // Switch to the first available tab automatically. Depends on the status
  // strings (not the `data` object, which is a fresh reference on every poll /
  // window refocus) so it only fires when a status actually changes — and never
  // after the user has picked a tab manually.
  const aiStatus = data?.aiSummary?.status;
  const transcriptStatus = data?.transcript?.status;
  useEffect(() => {
    if (!aiStatus && !transcriptStatus) return;
    if (userChoseTab.current) return;
    if (aiStatus === "completed") {
      setActiveTab("ai");
    } else if (transcriptStatus === "completed") {
      setActiveTab("ask");
    } else {
      setActiveTab("transcript");
    }
  }, [aiStatus, transcriptStatus]);

  const chooseTab = (tab: "ai" | "transcript" | "ask") => {
    userChoseTab.current = true;
    setActiveTab(tab);
  };

  // Auto-scroll the active transcript segment into view
  useEffect(() => {
    if (activeTab === "transcript" && transcriptContainerRef.current) {
      const activeEl = transcriptContainerRef.current.querySelector("[data-active='true']");
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }
  }, [currentTime, activeTab]);


  const handlePlayerReady = (player: any) => {
    playerRef.current = player;
    player.on("timeupdate", () => {
      setCurrentTime(player.currentTime());
    });
  };

  const seekTo = (start: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime(start);
      playerRef.current.play();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to library
      </Link>

      {isLoading && (
        <div className="mt-6 aspect-video w-full animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      )}

      {isError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error instanceof Error ? error.message : "Failed to load video"}
        </div>
      )}

      {data && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">
              {data.title || "Video"}
            </h1>
            <StatusBadge status={data.status} progress={data.progress} />
          </div>

          {/* Ready → play it */}
          {data.ready && data.playbackUrl && (
            <div className="space-y-6">
              <HlsPlayer src={data.playbackUrl} poster={data.thumbnailUrl} onReady={handlePlayerReady} chapters={data.aiSummary?.chapters} />
              
              {/* Tab Selector */}
              <div className="flex bg-zinc-100 p-1 rounded-xl dark:bg-zinc-900 w-fit">
                {data.aiSummary && (
                  <button
                    onClick={() => chooseTab("ai")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === "ai"
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                    }`}
                  >
                    AI Insights
                  </button>
                )}
                {data.transcript && (
                  <button
                    onClick={() => chooseTab("transcript")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === "transcript"
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                    }`}
                  >
                    Interactive Transcript
                  </button>
                )}
                {data.transcript && (!data.vectorIndex || data.vectorIndex.status !== "skipped") && (
                  <button
                    onClick={() => chooseTab("ask")}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === "ask"
                        ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                    }`}
                  >
                    Ask AI
                  </button>
                )}
              </div>

              {/* Tab Content Panel */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {activeTab === "transcript" ? (
                  <div>
                    <h2 className="mb-4 text-base font-semibold tracking-tight border-b border-zinc-100 pb-4 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">Interactive Transcript</h2>
                    
                    {!data.transcript && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">No transcript available.</p>
                    )}

                    {data.transcript && data.transcript.status === "pending" && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Waiting for transcription to start...</p>
                    )}

                    {data.transcript && data.transcript.status === "processing" && (
                      <div className="flex items-center gap-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
                        <span>Transcribing audio in the background...</span>
                      </div>
                    )}

                    {data.transcript && data.transcript.status === "failed" && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400">
                        <p className="font-semibold">Transcription failed</p>
                        <p className="mt-1 text-xs opacity-90">{data.transcript.error || "Unknown error occurred"}</p>
                      </div>
                    )}

                    {data.transcript && data.transcript.status === "completed" && (
                      <div ref={transcriptContainerRef} className="max-h-80 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                        {data.transcript.segments && data.transcript.segments.length > 0 ? (
                          data.transcript.segments.map((segment, index) => {
                            const isActive = currentTime >= segment.start && currentTime < segment.end;
                            return (
                              <div
                                key={index}
                                onClick={() => seekTo(segment.start)}
                                data-active={isActive}
                                className={`flex gap-4 p-2.5 rounded-lg cursor-pointer transition-all duration-200 text-sm ${
                                  isActive
                                    ? "bg-blue-50 text-blue-800 border-l-4 border-blue-600 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400"
                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                                }`}
                              >
                                <span className={`font-mono text-xs select-none shrink-0 pt-0.5 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}`}>
                                  {formatTime(segment.start)}
                                </span>
                                <p className="leading-relaxed">{segment.text}</p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">Transcript is empty.</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : activeTab === "ask" ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Ask AI</h2>
                      {data.vectorIndex && (
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                          data.vectorIndex.status === "completed" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" :
                          data.vectorIndex.status === "processing" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 animate-pulse" :
                          data.vectorIndex.status === "failed" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
                          "bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                        }`}>
                          {data.vectorIndex.status === "completed" ? "Ready" :
                           data.vectorIndex.status === "processing" ? "Indexing..." :
                           data.vectorIndex.status === "failed" ? "Failed" : "Pending"}
                        </span>
                      )}
                    </div>
                    
                    {data.vectorIndex && (data.vectorIndex.status === "pending" || data.vectorIndex.status === "processing") ? (
                      <div className="space-y-4 py-2">
                        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400" />
                          <span>AI is indexing the video's transcript for search. This takes less than a minute...</span>
                        </div>
                        <div className="space-y-2.5 animate-pulse">
                          <div className="h-3.5 bg-zinc-100 dark:bg-zinc-900 rounded w-2/3"></div>
                          <div className="h-3.5 bg-zinc-100 dark:bg-zinc-900 rounded w-1/2"></div>
                        </div>
                      </div>
                    ) : data.vectorIndex && data.vectorIndex.status === "failed" ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400 py-2">
                        <p className="font-semibold">Indexing failed</p>
                        <p className="mt-1 text-xs opacity-90">{data.vectorIndex.error || "Unknown error occurred"}</p>
                      </div>
                    ) : (
                      <AskAIChat videoId={id} seekTo={seekTo} />
                    )}
                  </div>
                ) : data.aiSummary ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                      <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">AI Insights & Analysis</h2>
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        data.aiSummary.status === "completed" ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" :
                        data.aiSummary.status === "processing" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 animate-pulse" :
                        data.aiSummary.status === "failed" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400" :
                        "bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                      }`}>
                        {data.aiSummary.status === "completed" ? "Ready" :
                         data.aiSummary.status === "processing" ? "Processing..." :
                         data.aiSummary.status === "failed" ? "Failed" :
                         data.aiSummary.status === "skipped" ? "Not applicable" : "Pending"}
                      </span>
                    </div>

                    {data.aiSummary.status === "pending" && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">Waiting for AI analysis to start...</p>
                    )}

                    {data.aiSummary.status === "processing" && (
                      <div className="space-y-4 py-2">
                        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400" />
                          <span>AI is analyzing the video transcript to generate insights...</span>
                        </div>
                        <div className="space-y-2.5 animate-pulse">
                          <div className="h-3.5 bg-zinc-100 dark:bg-zinc-900 rounded w-3/4"></div>
                          <div className="h-3.5 bg-zinc-100 dark:bg-zinc-900 rounded w-5/6"></div>
                          <div className="h-3.5 bg-zinc-100 dark:bg-zinc-900 rounded w-2/3"></div>
                        </div>
                      </div>
                    )}

                    {data.aiSummary.status === "failed" && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400 py-2">
                        <p className="font-semibold">AI Analysis failed</p>
                        <p className="mt-1 text-xs opacity-90">{data.aiSummary.error || "Unknown error occurred"}</p>
                      </div>
                    )}

                    {data.aiSummary.status === "skipped" && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2">
                        No speech was detected in this video, so there are no AI insights to show.
                      </p>
                    )}

                    {data.aiSummary.status === "completed" && (
                      <div className="space-y-6">
                        {data.aiSummary.chapters && data.aiSummary.chapters.length > 0 && (
                          <div>
                            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Chapters</h3>
                            <div className="space-y-1">
                              {data.aiSummary.chapters.map((ch, idx) => {
                                const next = data.aiSummary!.chapters![idx + 1];
                                const isActive = currentTime >= ch.start && (!next || currentTime < next.start);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => seekTo(ch.start)}
                                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm transition-colors ${
                                      isActive
                                        ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                                    }`}
                                  >
                                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0">
                                      {formatTime(ch.start)}
                                    </span>
                                    <span>{ch.title}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {data.aiSummary.summary && (
                          <div>
                            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Summary</h3>
                            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal">
                              {data.aiSummary.summary}
                            </p>
                          </div>
                        )}

                        {data.aiSummary.keyTakeaways && data.aiSummary.keyTakeaways.length > 0 && (
                          <div>
                            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Key Takeaways</h3>
                            <ul className="space-y-3">
                              {data.aiSummary.keyTakeaways.map((point, idx) => (
                                <li key={idx} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300 items-start">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mt-0.5">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </span>
                                  <span className="leading-relaxed pt-0.5">{point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {data.aiSummary.technologies && data.aiSummary.technologies.length > 0 && (
                          <div>
                            <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Topics & Technologies</h3>
                            <div className="flex flex-wrap gap-2">
                              {data.aiSummary.technologies.map((tech, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-300"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 py-4">No AI insights available for this video.</p>
                )}
              </div>
            </div>
          )}

          {/* Failed → clear failure state */}
          {!data.ready && data.status === "failed" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Processing failed
              </p>
              <p className="mt-1 text-sm text-red-500 dark:text-red-400/80">
                Something went wrong while processing this video.
              </p>
            </div>
          )}

          {/* Still processing → progress / spinner */}
          {!data.ready && isInProgress(data.status) && (
            <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Processing your video…
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 capitalize">
                {data.status}
                {data.status === "transcoding" && data.progress > 0
                  ? ` · ${data.progress}%`
                  : ""}
              </p>

              {data.status === "transcoding" && (
                <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${data.progress}%` }}
                  />
                </div>
              )}

              <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
                This page updates automatically.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AskAIChat({ videoId, seekTo }: { videoId: string; seekTo: (start: number) => void }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string; sources?: AskSource[] }>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`chat_history_${videoId}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync messages to localStorage
  useEffect(() => {
    localStorage.setItem(`chat_history_${videoId}`, JSON.stringify(messages));
  }, [messages, videoId]);

  // Sync messages across other tabs in real-time
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `chat_history_${videoId}`) {
        try {
          setMessages(e.newValue ? JSON.parse(e.newValue) : []);
        } catch (err) {
          // ignore parsing error
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [videoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsLoading(true);

    try {
      const res = await askQuestion(videoId, userMsg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.answer, sources: res.sources },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${err.message || "Failed to get answer."}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col gap-4">
      {/* Chat Messages */}
      <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {messages.length === 0 && (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
            Ask any question about what was discussed in this video!
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col gap-2 rounded-xl p-4 text-sm max-w-[85%] ${
              msg.role === "user"
                ? "bg-blue-600 text-white self-end"
                : "bg-zinc-50 text-zinc-800 border border-zinc-150 self-start dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200"
            }`}
          >
            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/80">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">Sources (Click to jump):</span>
                <div className="flex flex-wrap gap-2">
                  {msg.sources.map((src, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => seekTo(src.start)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-all cursor-pointer shadow-sm"
                    >
                      <svg className="h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTime(src.start)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2 rounded-xl p-4 text-sm bg-zinc-50 border border-zinc-150 self-start dark:bg-zinc-900 dark:border-zinc-800 w-[60px] items-center justify-center">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading}
          className="flex-1 min-w-0 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 focus:dark:border-blue-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600 transition-colors cursor-pointer"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </div>
  );
}

