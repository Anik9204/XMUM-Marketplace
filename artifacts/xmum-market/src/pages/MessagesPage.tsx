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

export default function MessagesPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const [location] = useLocation();
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

  // Auto-open conversation + pre-fill draft when arriving from "Message Seller"
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

  // Fetch the other participant's profile when a conversation is opened
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

  // Focus input after draft is set
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

  // ── Active chat view ────────────────────────────────────────────────────────
  if (activeConv) {
    const otherName = otherProfile?.fullName || otherProfile?.displayName || "User";
    const otherEmail = otherProfile?.email ?? "";
    const otherAvatar = otherProfile?.avatarUrl;
    const initials = otherName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    // Group messages by date for date separators
    const groups: { date: string; msgs: Message[] }[] = [];
    messages.forEach((msg) => {
      const label = formatDate(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last?.date === label) last.msgs.push(msg);
      else groups.push({ date: label, msgs: [msg] });
    });

    return (
      <div className="flex flex-col h-[calc(100dvh-104px)] sm:h-[calc(100dvh-112px)] md:h-[calc(100dvh-64px)] max-w-2xl mx-auto w-full">

        {/* WhatsApp-style header */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-[#003366] dark:bg-slate-900 shrink-0">
          <button
            onClick={() => { setActiveConv(null); setMessages([]); setOtherProfile(null); refreshConversations(); }}
            className="text-white/80 hover:text-white p-1 shrink-0"
          >
            <ArrowLeft size={20} />
          </button>

          {otherAvatar ? (
            <img src={otherAvatar} className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-white/20" alt={otherName} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials || "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{otherName}</p>
            {otherEmail && <p className="text-xs text-white/60 truncate">{otherEmail}</p>}
          </div>

          {activeConv.listingPhoto && (
            <div className="shrink-0 flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1 max-w-[110px]">
              <img src={activeConv.listingPhoto} className="w-6 h-6 rounded object-cover shrink-0" alt="" />
              <p className="text-[9px] text-white/70 truncate">{activeConv.listingTitle}</p>
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 bg-[#e5ddd5] dark:bg-slate-950">
          {messages.length === 0 && (
            <div className="flex justify-center mt-6">
              <span className="bg-white/80 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-xs px-4 py-1.5 rounded-full shadow-sm">
                Say hi about &ldquo;{activeConv.listingTitle}&rdquo;
              </span>
            </div>
          )}
          {groups.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex justify-center my-3">
                <span className="bg-white/80 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[10px] font-medium px-3 py-0.5 rounded-full shadow-sm">
                  {group.date}
                </span>
              </div>
              <div className="space-y-1">
                {group.msgs.map((msg) => {
                  const isMine = msg.senderId === user.uid;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[78%] px-3 py-2 text-sm shadow-sm ${
                        isMine
                          ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-gray-800 dark:text-slate-100 rounded-t-2xl rounded-bl-2xl rounded-br-sm"
                          : "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-t-2xl rounded-br-2xl rounded-bl-sm"
                      }`}>
                        <p className="leading-snug whitespace-pre-wrap break-words">{msg.text}</p>
                        <p className={`text-[10px] mt-1 text-right select-none ${
                          isMine ? "text-gray-400 dark:text-teal-200/50" : "text-gray-400 dark:text-slate-500"
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
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#f0f0f0] dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t.typeMessage}
              maxLength={500}
              className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/20 dark:text-slate-100 min-h-[44px] pr-12"
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
            className="w-11 h-11 bg-[#003366] dark:bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-[#002244] disabled:opacity-40 transition-colors shrink-0 shadow-sm"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    );
  }

  // ── Conversation list ───────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto pb-24 sm:pb-8">
      <div className="px-4 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <MessageCircle size={22} className="text-[#003366] dark:text-blue-400" />
          {t.messages}
        </h1>
      </div>

      {loadingConvs ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#003366] dark:text-blue-400" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500 px-4">
          <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t.noMessages}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {conversations.map((conv) => {
            const unread = conv.unreadCount?.[user.uid] ?? 0;
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className="w-full flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors text-left"
              >
                {conv.listingPhoto ? (
                  <img src={conv.listingPhoto} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <MessageCircle size={20} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className={`text-sm truncate ${unread > 0 ? "font-bold text-gray-900 dark:text-slate-50" : "font-semibold text-gray-800 dark:text-slate-100"}`}>
                      {conv.listingTitle}
                    </p>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                      {formatTime(conv.lastMessageAt)}
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
