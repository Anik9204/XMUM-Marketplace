import React from 'react';
import { Search, ChevronDown, Bell, MessageSquare, PlusCircle, User, SlidersHorizontal, MapPin } from 'lucide-react';

export function MudahInspired() {
  const categories = [
    { icon: '💻', name: 'Electronics' },
    { icon: '📚', name: 'Books & Notes' },
    { icon: '👕', name: 'Clothing' },
    { icon: '🪑', name: 'Furniture' },
    { icon: '🍜', name: 'Food & Drinks' },
    { icon: '🛠️', name: 'Services' },
    { icon: '📦', name: 'Others' },
    { icon: '🎫', name: 'Tickets' },
    { icon: '⚽', name: 'Sports' },
    { icon: '🎮', name: 'Gaming' },
  ];

  const subChips = [
    'All Electronics', 'Laptops', 'Phones', 'Tablets', 'Audio', 'Accessories', 'PC Parts', 'Monitors'
  ];

  const listings = [
    { id: 1, title: 'Calculus Early Transcendentals 8th Edition', price: 'RM 45', condition: 'Used - Good', seller: 'Alex T.', time: '2 hours ago', icon: '📘', color: 'bg-blue-100', isAd: false },
    { id: 2, title: 'MacBook Air M1 2020 8GB/256GB Space Grey', price: 'RM 2,800', condition: 'Used - Like New', seller: 'Wei Chen', time: '5 hours ago', icon: '💻', color: 'bg-gray-200', isAd: false },
    { id: 3, title: 'Part-time Barista at Campus Cafe', price: 'RM 8/hr', condition: 'Job Offer', seller: 'Campus Cafe', time: '1 day ago', icon: '☕', color: 'bg-orange-100', isAd: false },
    { id: 4, title: '[Sponsored] Get 20% off Student Printing Services!', price: 'Promo', condition: 'Service', seller: 'PrintShop', time: 'Sponsored', icon: '🖨️', color: 'bg-yellow-100', isAd: true },
    { id: 5, title: 'Lost Black Wallet near Block D', price: 'Reward RM 50', condition: 'Lost', seller: 'Sarah L.', time: '1 day ago', icon: '👛', color: 'bg-red-100', isAd: false },
    { id: 6, title: 'IKEA Office Chair - Self Pickup', price: 'RM 60', condition: 'Used - Fair', seller: 'John D.', time: '2 days ago', icon: '🪑', color: 'bg-green-100', isAd: false },
    { id: 7, title: 'Sony WH-1000XM4 Headphones', price: 'RM 750', condition: 'Used - Good', seller: 'Mikey', time: '2 days ago', icon: '🎧', color: 'bg-indigo-100', isAd: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* 1. Slim Top Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-[color:#003366] font-bold text-xl tracking-tight flex items-center gap-2">
              <span className="bg-[color:#003366] text-white p-1 rounded">XM</span>
              Market
            </div>
            <div className="hidden md:flex items-center gap-4 text-sm font-medium text-gray-600">
              <a href="#" className="text-[color:#003366]">Home</a>
              <a href="#" className="hover:text-[color:#003366]">Search</a>
              <a href="#" className="hover:text-[color:#003366]">Market</a>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-[color:#003366]"><MessageSquare size={20} /></button>
            <button className="text-gray-500 hover:text-[color:#003366]"><Bell size={20} /></button>
            <div className="h-6 w-px bg-gray-300"></div>
            <button className="hidden sm:flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              EN <ChevronDown size={14} />
            </button>
            <button className="flex items-center gap-1 text-sm font-medium text-[color:#003366] hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors">
              <User size={18} /> Sign In
            </button>
            <button className="flex items-center gap-2 bg-[color:#003366] hover:bg-blue-900 text-white text-sm font-bold px-4 py-2 rounded shadow-sm transition-colors">
              <PlusCircle size={18} /> Post Ad
            </button>
          </div>
        </div>
      </header>

      {/* Hero Search Bar */}
      <div className="bg-white border-b border-gray-200 pb-6 pt-4">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sm text-gray-500 mb-3 text-center sm:text-left">Student-only marketplace · @xmu.edu.my</p>
          
          <div className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 shadow-inner">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="What are you looking for?" 
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded focus:outline-none focus:border-[color:#003366] focus:ring-1 focus:ring-[color:#003366]"
              />
            </div>
            
            <div className="relative w-full sm:w-48 hidden sm:block">
              <select className="w-full appearance-none bg-white border border-gray-300 rounded px-4 py-3 pr-10 focus:outline-none focus:border-[color:#003366] text-gray-700">
                <option>All Categories</option>
                <option>Electronics</option>
                <option>Books & Notes</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
            </div>
            
            <div className="relative w-full sm:w-48 hidden sm:block">
              <select className="w-full appearance-none bg-white border border-gray-300 rounded px-4 py-3 pr-10 focus:outline-none focus:border-[color:#003366] text-gray-700">
                <option>Entire Campus</option>
                <option>Block A</option>
                <option>Block D</option>
              </select>
              <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
            </div>

            <button className="bg-[color:#003366] hover:bg-blue-900 text-white font-bold px-8 py-3 rounded transition-colors w-full sm:w-auto text-lg flex items-center justify-center gap-2">
              <Search size={20} /> Search
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        
        {/* Category Icon Grid */}
        <section className="mb-8 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 px-2">Browse Categories</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {categories.map((cat, idx) => (
              <button key={idx} className="flex flex-col items-center justify-center p-4 border border-gray-100 rounded-lg hover:border-[color:#003366] hover:bg-blue-50 transition-all group">
                <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-xs sm:text-sm font-medium text-gray-700 text-center">{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Section Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar border-b border-gray-300 mb-4">
          <button className="whitespace-nowrap px-6 py-3 font-bold text-[color:#003366] border-b-2 border-[color:#003366]">
            Buy & Sell 🛍️
          </button>
          <button className="whitespace-nowrap px-6 py-3 font-medium text-gray-500 hover:text-gray-800">
            Lost & Found 🔍
          </button>
          <button className="whitespace-nowrap px-6 py-3 font-medium text-gray-500 hover:text-gray-800">
            Jobs 💼
          </button>
          <button className="whitespace-nowrap px-6 py-3 font-medium text-gray-500 hover:text-gray-800">
            Assistance 🤝
          </button>
          <button className="whitespace-nowrap px-6 py-3 font-medium text-gray-500 hover:text-gray-800">
            Rentals 🚗
          </button>
        </div>

        {/* Active Category Sub-chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {subChips.map((chip, idx) => (
            <button key={idx} className={`px-4 py-1.5 rounded-full text-sm font-medium ${idx === 0 ? 'bg-[color:#003366] text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {chip}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Main Content */}
          <div className="flex-1">
            {/* Listings Count + Sort */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 bg-white p-3 rounded border border-gray-200">
              <span className="text-sm text-gray-600 font-medium"><strong className="text-gray-900">1,248</strong> ads found for Buy & Sell</span>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                <span className="text-xs text-gray-500 uppercase tracking-wider">SORT BY</span>
                <select className="text-sm border-none bg-transparent font-medium text-gray-800 focus:outline-none focus:ring-0 cursor-pointer">
                  <option>Recent First</option>
                  <option>Price: Low to High</option>
                  <option>Price: High to Low</option>
                </select>
                <SlidersHorizontal size={16} className="text-gray-400 ml-2" />
              </div>
            </div>

            {/* Listing Rows (Classifieds Style) */}
            <div className="bg-white border border-gray-200 rounded divide-y divide-gray-100 shadow-sm">
              {listings.map((item) => (
                <div key={item.id} className={`flex p-3 sm:p-4 hover:bg-gray-50 transition-colors cursor-pointer ${item.isAd ? 'bg-yellow-50/30' : ''}`}>
                  {/* Left Image Placeholder */}
                  <div className={`w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded flex items-center justify-center text-4xl sm:text-5xl ${item.color} border border-black/5`}>
                    {item.icon}
                  </div>
                  
                  {/* Right Details */}
                  <div className="ml-3 sm:ml-4 flex flex-col justify-between flex-1 py-1">
                    <div>
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-2 leading-snug group-hover:text-[color:#003366] transition-colors pr-2">
                          {item.title}
                        </h3>
                        {item.isAd && <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap">Ad</span>}
                      </div>
                      <div className="font-bold text-[color:#003366] text-lg sm:text-xl mt-1 sm:mt-2">
                        {item.price}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><MapPin size={12} /> Campus Area</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">{item.condition}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{item.seller}</span>
                      <span className="ml-auto font-medium text-gray-400">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 py-3 bg-white border border-gray-300 rounded font-bold text-[color:#003366] hover:bg-gray-50 transition-colors">
              Load More Ads
            </button>
          </div>

          {/* Right Sidebar (Ad Banners) */}
          <div className="w-full lg:w-72 hidden md:block">
            <div className="bg-white border border-gray-200 p-4 rounded text-center h-64 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
              <span className="text-xs text-gray-400 uppercase tracking-widest mb-2">Advertisement</span>
              <div className="text-4xl mb-2">🍔</div>
              <h4 className="font-bold text-[color:#003366] mb-1">Campus Cafe Promo</h4>
              <p className="text-sm text-gray-600 mb-4">Show your student ID for 10% off all meals today!</p>
              <button className="bg-[color:#003366] text-white text-sm font-bold px-4 py-2 rounded">Learn More</button>
            </div>
            
            <div className="bg-white border border-gray-200 p-4 rounded mt-4 text-center h-96 flex flex-col items-center justify-center">
              <span className="text-xs text-gray-400 uppercase tracking-widest mb-2">Advertisement</span>
              <div className="text-5xl mb-4">📱</div>
              <h4 className="font-bold text-gray-800 mb-2">Need a new phone?</h4>
              <p className="text-sm text-gray-600">Check out the latest student deals on electronics.</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
