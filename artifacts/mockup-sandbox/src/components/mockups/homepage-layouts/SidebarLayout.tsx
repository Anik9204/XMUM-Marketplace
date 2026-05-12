import React from 'react';
import { Search, Bell, X, User } from 'lucide-react';

const SECTIONS = [
  { id: 'buy-sell', label: 'Buy & Sell', emoji: '🛍️', active: true },
  { id: 'lost-found', label: 'Lost & Found', emoji: '🔍' },
  { id: 'jobs', label: 'Jobs', emoji: '💼' },
  { id: 'assistance', label: 'Assistance', emoji: '🤝' },
  { id: 'rentals', label: 'Rentals', emoji: '🚗' },
];

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '✨', active: true },
  { id: 'electronics', label: 'Electronics', emoji: '💻' },
  { id: 'books', label: 'Books & Notes', emoji: '📚' },
  { id: 'clothing', label: 'Clothing', emoji: '👕' },
  { id: 'furniture', label: 'Furniture', emoji: '🪑' },
  { id: 'food', label: 'Food & Drinks', emoji: '🍜' },
  { id: 'services', label: 'Services', emoji: '🛠️' },
  { id: 'others', label: 'Others', emoji: '📦' },
];

const MOCK_LISTINGS = [
  {
    id: 1,
    title: 'MacBook Pro M2 2022',
    price: 'RM 4,500',
    condition: 'Used - Excellent',
    seller: 'Alex Tan',
    time: '2 hours ago',
    emoji: '💻',
  },
  {
    id: 2,
    title: 'Calculus Early Transcendentals 9th Ed',
    price: 'RM 85',
    condition: 'Used - Good',
    seller: 'Sarah Lee',
    time: '5 hours ago',
    emoji: '📚',
  },
  {
    id: 3,
    title: 'Yamaha Acoustic Guitar',
    price: 'RM 450',
    condition: 'Like New',
    seller: 'Ben Wong',
    time: '1 day ago',
    emoji: '🎸',
  },
  {
    id: 4,
    title: 'Sony WH-1000XM5 Headphones',
    price: 'RM 950',
    condition: 'Used - Good',
    seller: 'Chloe Chen',
    time: '2 days ago',
    emoji: '🎧',
  },
];

export function SidebarLayout() {
  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden text-slate-900">
      {/* LEFT SIDEBAR */}
      <aside className="w-[240px] flex-shrink-0 bg-[#003366] text-white flex flex-col h-screen overflow-y-auto">
        {/* Logo Area */}
        <div className="p-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-white text-[#003366] flex items-center justify-center font-bold text-xl leading-none">
            X
          </div>
          <span className="font-bold text-lg tracking-tight">XMUM Market</span>
        </div>

        {/* User / Sign In */}
        <div className="px-5 pb-6">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-500 overflow-hidden">
              <User size={18} />
            </div>
            <span className="font-medium text-sm">Sign In</span>
          </div>
        </div>

        {/* Sections Navigation */}
        <div className="px-3 flex-1">
          <div className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  section.active
                    ? 'bg-white text-[#003366] font-semibold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base">{section.emoji}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </div>

          <div className="h-px bg-white/10 my-6 mx-3" />

          {/* Categories */}
          <div className="px-3 mb-2 text-xs font-semibold text-white/50 uppercase tracking-wider">
            Categories
          </div>
          <div className="space-y-0.5">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  category.active
                    ? 'text-white font-medium'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base opacity-90">{category.emoji}</span>
                <span>{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Post Button (Bottom) */}
        <div className="p-5 mt-auto">
          <button className="w-full bg-white text-[#003366] font-semibold py-2.5 rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
            <span>Post Listing</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search listings, textbooks, electronics..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]/20 focus:bg-white transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-5 ml-6">
            <button className="text-slate-500 hover:text-[#003366] transition-colors relative">
              <Bell size={20} />
              <span className="absolute 1 top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <button className="text-sm font-medium text-slate-600 hover:text-[#003366] transition-colors">
              EN | 中文
            </button>
          </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Buy & Sell</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold">
                  4
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-sm font-medium shadow-sm">
                  Latest
                </button>
                <button className="px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                  Price ↑
                </button>
                <button className="px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                  Price ↓
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MOCK_LISTINGS.map((listing) => (
                <div 
                  key={listing.id} 
                  className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer flex flex-col"
                >
                  {/* Image Placeholder */}
                  <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform duration-500">
                    {listing.emoji}
                  </div>
                  
                  {/* Details */}
                  <div className="p-5 flex flex-col flex-1 relative bg-white z-10">
                    <div className="mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 uppercase tracking-wider">
                        {listing.condition}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">
                      {listing.title}
                    </h3>
                    <p className="font-bold text-[#003366] text-lg mb-4">
                      {listing.price}
                    </p>
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                      <span className="font-medium">{listing.seller}</span>
                      <span>{listing.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* End of content spacing */}
            <div className="h-12" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default SidebarLayout;
