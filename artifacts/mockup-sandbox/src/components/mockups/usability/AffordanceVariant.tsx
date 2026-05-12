import { Search, ChevronRight, MapPin, Clock, ArrowRight } from 'lucide-react';

const CATEGORIES = [
  { icon: '💻', name: 'Electronics' },
  { icon: '📚', name: 'Books' },
  { icon: '👕', name: 'Clothing' },
  { icon: '🪑', name: 'Furniture' },
  { icon: '🍜', name: 'Food' },
  { icon: '🛠️', name: 'Services' },
  { icon: '🔍', name: 'Lost & Found' },
  { icon: '💼', name: 'Jobs' },
];

const LISTINGS = [
  { id: 1, title: 'Calculus Early Transcendentals 8th Ed.', price: 'RM 45', condition: 'Used', location: 'Block D', time: '2h ago' },
  { id: 2, title: 'MacBook Air M1 8GB / 256GB Space Grey', price: 'RM 2,800', condition: 'Like New', location: 'Campus Area', time: '5h ago' },
  { id: 3, title: 'IKEA Markus Office Chair — Self Pickup', price: 'RM 150', condition: 'Used', location: 'Block A', time: '1d ago' },
];

const TABS = [
  { label: 'Buy & Sell', icon: '🛍️', active: true },
  { label: 'Lost & Found', icon: '🔍', active: false },
  { label: 'Jobs', icon: '💼', active: false },
  { label: 'Help', icon: '🤝', active: false },
];

export function AffordanceVariant() {
  return (
    <div className="w-[390px] min-h-screen bg-gray-50 font-sans text-[#0F172A] flex flex-col">

      {/* ── Header ── */}
      <header className="bg-[#003366] px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-white font-black text-sm">X</span>
            <span className="text-white font-bold text-lg">XMUM Market</span>
          </div>
          <button className="text-white/80 text-xs font-medium bg-white/10 px-2.5 py-1.5 rounded-lg active:bg-white/20">EN / 中文</button>
        </div>

        {/* Search — large, obvious affordance: icon + placeholder + contrast button */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            {/* Large 48px tap target */}
            <input
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-white text-sm text-gray-800 placeholder-gray-400 shadow-sm focus:outline-none"
              placeholder="What are you looking for?"
              readOnly
            />
          </div>
          {/* Very visible search button — high contrast, text label */}
          <button className="h-12 px-5 bg-white text-[#003366] font-bold text-sm rounded-xl shadow-sm flex items-center gap-1.5 shrink-0 active:bg-gray-100">
            <Search size={16} />
            Search
          </button>
        </div>
      </header>

      {/* ── Categories — explicit tappable tiles with affordance cues ── */}
      <section className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-800">Browse Categories</span>
          {/* Explicit "See all" with chevron — obvious link affordance */}
          <button className="flex items-center gap-1 text-xs text-[#003366] font-semibold bg-blue-50 px-2.5 py-1.5 rounded-lg">
            See all <ChevronRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {CATEGORIES.map((cat, i) => (
            /* Each tile has: border + shadow = clear button affordance */
            <button
              key={i}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-gray-100 bg-white shadow-sm active:shadow-none active:scale-95 transition-all"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Tabs — large, clearly tappable ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto scrollbar-hide px-2 gap-1 py-2">
          {TABS.map((tab, i) => (
            /* Pill-style tabs: filled vs outlined = clear active vs inactive */
            <button
              key={i}
              className={`flex items-center gap-1.5 px-4 h-10 rounded-full text-xs font-bold whitespace-nowrap shrink-0 ${
                tab.active
                  ? 'bg-[#003366] text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Listings — every card is unmistakably tappable ── */}
      <section className="flex-1 px-3 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-800">Latest Ads <span className="text-gray-400 font-normal">(8)</span></p>
          {/* Affordance: visible sort pill */}
          <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
            Recent ↓
          </button>
        </div>

        <div className="space-y-3">
          {LISTINGS.map((item) => (
            /* Row card with explicit chevron → signals navigability */
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 p-3 active:bg-gray-50 active:scale-[0.99] transition-all"
            >
              {/* Thumbnail — clearly an image placeholder */}
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center shrink-0 text-3xl border border-gray-100">
                📦
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] line-clamp-2 leading-snug mb-1">{item.title}</p>
                <p className="text-base font-black text-[#003366] mb-1.5">{item.price}</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{item.condition}</span>
                  <span className="flex items-center gap-0.5"><MapPin size={9} />{item.location}</span>
                  <span className="ml-auto flex items-center gap-0.5"><Clock size={9} />{item.time}</span>
                </div>
              </div>

              {/* Explicit navigation affordance — chevron */}
              <div className="shrink-0 w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Load more — clearly a button with full affordance cues */}
        <button className="mt-4 w-full h-12 bg-white border-2 border-[#003366] text-[#003366] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-sm active:bg-blue-50">
          Load more ads <ArrowRight size={16} />
        </button>
      </section>

      {/* Tradeoff note */}
      <div className="mx-3 mt-4 mb-20 bg-orange-50 border border-orange-100 rounded-xl p-3">
        <p className="text-[10px] text-orange-700 font-semibold mb-0.5">Design tradeoff</p>
        <p className="text-[10px] text-orange-600 leading-relaxed">Every interactive element has visible affordances: bordered tiles with shadows, pill tabs (filled = active), explicit chevron arrows, and a labelled "Search" button. Costs ~20% vertical density for much higher click confidence.</p>
      </div>

      {/* Bottom nav — POST is wide pill, not just circle */}
      <nav className="fixed bottom-0 left-0 right-0 w-[390px] bg-white border-t border-gray-200 z-50">
        <div className="flex items-end h-16 px-2">
          {[{ icon: '🏠', label: 'Home', active: true }, { icon: '🔍', label: 'Search', active: false }].map((item, i) => (
            <button key={i} className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium ${item.active ? 'text-[#003366]' : 'text-gray-400'}`}>
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
          {/* Wide pill POST button — obvious primary action */}
          <div className="flex-[1.5] flex justify-center items-end pb-2.5">
            <button className="bg-[#003366] text-white font-bold text-xs px-5 py-2.5 rounded-2xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform" style={{ marginTop: '-4px' }}>
              <span className="text-base">+</span> Post Ad
            </button>
          </div>
          {[{ icon: '💬', label: 'Messages', active: false }, { icon: '👤', label: 'Profile', active: false }].map((item, i) => (
            <button key={i} className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[10px] font-medium text-gray-400">
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
