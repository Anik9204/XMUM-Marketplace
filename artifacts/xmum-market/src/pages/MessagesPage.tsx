import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { getProfile } from "@/lib/userProfile";
import { UserProfile } from "@/lib/types";
import {
  getUserConversations, subscribeToMessages, sendMessage,
  markConversationRead, Conversation, Message,
} from "@/lib/messaging";
import { MessageCircle, ArrowLeft, Send, Loader2 } from "lucide-react";
import AuthModal from "@/components/AuthModal";

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

function AvatarFallback({ name, avatarUrl, size = 10 }: { name: string; avatarUrl?: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
  const px = size * 4;
  const fs = size * 1.5;
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} style={{ width: px + "px", height: px + "px" }} className="rounded-full object-cover border-2 border-white/20 shrink-0" />;
  }
  return (
    <div className="rounded-full bg-gradient-to-br from-[#003366] to-[#0055aa] flex items-center justify-center text-white font-semibold shrink-0" style={{ width: px + "px", height: px + "px", fontSize: fs + "px" }}>
      {initials}
    </div>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const [, ] = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoadingConvs(true);
    getUserConversations(user.uid)
      .then(setConversations)
      .finally(() => setLoadingConvs(false));
  }, [user]);

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

  useEffect(() => {
    if (!activeConv || !user) { setOtherProfile(null); return; }
    const otherUid = activeConv.participants.find((p) => p !== user.uid);
    if (!otherUid) return;
    getProfile(otherUid)
      .then(setOtherProfile)
      .catch(() => setOtherProfile(null));
  }, [activeConv?.id, user]);

  useEffect(() => {
    if (!activeConv || !user) return;
    markConversationRead(activeConv.id, user.uid);
    const unsub = subscribeToMessages(activeConv.id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return unsub;
  }, [activeConv?.id, user]);

  useEffect(() => {
    if (inputText && activeConv) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConv?.id]);

  const refreshConversations = () => {
    if (!user) return;
    getUserConversations(user.uid).then(setConversations);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConv || !user) return;
    setSending(true);
    const otherUid = activeConv.participants.find((p) => p !== user.uid) ?? "";
    try {
      await sendMessage(activeConv.id, user.uid, inputText, otherUid);
      setInputText("");
      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

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

  // ── Active chat view ─────────────────────────────────────────────────────────
  if (activeConv) {
    const otherName = otherProfile?.fullName || otherProfile?.displayName || "User";
    const otherEmail = otherProfile?.email ?? "";
    const groups: { date: string; msgs: Message[] }[] = [];
    messages.forEach((msg) => {
      const label = formatDate(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last?.date === label) last.msgs.push(msg);
      else groups.push({ date: label, msgs: [msg] });
    });

    return (
      <div className="flex flex-col h-[calc(100dvh-104px)] sm:h-[calc(100dvh-112px)] md:h-[calc(100dvh-64px)] max-w-2xl mx-auto w-full animate-in fade-in duration-150">

        {/* Header */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 shadow-card">
          <button
            onClick={() => { setActiveConv(null); setMessages([]); setOtherProfile(null); refreshConversations(); }}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 min-h-[44px] flex items-center shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          <AvatarFallback name={otherName} avatarUrl={otherProfile?.avatarUrl} size={10} />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">{otherName}</p>
            {otherEmail && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{otherEmail}</p>}
          </div>

          {activeConv.listingPhoto && (
            <div className="shrink-0 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl px-2 py-1 max-w-[110px]">
              <img src={activeConv.listingPhoto} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
              <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{activeConv.listingTitle}</p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-gray-50 dark:bg-slate-950">
          {messages.length === 0 && (
            <div className="flex justify-center mt-6">
              <span className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-xs px-4 py-2 rounded-full shadow-sm">
                Say hi about &ldquo;{activeConv.listingTitle}&rdquo;
              </span>
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
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[78%] px-3.5 py-2.5 text-sm shadow-card ${
                        isMine
                          ? "bg-[#003366] dark:bg-blue-600 text-white rounded-2xl rounded-br-sm"
                          : "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-100 dark:border-slate-700 rounded-2xl rounded-bl-sm"
                      }`}>
                        <p className="leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className={`text-[10px] mt-1 text-right select-none ${
                          isMine ? "text-white/50" : "text-gray-400 dark:text-slate-500"
                        }`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t.typeMessage}
              maxLength={500}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 min-h-[44px] pr-12 transition"
            />
            {inputText.length > 400 && (
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium pointer-events-none ${inputText.length > 480 ? "text-red-400" : "text-gray-400"}`}>
                {500 - inputText.length}
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="w-11 h-11 bg-[#003366] dark:bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-[#002244] dark:hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0 shadow-sm"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    );
  }

  // ── Conversation list ───────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto pb-24 sm:pb-8 animate-in fade-in duration-200">
      <div className="px-4 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <MessageCircle size={22} className="text-[#003366] dark:text-blue-400" />
          {t.messages}
        </h1>
      </div>

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
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center px-4">
          <span className="text-5xl mb-4">💬</span>
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No messages yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.noMessages}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {conversations.map((conv) => {
            const unread = conv.unreadCount?.[user.uid] ?? 0;
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors text-left ${unread > 0 ? "bg-blue-50/50 dark:bg-blue-950/20" : "bg-white dark:bg-slate-900"}`}
              >
                {conv.listingPhoto ? (
                  <img src={conv.listingPhoto} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-gray-100 dark:border-slate-700" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <MessageCircle size={20} className="text-slate-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className={`text-sm truncate ${unread > 0 ? "font-bold text-gray-900 dark:text-slate-50" : "font-semibold text-gray-800 dark:text-slate-100"}`}>
                      {conv.listingTitle}
                    </p>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                      {relativeTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <p className={`text-xs truncate ${unread > 0 ? "font-semibold text-gray-700 dark:text-slate-200" : "text-gray-500 dark:text-slate-400"}`}>
                    {conv.lastMessage || t.noMessages}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="shrink-0 min-w-[20px] h-5 bg-[#003366] dark:bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
