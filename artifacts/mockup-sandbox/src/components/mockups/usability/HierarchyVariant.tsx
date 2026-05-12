import { Search, MapPin, Clock, ChevronRight, Bookmark } from 'lucide-react';

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
  { id: 1, title: 'Calculus Early Transcendentals 8th Ed.', price: 'RM 45', condition: 'Used', location: 'Block D', time: '2h ago', cat: 'Books' },
  { id: 2, title: 'MacBook Air M1 8GB / 256GB Space Grey', price: 'RM 2,800', condition: 'Like New', location: 'Campus Area', time: '5h ago', cat: 'Electronics' },
  { id: 3, title: 'IKEA Markus Office Chair — Self Pickup', price: 'RM 150', condition: 'Used', location: 'Block A', time: '1d ago', cat: 'Furniture' },
  { id: 4, title: 'Sony WH-1000XM4 Noise Cancelling Headphones', price: 'RM 750', condition: 'Good', location: 'Campus Area', time: '2d ago', cat: 'Electronics' },
];

const TABS = ['Buy & Sell', 'Lost & Found', 'Jobs', 'Help'];

export function HierarchyVariant() {
  return (
    <div className="w-[390px] min-h-screen bg-[#F0F4F8] font-sans text-[#0F172A] flex flex-col">

      {/* ── Header: secondary hierarchy ── */}
      <header className="bg-[#003366] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-white font-black text-sm">X</span>
            <span className="text-white font-bold text-lg tracking-tight">XMUM Market</span>
          </div>
          <span className="text-white/60 text-xs">@xmu.edu.my only</span>
        </div>

        {/* Search — PRIMARY visual element */}
        <div className="relative mb-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-sm text-gray-800 placeholder-gray-400 focus:outline-none shadow-sm"
            placeholder="What are you looking for?"
            readOnly
          />
        </div>
        <p className="text-white/40 text-[10px] text-right mt-1">Press Search or tap a category below</p>
      </header>

      {/* ── Section 1: Categories — SECONDARY hierarchy ── */}
      <section className="bg-white px-4 pt-4 pb-5 border-b-4 border-[#F0F4F8]">
        {/* Section label — clear hierarchy marker */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.12em]">Browse Categories</h2>
          <button className="text-[11px] text-[#003366] font-semibold flex items-center gap-0.5">All <ChevronRight size={12} /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map((cat, i) => (
            <button key={i} className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[#F8FAFF] border border-blue-50">
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Section 2: Tab filter — TERTIARY hierarchy ── */}
      <div className="bg-white border-b border-gray-100 px-3">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map((tab, i) => (
            <button
              key={i}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 ${
                i === 0
                  ? 'border-[#003366] text-[#003366]'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 3: Listings — QUATERNARY (content zone) ── */}
      <section className="flex-1 px-3 pt-4">
        {/* Section marker — unambiguous label */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-black text-[#0F172A] leading-none">Latest Ads</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">8 listings · Buy & Sell</p>
          </div>
          <select className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none">
            <option>Recent</option>
            <option>Price ↑</option>
            <option>Price ↓</option>
          </select>
        </div>

        {/* Listing cards — clear internal hierarchy: title > price > meta */}
        <div className="grid grid-cols-2 gap-3">
          {LISTINGS.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              {/* Image placeholder — clearly subordinate */}
              <div className="aspect-square bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center relative">
                <span className="text-4xl">📦</span>
                <span className="absolute top-2 left-2 bg-gray-100 text-gray-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{item.condition}</span>
                <button className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center">
                  <Bookmark size={11} className="text-gray-400" />
                </button>
              </div>
              <div className="p-2.5">
                {/* 1st: Title — dominant weight */}
                <p className="text-xs font-bold text-[#0F172A] line-clamp-2 leading-snug mb-1.5">{item.title}</p>
                {/* 2nd: Price — dominant color/size */}
                <p className="text-sm font-black text-[#003366] mb-2">{item.price}</p>
                {/* 3rd: Meta — clearly subordinate */}
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <MapPin size={9} />
                  <span className="truncate">{item.location}</span>
                  <span className="ml-auto shrink-0">{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tradeoff note */}
      <div className="mx-3 mt-4 mb-20 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <p className="text-[10px] text-blue-700 font-semibold mb-0.5">Design tradeoff</p>
        <p className="text-[10px] text-blue-600 leading-relaxed">Sacrifices density for scannable structure. Each zone (search → categories → tabs → listings) is clearly delimited. Title → price → meta follows predictable F-pattern scanning.</p>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 w-[390px] bg-white border-t border-gray-200 flex items-end h-16 z-50">
        {['🏠 Home', '🔍 Search', '', '💬 Messages', '👤 Profile'].map((label, i) => (
          i === 2
            ? <div key={i} className="flex-1 flex justify-center items-end pb-2">
                <div className="w-12 h-12 rounded-full bg-[#003366] flex items-center justify-center shadow-lg" style={{ marginTop: '-12px' }}>
                  <span className="text-white text-xl font-bold leading-none">+</span>
                </div>
              </div>
            : <button key={i} className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[9px] font-medium ${i === 0 ? 'text-[#003366]' : 'text-gray-400'}`}>
                <span className="text-base leading-none">{label.split(' ')[0]}</span>
                <span>{label.split(' ')[1]}</span>
              </button>
        ))}
      </nav>
    </div>
  );
}
