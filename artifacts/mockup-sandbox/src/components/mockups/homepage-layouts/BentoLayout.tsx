import React, { useState } from "react";
import { Search, Globe, ChevronDown, Menu, MapPin, Clock, Tag } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";

export default function BentoLayout() {
  const [activeTab, setActiveTab] = useState("Buy & Sell");
  const [searchQuery, setSearchQuery] = useState("");

  const sectionTabs = [
    { name: "Buy & Sell", emoji: "🛍️" },
    { name: "Lost & Found", emoji: "🔍" },
    { name: "Jobs", emoji: "💼" },
    { name: "Assistance", emoji: "🤝" },
    { name: "Rentals", emoji: "🚗" },
  ];

  const categories = [
    { name: "All", emoji: "✨" },
    { name: "Electronics", emoji: "💻" },
    { name: "Books & Notes", emoji: "📚" },
    { name: "Clothing", emoji: "👕" },
    { name: "Furniture", emoji: "🪑" },
    { name: "Food & Drinks", emoji: "🍜" },
    { name: "Services", emoji: "🛠️" },
    { name: "Others", emoji: "📦" },
  ];

  const listings = [
    {
      id: 1,
      title: "Bugatti Chiron - Like New",
      price: "RM 15,000,000",
      condition: "Used",
      seller: "Rich Student",
      time: "2h ago",
      image: "/__mockup/images/bugatti.png",
      span: "col-span-1 md:col-span-2 row-span-2",
      height: "h-[400px]",
    },
    {
      id: 2,
      title: "iPhone 14 Pro 256GB Purple",
      price: "RM 3,500",
      condition: "Used",
      seller: "Tech Geek",
      time: "5h ago",
      image: "/__mockup/images/iphone.png",
      span: "col-span-1",
      height: "h-[250px]",
    },
    {
      id: 3,
      title: "Calculus Early Transcendentals",
      price: "RM 80",
      condition: "Used",
      seller: "Math Major",
      time: "1d ago",
      image: "/__mockup/images/textbook.png",
      span: "col-span-1",
      height: "h-[250px]",
    },
    {
      id: 4,
      title: "Acoustic Guitar Lessons",
      price: "RM 50/hr",
      condition: "New",
      seller: "Music Club",
      time: "2d ago",
      image: "/__mockup/images/guitar.png",
      span: "col-span-1",
      height: "h-[250px]",
    },
    {
      id: 5,
      title: "Found: AirPods Pro Case",
      price: "Free",
      condition: "Used",
      seller: "Honest Finder",
      time: "3d ago",
      image: "/__mockup/images/airpods.png",
      span: "col-span-1 md:col-span-2",
      height: "h-[250px]",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Menu className="h-6 w-6 text-gray-500 lg:hidden" />
            <span className="text-[#003366] font-bold text-xl tracking-tight">XMUM Market</span>
          </div>

          <div className="hidden lg:flex items-center space-x-8">
            <a href="#" className="text-gray-900 font-medium hover:text-[#003366] transition-colors">Home</a>
            <a href="#" className="text-gray-600 hover:text-[#003366] transition-colors">Search</a>
            <a href="#" className="text-gray-600 hover:text-[#003366] transition-colors">Messages</a>
            <a href="#" className="text-gray-600 hover:text-[#003366] transition-colors">Market</a>
            <a href="#" className="text-gray-600 hover:text-[#003366] transition-colors">Post</a>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center text-sm text-gray-600 cursor-pointer hover:text-gray-900">
              <Globe className="h-4 w-4 mr-1" />
              EN <ChevronDown className="h-3 w-3 ml-1" />
            </div>
            <Button variant="default" className="bg-[#003366] hover:bg-[#002244] text-white rounded-full px-6">
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Section Tabs */}
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-gray-200">
          {sectionTabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.name
                  ? "bg-[#003366] text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <span className="text-lg">{tab.emoji}</span>
              {tab.name}
            </button>
          ))}
        </div>

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column (55%) */}
          <div className="lg:col-span-7 bg-[#003366] rounded-[2rem] p-8 md:p-12 text-white shadow-xl flex flex-col justify-center min-h-[400px] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-[#002244] rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="relative z-10">
              <Badge className="bg-white/20 text-white hover:bg-white/30 mb-6 w-fit border-none px-3 py-1">
                University Marketplace
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]">
                Buy, Sell & Find<br/>
                <span className="text-blue-300">within the XMUM Community</span>
              </h1>
              
              <div className="relative max-w-xl mb-8">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="What are you looking for?"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-400/50 shadow-lg text-lg transition-shadow"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="absolute right-2 top-2 bottom-2 bg-[#003366] text-white px-6 rounded-xl font-medium hover:bg-[#002244] transition-colors">
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (45%) */}
          <div className="lg:col-span-5 relative rounded-[2rem] overflow-hidden group shadow-xl h-[400px] lg:h-auto cursor-pointer">
            <img 
              src="/__mockup/images/bugatti.png" 
              alt="Featured Listing" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            
            <div className="absolute top-4 left-4">
              <Badge className="bg-red-500 text-white font-bold px-3 py-1 text-xs uppercase tracking-wider shadow-lg border-none">
                Featured Spotlight
              </Badge>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex justify-between items-end gap-4">
                <div>
                  <h3 className="text-2xl font-bold mb-2 leading-tight">Bugatti Chiron - Like New</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-200">
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> D3 Level 1</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> 2h ago</span>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl border border-white/30">
                  <span className="text-xl font-extrabold">RM 15M</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Pills Row */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Categories</h2>
          <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide snap-x">
            {categories.map((cat, i) => (
              <button 
                key={cat.name}
                className="snap-start flex-none flex flex-col items-center justify-center gap-2 min-w-[90px] p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className="w-14 h-14 rounded-full bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-3xl mb-1 transition-colors">
                  {cat.emoji}
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-[#003366] text-center">
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Listings Bento Grid */}
        <div>
          <div className="flex justify-between items-end mb-6 px-1">
            <h2 className="text-2xl font-bold text-gray-900">Fresh Discoveries</h2>
            <a href="#" className="text-[#003366] font-medium hover:underline flex items-center gap-1 text-sm">
              View all 12 listings <span aria-hidden="true">&rarr;</span>
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[250px]">
            {listings.map((listing) => (
              <div 
                key={listing.id} 
                className={`relative rounded-2xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 ${listing.span}`}
              >
                <img 
                  src={listing.image} 
                  alt={listing.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                
                <div className="absolute top-4 left-4">
                  <Badge variant="secondary" className="bg-white/90 text-gray-900 backdrop-blur-sm shadow-sm font-semibold border-none">
                    {listing.condition}
                  </Badge>
                </div>
                
                <div className="absolute top-4 right-4">
                  <button className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                  </button>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex justify-between items-end gap-2 mb-2">
                    <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">{listing.title}</h3>
                    <div className="bg-[#003366] text-white px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap">
                      {listing.price}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${listing.seller}`} alt={listing.seller} />
                    </div>
                    <span className="font-medium text-gray-200">{listing.seller}</span>
                    <span>•</span>
                    <span>{listing.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
