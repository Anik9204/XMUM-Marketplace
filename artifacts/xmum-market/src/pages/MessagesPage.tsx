import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { getProfile } from "@/lib/userProfile";
import { UserProfile } from "@/lib/types";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  subscribeToConversations, subscribeToMessages, sendMessage,
  markConversationRead, markMessagesAsSeen, setTypingStatus,
  subscribeToTyping, clearConversation, getOlderMessages, Conversation, Message,
} from "@/lib/messaging";
import { MessageCircle, ArrowLeft, Send, Loader2, Search, X, Trash2, Flag } from "lucide-react";
import { reportUser, USER_REPORT_REASONS, UserReportReason } from "@/lib/reports";
import AuthModal from "@/components/AuthModal";

const MAX_CHARS = 1000;
const CHAR_WARN = 800;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "now";
  if (hours < 1) return mins + "m";
  if (hours < 24) return hours + "h";
  return days + "d";
}

function Avatar({ name, avatarUrl, size = 48 }: { name: string; avatarUrl?: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-white dark:border-slate-700 shrink-0"
      />
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.33 }}
    >
      {initials}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-[3px] h-4">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-typing-dot" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-typing-dot" style={{ animationDelay: "160ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-typing-dot" style={{ animationDelay: "320ms" }} />
    </span>
  );
}

export default function MessagesPage() {
  const { user, userProfile } = useAuth();
  const { t } = useLang();
  const [, navigate] = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const [inputError, setInputError] = useState("");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, UserProfile | null>>({});
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearingConvId, setClearingConvId] = useState<string | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<UserReportReason>("spam");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Keyboard detection (mobile) — fixes dead space when virtual keyboard opens
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const isOpen = vv.height < window.innerHeight * 0.75;
      setKeyboardOpen(isOpen);
      if (isOpen) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
      }
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

  // Auto-resize textarea — grows and shrinks with content
  const autoResizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, []);

  // ── Real-time conversation list ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingConvs(true);
    const unsub = subscribeToConversations(user.uid, (convs) => {
      setConversations(convs);
      setLoadingConvs(false);
    });
    return unsub;
  }, [user?.uid]);

  // ── Deep-link: auto-open conversation from URL ?conv= ────────────────────────
  useEffect(() => {
    if (loadingConvs || conversations.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conv");
    if (!convId) return;
    const match = conversations.find((c) => c.id === convId);
    if (match) {
      setActiveConv(match);
      const draft = params.get("draft");
      if (draft) setInputText(decodeURIComponent(draft));
      window.history.replaceState(null, "", "/messages");
    }
  }, [loadingConvs, conversations]);

  // ── Lazy-fetch participant profiles for conversation rows ────────────────────
  useEffect(() => {
    if (!user || conversations.length === 0) return;
    const uids = conversations
      .map((c) => c.participants.find((p) => p !== user.uid))
      .filter((uid): uid is string => !!uid && participantProfiles[uid] === undefined);
    if (uids.length === 0) return;
    const deduplicated = [...new Set(uids)];
    deduplicated.forEach((uid) => {
      setParticipantProfiles((prev) => ({ ...prev, [uid]: null }));
      getProfile(uid)
        .then((profile) => setParticipantProfiles((prev) => ({ ...prev, [uid]: profile })))
        .catch(() => {});
    });
  }, [conversations.length, user?.uid]);

  // ── Other user's profile when chat is active ─────────────────────────────────
  useEffect(() => {
    if (!activeConv || !user) { setOtherProfile(null); return; }
    const otherUid = activeConv.participants.find((p) => p !== user.uid);
    if (!otherUid) return;
    const cached = participantProfiles[otherUid];
    if (cached) { setOtherProfile(cached); return; }
    getProfile(otherUid)
      .then(setOtherProfile)
      .catch(() => setOtherProfile(null));
  }, [activeConv?.id, user?.uid]);

  // ── Subscribe to messages when active conversation changes ───────────────────
  useEffect(() => {
    if (!activeConv || !user) return;
    const convId = activeConv.id;
    const uid = user.uid;
    markConversationRead(convId, uid);
    const unsub = subscribeToMessages(convId, (msgs) => {
      setMessages(msgs);
      setHasOlderMessages(msgs.length >= 150);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      const unseenIds = msgs
        .filter((m) => m.senderId !== uid && !(m.seenBy ?? []).includes(uid))
        .map((m) => m.id);
      if (unseenIds.length > 0) {
        markMessagesAsSeen(convId, uid, unseenIds);
        markConversationRead(convId, uid);
      }
    });
    return () => {
      unsub();
      markConversationRead(convId, uid);
      setHasOlderMessages(false);
    };
  }, [activeConv?.id, user?.uid]);

  // ── Typing indicator subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!activeConv || !user) return;
    const otherUid = activeConv.participants.find((p) => p !== user.uid);
    if (!otherUid) return;
    const unsub = subscribeToTyping(activeConv.id, user.uid, otherUid, setOtherIsTyping);
    return () => {
      unsub();
      setOtherIsTyping(false);
    };
  }, [activeConv?.id, user?.uid]);

  // ── Clean up typing status on unmount or conv change ────────────────────────
  useEffect(() => {
    if (!activeConv || !user) return;
    const convId = activeConv.id;
    const uid = user.uid;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTypingStatus(convId, uid, false);
    };
  }, [activeConv?.id, user?.uid]);

  // ── Focus input when draft is set ───────────────────────────────────────────
  useEffect(() => {
    if (inputText && activeConv) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConv?.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_CHARS);
    setInputText(val);
    autoResizeTextarea();
    if (!activeConv || !user) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (val.trim()) {
      setTypingStatus(activeConv.id, user.uid, true);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(activeConv.id!, user.uid, false);
      }, 3000);
    } else {
      setTypingStatus(activeConv.id, user.uid, false);
    }
  }, [activeConv?.id, user?.uid, autoResizeTextarea]);

  const handleInputBlur = useCallback(() => {
    if (!activeConv || !user) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingStatus(activeConv.id, user.uid, false);
  }, [activeConv?.id, user?.uid]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeConv || !user || sending) return;
    if (userProfile?.isBlacklisted) {
      setInputError("Your account has been suspended. You cannot send messages.");
      return;
    }
    if (!checkRateLimit(`msg_${user.uid}`, 30, 60 * 1000)) {
      setInputError("You're sending messages too quickly. Please slow down.");
      return;
    }
    setInputError("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTypingStatus(activeConv.id, user.uid, false);
    const otherUid = activeConv.participants.find((p) => p !== user.uid) ?? "";
    const senderName = userProfile?.fullName ?? userProfile?.displayName ?? user.email?.split("@")[0] ?? "Someone";
    const text = inputText;
    setInputText("");
    autoResizeTextarea();
    setSending(true);
    try {
      await sendMessage(activeConv.id, user.uid, senderName, text, otherUid, activeConv.listingTitle ?? "");
      inputRef.current?.focus();
    } catch {
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, activeConv?.id, user?.uid, sending, userProfile]);

  const handleLoadOlderMessages = async () => {
    if (!activeConv || messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const older = await getOlderMessages(activeConv.id, oldest.id, oldest.createdAt);
      if (older.length < 50) setHasOlderMessages(false);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newOnes = older.filter((m) => !existingIds.has(m.id));
        return [...newOnes, ...prev];
      });
    } catch {
      // silent — non-critical
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleClear = useCallback(async () => {
    if (!activeConv || !user) return;
    setClearing(true);
    setConfirmClearChat(false);
    try {
      await clearConversation(activeConv.id, user.uid);
    } catch {
      // silent — UI still reflects cleared state optimistically via Firestore listener
    } finally {
      setClearing(false);
    }
  }, [activeConv?.id, user?.uid]);

  const handleClearFromList = useCallback(async (convId: string) => {
    if (!user) return;
    setConfirmClearId(null);
    setClearingConvId(convId);
    try {
      await clearConversation(convId, user.uid);
      if (activeConv?.id === convId) closeConv();
    } catch {
      // silent
    } finally {
      setClearingConvId(null);
    }
  }, [user?.uid, activeConv?.id]);

  const handleReport = useCallback(async () => {
    if (!user || !activeConv) return;
    const otherUid = activeConv.participants.find((p) => p !== user.uid) ?? "";
    const otherEmail = otherProfile?.email ?? "";
    setSubmittingReport(true);
    try {
      await reportUser(user.uid, otherUid, otherEmail, reportReason);
      setReportDone(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportDone(false);
      }, 2000);
    } catch {
      // silent
    } finally {
      setSubmittingReport(false);
    }
  }, [user?.uid, activeConv?.id, otherProfile?.email, reportReason]);

  const openConv = (conv: Conversation) => {
    setActiveConv(conv);
    setMessages([]);
    setOtherIsTyping(false);
    setInputText("");
  };

  const closeConv = () => {
    setActiveConv(null);
    setMessages([]);
    setOtherProfile(null);
    setOtherIsTyping(false);
  };

  // ── Filtered conversations ────────────────────────────────────────────────────
  // Hide conversations the current user has cleared (unless new messages arrived after the clear)
  const visibleConversations = conversations.filter((c) => {
    const clearedAt = c.clearedAt?.[user?.uid ?? ""] ?? 0;
    return clearedAt === 0 || c.lastMessageAt > clearedAt;
  });

  const filteredConversations = searchQuery.trim()
    ? visibleConversations.filter((c) => {
        const q = searchQuery.toLowerCase();
        const otherUid = c.participants.find((p) => p !== user?.uid);
        const profile = otherUid ? participantProfiles[otherUid] : null;
        const isShopConv = !!(c.shopName && c.shopOwnerUid && c.shopOwnerUid === otherUid);
        const name = isShopConv ? c.shopName!.toLowerCase() : (profile?.fullName || profile?.displayName || "").toLowerCase();
        return c.listingTitle.toLowerCase().includes(q) || name.includes(q);
      })
    : visibleConversations;

  // ── Not signed in ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <MessageCircle size={48} className="text-gray-200 dark:text-slate-600 mb-4" />
        <p className="text-gray-600 dark:text-slate-300 font-medium mb-1">{t.loginToPost}</p>
        <button
          onClick={() => setShowAuth(true)}
          className="mt-3 bg-[#003366] dark:bg-blue-600 text-white px-5 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold"
        >
          {t.signIn}
        </button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  // ── Conversation list panel content ──────────────────────────────────────────
  const conversationListContent = (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-slate-800 shrink-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <MessageCircle size={20} className="text-[#003366] dark:text-blue-400" />
          {t.messages}
        </h1>
      </div>

      {/* Search bar — visible whenever there are conversations */}
      {conversations.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl pl-8 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" } as React.CSSProperties}>
        {loadingConvs ? (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-slate-800">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-100 dark:bg-slate-700 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center px-4">
            <span className="text-4xl mb-3">💬</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {searchQuery ? "No matching conversations" : "No messages yet"}
            </p>
            {!searchQuery && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
                  Messages appear here when you contact a seller or a buyer contacts you.
                </p>
                <Link href="/" className="mt-3 text-xs text-[#003366] dark:text-blue-400 font-semibold hover:underline">
                  Browse listings →
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {filteredConversations.map((conv) => {
              const unread = conv.unreadCount?.[user.uid] ?? 0;
              const otherUid = conv.participants.find((p) => p !== user.uid) ?? "";
              const profile = participantProfiles[otherUid];
              const isShopConv = !!(conv.shopName && conv.shopOwnerUid && conv.shopOwnerUid === otherUid);
              const displayName = isShopConv ? conv.shopName! : (profile?.fullName || profile?.displayName || "User");
              const isActive = activeConv?.id === conv.id;

              return (
                <div
                  key={conv.id}
                  className={`flex items-center transition-colors ${
                    isActive
                      ? "bg-blue-50 dark:bg-slate-700"
                      : unread > 0
                        ? "bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/60 dark:hover:bg-blue-950/30"
                        : "bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {/* Main clickable area */}
                  <button
                    onClick={() => openConv(conv)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-h-[72px] min-w-0"
                  >
                    {/* Left: other participant's avatar */}
                    <Avatar name={displayName} avatarUrl={profile?.avatarUrl} size={48} />

                    {/* Middle: name + listing + last message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-sm truncate ${unread > 0 ? "font-bold text-gray-900 dark:text-slate-50" : "font-semibold text-gray-800 dark:text-slate-100"}`}>
                          {displayName}
                        </p>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                          {relativeTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic truncate leading-tight mb-0.5">
                        {conv.listingTitle}
                      </p>
                      <p className={`text-xs truncate leading-tight ${unread > 0 ? "font-semibold text-gray-700 dark:text-slate-200" : "text-gray-500 dark:text-slate-400"}`}>
                        {conv.lastMessage || t.noMessages}
                      </p>
                    </div>

                    {/* Right: listing thumbnail + unread badge */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {conv.listingPhoto ? (
                        <img
                          src={conv.listingPhoto}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-100 dark:border-slate-600"
                          alt=""
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <MessageCircle size={16} className="text-slate-400" />
                        </div>
                      )}
                      {unread > 0 && (
                        <span className="min-w-[20px] h-5 bg-[#003366] dark:bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Clear/delete affordance — inline confirm to avoid window.confirm iframe block */}
                  {confirmClearId === conv.id ? (
                    <div className="shrink-0 pr-2 self-stretch flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClearFromList(conv.id); }}
                        className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors min-h-[32px]"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmClearId(null); }}
                        className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg transition-colors min-h-[32px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmClearId(conv.id); }}
                      disabled={clearingConvId === conv.id}
                      title="Clear conversation"
                      aria-label="Clear conversation"
                      className="shrink-0 pr-3 self-stretch flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40 min-w-[36px]"
                    >
                      {clearingConvId === conv.id
                        ? <Loader2 size={15} className="animate-spin text-red-400" />
                        : <Trash2 size={15} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  // ── Active chat view ──────────────────────────────────────────────────────────
  const otherName = otherProfile?.fullName || otherProfile?.displayName || "User";
  const otherEmail = otherProfile?.email ?? "";
  const otherUid = activeConv?.participants.find((p) => p !== user?.uid) ?? "";

  // Filter out messages cleared by the current user
  const clearedSince = activeConv?.clearedAt?.[user?.uid ?? ""] ?? 0;
  const visibleMessages = messages.filter((m) => m.createdAt >= clearedSince);

  const groups: { date: string; msgs: Message[] }[] = [];
  visibleMessages.forEach((msg) => {
    const label = formatDate(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last?.date === label) last.msgs.push(msg);
    else groups.push({ date: label, msgs: [msg] });
  });

  const chatContent = activeConv ? (
    <div className="flex flex-col h-full overflow-hidden min-h-0">
      {/* Chat header — two-row mobile-optimised layout */}
      <div className="shrink-0 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        {/* Row 1: back + avatar + name/email + action buttons */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
          <button
            onClick={closeConv}
            className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          <Avatar name={otherName} avatarUrl={otherProfile?.avatarUrl} size={38} />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">{otherName}</p>
            {otherEmail && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{otherEmail}</p>}
          </div>

          {/* Action buttons — always visible, no overflow */}
          <button
            onClick={() => { setReportDone(false); setReportReason("spam"); setShowReportModal(true); }}
            title="Report user"
            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          >
            <Flag size={16} />
          </button>

          {confirmClearChat ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleClear}
                disabled={clearing}
                className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1.5 rounded-lg transition-colors min-h-[36px] disabled:opacity-50"
              >
                {clearing ? <Loader2 size={13} className="animate-spin" /> : "Delete"}
              </button>
              <button
                onClick={() => setConfirmClearChat(false)}
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1.5 rounded-lg transition-colors min-h-[36px]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClearChat(true)}
              disabled={clearing}
              title="Clear conversation"
              className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
            >
              {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </div>

        {/* Row 2: listing context chip — always visible, full width */}
        <div className="flex items-center gap-2 px-3 pb-2.5">
          {activeConv.listingPhoto ? (
            <img src={activeConv.listingPhoto} className="w-7 h-7 rounded-lg object-cover border border-gray-200 dark:border-slate-600 shrink-0" alt="" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
              <MessageCircle size={13} className="text-slate-400" />
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight">
            <span className="font-medium text-slate-600 dark:text-slate-300">Re: </span>
            {activeConv.listingTitle || "Listing"}
          </p>
          {activeConv.listingId && (
            <a
              href={`/listing/${activeConv.listingId}`}
              className="ml-auto shrink-0 text-[10px] font-semibold text-[#003366] dark:text-blue-400 hover:underline whitespace-nowrap"
              onClick={(e) => e.stopPropagation()}
            >
              View →
            </a>
          )}
        </div>
      </div>

      {/* Report user modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {reportDone ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <span className="text-4xl">✅</span>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Report submitted</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center">Thank you. Our team will review this report.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                    <Flag size={16} className="text-amber-500" /> Report User
                  </h3>
                  <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Reporting <span className="font-semibold text-slate-700 dark:text-slate-200">{otherName}</span>. Please select a reason:
                </p>
                <div className="space-y-2 mb-5">
                  {USER_REPORT_REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReportReason(r.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors min-h-[44px] ${
                        reportReason === r.value
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500 text-amber-800 dark:text-amber-300 font-semibold"
                          : "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleReport}
                  disabled={submittingReport}
                  className="w-full min-h-[48px] bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submittingReport ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submittingReport ? "Submitting…" : "Submit Report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-1 bg-gray-50 dark:bg-slate-950 overscroll-contain" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" } as React.CSSProperties}>
        {visibleMessages.length === 0 && (
          <div className="flex justify-center mt-6">
            {clearedSince > 0 && messages.length > 0 ? (
              <span className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-xs px-4 py-2 rounded-full shadow-sm">
                Conversation cleared — new messages will appear here
              </span>
            ) : (
              <span className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-xs px-4 py-2 rounded-full shadow-sm">
                Say hi about &ldquo;{activeConv.listingTitle}&rdquo;
              </span>
            )}
          </div>
        )}

        {hasOlderMessages && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadOlderMessages}
              disabled={loadingOlder}
              className="text-xs text-[#003366] dark:text-blue-400 underline disabled:opacity-50"
            >
              {loadingOlder ? "Loading..." : "Load older messages"}
            </button>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-[10px] font-medium px-3 py-1 rounded-full shadow-sm">
                {group.date}
              </span>
            </div>
            <div className="space-y-1.5">
              {group.msgs.map((msg) => {
                const isMine = msg.senderId === user.uid;
                const isSeen = isMine && (msg.seenBy ?? []).includes(otherUid);
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    <div className={`relative max-w-[78%] px-3.5 py-2.5 text-sm shadow-sm ${
                      isMine
                        ? "bg-[#003366] dark:bg-blue-600 text-white rounded-2xl rounded-br-sm"
                        : "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-bl-sm"
                    }`}>
                      <p className="leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                      <p className={`text-[10px] mt-1 text-right select-none ${isMine ? "text-white/50" : "text-gray-400 dark:text-slate-500"}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                    {isMine && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 px-1 select-none">
                        {isSeen ? "✓✓ Seen" : "✓ Sent"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {otherIsTyping && (
          <div className="flex items-center gap-2 px-1 pb-1">
            <Avatar name={otherName} avatarUrl={otherProfile?.avatarUrl} size={24} />
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm">
              <TypingDots />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{otherName} is typing…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="shrink-0 px-3 py-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700">
        {inputError && (
          <p className="text-xs text-red-500 dark:text-red-400 mb-1 px-1">{inputError}</p>
        )}
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleInputBlur}
              placeholder={t.typeMessage}
              rows={1}
              style={{ resize: "none", overscrollBehavior: "contain", userSelect: "text", WebkitUserSelect: "text" }}
              className={`w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[44px] overflow-hidden transition ${inputText.length > 800 ? 'pr-14' : 'pr-4'} leading-relaxed overscroll-contain`}
            />
            {inputText.length > CHAR_WARN && (
              <span className={`absolute right-3 bottom-2.5 text-[10px] font-medium pointer-events-none ${inputText.length >= MAX_CHARS ? "text-red-500" : "text-slate-400"}`}>
                {inputText.length} / {MAX_CHARS}
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="w-11 h-11 min-w-[44px] min-h-[44px] bg-[#003366] dark:bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0 shadow-sm"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Empty state for desktop right panel ──────────────────────────────────────
  const emptyState = (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <MessageCircle size={32} className="text-slate-300 dark:text-slate-600" />
      </div>
      <p className="text-base font-semibold text-slate-600 dark:text-slate-300">Your messages</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
        Select a conversation on the left, or browse listings and tap a seller's contact button to start a chat.
      </p>
    </div>
  );

  // ── Two-panel layout ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .animate-typing-dot {
          animation: typingDot 1.2s infinite ease-in-out;
        }
      `}</style>

      <div
        className="flex overflow-hidden overscroll-none md:[height:calc(100dvh_-_var(--header-h)_-_var(--verif-banner-h))]"
        style={{
          height: keyboardOpen
            ? 'calc(100dvh - var(--header-h) - var(--verif-banner-h))'
            : 'calc(100dvh - var(--header-h) - var(--verif-banner-h) - var(--bottom-nav-h))',
        }}
      >

        {/* Left panel: conversation list */}
        <div className={`flex flex-col border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden w-full md:w-80 md:shrink-0 ${activeConv ? "hidden md:flex" : "flex"}`}>
          {conversationListContent}
        </div>

        {/* Right panel: active chat or empty state */}
        <div className={`flex-1 flex-col overflow-hidden min-h-0 bg-gray-50 dark:bg-slate-950 ${activeConv ? "flex" : "hidden md:flex"}`}>
          {activeConv ? chatContent : emptyState}
        </div>

      </div>
    </>
  );
}
