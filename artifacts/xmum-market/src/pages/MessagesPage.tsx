import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import {
  getUserConversations, subscribeToMessages, sendMessage,
  markConversationRead, Conversation, Message,
} from "@/lib/messaging";
import { MessageCircle, ArrowLeft, Send, Loader2 } from "lucide-react";
import AuthModal from "@/components/AuthModal";

export default function MessagesPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const [showAuth, setShowAuth] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoadingConvs(true);
    getUserConversations(user.uid)
      .then(setConversations)
      .finally(() => setLoadingConvs(false));
  }, [user]);

  useEffect(() => {
    if (!activeConv || !user) return;
    markConversationRead(activeConv.id, user.uid);
    const unsub = subscribeToMessages(activeConv.id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    return unsub;
  }, [activeConv?.id, user]);

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

  if (activeConv) {
    return (
      <div className="flex flex-col h-[calc(100vh-56px)] md:h-[calc(100vh-64px)] max-w-2xl mx-auto">
        {/* Thread header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
          <button
            onClick={() => { setActiveConv(null); setMessages([]); refreshConversations(); }}
            className="text-[#003366] dark:text-blue-400"
          >
            <ArrowLeft size={20} />
          </button>
          {activeConv.listingPhoto && (
            <img src={activeConv.listingPhoto} className="w-9 h-9 rounded-lg object-cover" alt="" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{activeConv.listingTitle}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">{t.messages}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-slate-950">
          {messages.map((msg) => {
            const isMine = msg.senderId === user.uid;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  isMine
                    ? "bg-[#003366] text-white rounded-br-sm"
                    : "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-100 dark:border-slate-700 rounded-bl-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t.typeMessage}
            maxLength={500}
            className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-slate-100 min-h-[44px]"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="w-11 h-11 bg-[#003366] dark:bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-[#002244] disabled:opacity-50 transition-colors shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-24 sm:pb-8">
      <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <MessageCircle size={22} className="text-[#003366] dark:text-blue-400" />
        {t.messages}
      </h1>

      {loadingConvs ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#003366] dark:text-blue-400" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">
          <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t.noMessages}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const unread = conv.unreadCount?.[user.uid] ?? 0;
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className="w-full flex items-center gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 hover:shadow-md transition-shadow text-left"
              >
                {conv.listingPhoto ? (
                  <img src={conv.listingPhoto} className="w-12 h-12 rounded-xl object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <MessageCircle size={20} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{conv.listingTitle}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">{conv.lastMessage || t.noMessages}</p>
                </div>
                {unread > 0 && (
                  <span className="shrink-0 w-5 h-5 bg-[#003366] dark:bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
