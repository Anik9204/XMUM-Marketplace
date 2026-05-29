import { Link } from "wouter";
import { useLang } from "@/contexts/LanguageContext";
import {
  ShoppingBag, Search, Store, MessageCircle, User,
  Tag, HelpCircle, ChevronRight
} from "lucide-react";

interface Section {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  cta?: { label: string; href: string };
}

const sections: Section[] = [
  {
    icon: <ShoppingBag size={22} />,
    title: "Home — Browse Listings",
    subtitle: "The main marketplace feed for all XMUM students.",
    bullets: [
      "Browse Buy & Sell, Lost & Found, Jobs, Assistance, and Rental listings all in one place.",
      "Filter by category using the tabs at the top.",
      "Tap any listing to see details and contact the seller.",
      "Tap the bookmark icon to save listings for later.",
      "Use the Post button (or the + button on mobile) to create your own listing.",
    ],
    cta: { label: "Go to Home", href: "/" },
  },
  {
    icon: <Search size={22} />,
    title: "Search — Find Anything",
    subtitle: "Search across all listings and shops on the platform.",
    bullets: [
      "Search by keyword, e.g. \"Calculus textbook\" or \"graphic design\".",
      "Results include both marketplace listings and campus shop items.",
      "Filter results by listing type or category.",
    ],
    cta: { label: "Go to Search", href: "/search" },
  },
  {
    icon: <Store size={22} />,
    title: "Shops — Campus Market",
    subtitle: "Student-run shops selling food, services, fashion, and more.",
    bullets: [
      "Browse shops opened by XMUM students — food stalls, tutoring services, handmade goods, and more.",
      "Tap a shop to see their full listing catalogue, contact options, and reviews.",
      "Place orders and leave reviews after a transaction.",
      "Want to sell regularly? Open your own shop — it takes just a few minutes.",
    ],
    cta: { label: "Browse Shops", href: "/campus-market" },
  },
  {
    icon: <MessageCircle size={22} />,
    title: "Messages — Chat with Students",
    subtitle: "Direct messaging between buyers and sellers.",
    bullets: [
      "When you contact a seller from a listing, a conversation starts here.",
      "All your chats — both marketplace and shop — are in one place.",
      "Messages are private and only visible to the two participants.",
      "You'll get a notification badge when you have unread messages.",
    ],
    cta: { label: "Go to Messages", href: "/messages" },
  },
  {
    icon: <User size={22} />,
    title: "Profile — Your Activity",
    subtitle: "Manage your listings, saved items, and account.",
    bullets: [
      "View and manage all listings you've posted.",
      "See items you've bookmarked under the Saved tab.",
      "Track items you've marked as sold.",
      "Manage your campus shop if you have one.",
      "Update your profile photo and contact details in Settings.",
    ],
    cta: { label: "Go to Profile", href: "/profile" },
  },
  {
    icon: <Tag size={22} />,
    title: "Posting a Listing",
    subtitle: "Share what you're selling, offering, or looking for.",
    bullets: [
      "You must be signed in with a verified @xmu.edu.my email to post.",
      "Choose the right type: Buy & Sell for items, Lost & Found for missing things, Jobs for work opportunities, Assistance for help requests, Rentals for vehicles or equipment.",
      "Add up to 3 photos — good photos get more responses.",
      "Your listing goes through an AI check before it's published.",
      "Listings expire after a period of time — you'll get a reminder to renew.",
    ],
    cta: { label: "Post a Listing", href: "/post" },
  },
];

export default function HelpPage() {
  const { lang } = useLang();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-[#003366] dark:hover:text-blue-400 transition-colors mb-4">
          ← Back
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-[#003366] dark:bg-blue-600 flex items-center justify-center shrink-0">
            <HelpCircle size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-gray-900 dark:text-slate-100">
              How to use XMUM Market
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              A guide for XMUM students
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-3 leading-relaxed">
          XMUM Market is a student-only marketplace exclusively for Xiamen University Malaysia students.
          You need a verified <span className="font-semibold text-gray-700 dark:text-slate-300">@xmu.edu.my</span> email to post listings or contact sellers.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#003366]/10 dark:bg-blue-500/15 flex items-center justify-center text-[#003366] dark:text-blue-400 shrink-0 mt-0.5">
                {section.icon}
              </div>
              <div>
                <h2 className="text-sm font-display font-bold text-gray-900 dark:text-slate-100">
                  {section.title}
                </h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {section.subtitle}
                </p>
              </div>
            </div>

            <ul className="space-y-1.5 mb-4">
              {section.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#003366]/40 dark:bg-blue-400/50 shrink-0" />
                  <span className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>

            {section.cta && (
              <Link href={section.cta.href}>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-[#003366] dark:text-blue-400 hover:underline transition-colors">
                  {section.cta.label}
                  <ChevronRight size={12} />
                </button>
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/40">
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          <span className="font-semibold">Remember:</span> Only XMUM students with a verified @xmu.edu.my email can post listings or contact sellers. All content is subject to the{" "}
          <Link href="/listing/guidelines" className="underline">Marketplace Guidelines</Link>.
        </p>
      </div>
    </div>
  );
}
