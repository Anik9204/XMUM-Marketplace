import React from 'react';
import { 
  Search, 
  Globe, 
  MessageSquare, 
  Store, 
  PlusSquare, 
  Home, 
  MapPin, 
  Clock, 
  Tag,
  ChevronDown,
  User
} from 'lucide-react';

export function FeedLayout() {
  const listings = [
    {
      id: 1,
      title: "MacBook Pro M1 2020 16GB RAM 512GB SSD",
      price: "RM 3,500",
      condition: "Used",
      seller: "Alex Chen",
      time: "2 hours ago",
      image: "/__mockup/images/macbook.jpg",
      category: "Electronics",
      description: "Excellent condition, no scratches. Comes with original box and charger. Battery health at 89%. Selling because I upgraded to M3."
    },
    {
      id: 2,
      title: "Stewart Calculus Early Transcendentals 9th Edition",
      price: "RM 80",
      condition: "Used",
      seller: "Sarah Wong",
      time: "5 hours ago",
      image: "/__mockup/images/calculus-textbook.jpg",
      category: "Books & Notes",
      description: "Slight highlighting on first few chapters, otherwise pristine condition. Essential for MAT101."
    },
    {
      id: 3,
      title: "Beginner Guitar Lessons on Campus",
      price: "RM 40/hr",
      condition: "New",
      seller: "David Lee",
      time: "1 day ago",
      image: "/__mockup/images/guitar.jpg",
      category: "Services",
      description: "Learn basic chords, strumming patterns, and your favorite pop songs. I can provide an acoustic guitar for the lessons if you don't have one."
    },
    {
      id: 4,
      title: "Lost: AirPods Pro Gen 2 Case",
      price: "Reward: RM 50",
      condition: "Used",
      seller: "Emily Tan",
      time: "2 days ago",
      image: "/__mockup/images/airpods-case.jpg",
      category: "Lost & Found",
      description: "Lost somewhere near the library cafe or D block. It has a small scratch on the bottom right corner. Earbuds are still with me, just lost the case!"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Top Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="#" className="font-bold text-xl text-[#003366] tracking-tight">XMUM Market</a>
            
            <div className="hidden md:flex items-center gap-4 text-sm font-medium text-gray-600">
              <a href="#" className="flex items-center gap-1.5 text-[#003366]"><Home size={16} /> Home</a>
              <a href="#" className="flex items-center gap-1.5 hover:text-[#003366]"><Search size={16} /> Search</a>
              <a href="#" className="flex items-center gap-1.5 hover:text-[#003366]"><Store size={16} /> Market</a>
              <a href="#" className="flex items-center gap-1.5 hover:text-[#003366]"><MessageSquare size={16} /> Messages</a>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="hidden md:flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <Globe size={16} /> EN <ChevronDown size={14} />
            </button>
            <a href="#" className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[#003366] hover:underline">
              <PlusSquare size={16} /> Post
            </a>
            <button className="text-sm font-medium px-4 py-2 text-[#003366] bg-blue-50 hover:bg-blue-100 rounded-full transition-colors">
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Compact Hero / Headline Area */}
      <div className="bg-[#003366] text-white py-3 px-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-sm font-semibold tracking-wide">STUDENT COMMUNITY MARKETPLACE</h1>
          <button className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-medium transition-colors">
            Join the Community
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* Search Bar - Full Width */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search for electronics, textbooks, services..." 
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-[#003366] focus:ring-1 focus:ring-[#003366] focus:bg-white sm:text-sm transition-colors"
          />
        </div>

        {/* Section Tabs - Full-width horizontal pills with counts */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-[#003366] text-white rounded-full text-sm font-medium">
            <span>Buy & Sell 🛍️</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">2.4k</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors">
            <span>Lost & Found 🔍</span>
            <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs text-gray-600">42</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors">
            <span>Jobs 💼</span>
            <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs text-gray-600">18</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors">
            <span>Assistance 🤝</span>
            <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs text-gray-600">56</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-full text-sm font-medium transition-colors">
            <span>Rentals 🚗</span>
            <span className="bg-gray-200 px-2 py-0.5 rounded-full text-xs text-gray-600">12</span>
          </button>
        </div>

        {/* Category Filter Chips - Scrollable Row */}
        <div className="flex overflow-x-auto gap-2 pb-4 mb-2 no-scrollbar scroll-smooth">
          {["✨ All", "💻 Electronics", "📚 Books & Notes", "👕 Clothing", "🪑 Furniture", "🍜 Food & Drinks", "🛠️ Services", "📦 Others"].map((cat, i) => (
            <button key={i} className={`whitespace-nowrap px-3 py-1.5 rounded text-sm font-medium border ${i === 0 ? 'border-[#003366] text-[#003366] bg-blue-50' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Listings Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Listings</h2>
          <span className="text-sm text-gray-500 font-medium">Showing 4 listings</span>
        </div>

        {/* Listings Feed - Horizontal Rows */}
        <div className="flex flex-col gap-0 border-t border-gray-200">
          {listings.map((listing) => (
            <a href="#" key={listing.id} className="group flex flex-col sm:flex-row gap-4 py-5 border-b border-gray-200 hover:bg-gray-50 transition-colors px-2 -mx-2 rounded-lg">
              
              {/* Image Thumbnail - Left */}
              <div className="w-full sm:w-[140px] h-[140px] flex-shrink-0 bg-gray-100 rounded border border-gray-200 overflow-hidden">
                <img 
                  src={listing.image} 
                  alt={listing.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Details - Right */}
              <div className="flex flex-col flex-grow min-w-0">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-[#003366] transition-colors truncate">
                    {listing.title}
                  </h3>
                  <div className="whitespace-nowrap font-bold text-lg text-[#003366]">
                    {listing.price}
                  </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                  {listing.description}
                </p>

                <div className="mt-auto flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-500">
                  <span className={`px-2 py-0.5 rounded border font-medium ${
                    listing.condition === 'New' 
                      ? 'border-green-200 bg-green-50 text-green-700' 
                      : 'border-gray-200 bg-gray-100 text-gray-700'
                  }`}>
                    {listing.condition}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <Tag size={14} />
                    {listing.category}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <User size={14} />
                    {listing.seller}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Clock size={14} />
                    {listing.time}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Load More */}
        <div className="mt-8 text-center">
          <button className="text-[#003366] font-medium text-sm hover:underline">
            Load more listings...
          </button>
        </div>

      </main>
    </div>
  );
}
