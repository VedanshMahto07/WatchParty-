import React, { useState, useEffect } from 'react';
import { Search, Film, Play, Plus, Check, Star, Clock, Filter, X } from 'lucide-react';

const CATEGORIES = ['All', 'Animation', 'Fantasy', 'Sci-Fi', 'Action', 'Documentary'];

export default function MovieDiscovery({
  isOpen,
  onClose,
  onPlayMovie,
  onAddToPlaylist,
  currentMovieId
}) {
  const [movies, setMovies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;
    fetchMovies();
  }, [isOpen, searchQuery, selectedCategory]);

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const host = window.location.hostname || 'localhost';
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      const apiUrl = `/api/movies?${params.toString()}`;
      let res;
      try {
        res = await fetch(apiUrl);
      } catch {
        res = await fetch(`http://${host}:4000/api/movies?${params.toString()}`);
      }
      const data = await res.json();
      setMovies(data);
    } catch (err) {
      console.error('Failed to fetch catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQueue = (movie) => {
    onAddToPlaylist(movie);
    setAddedIds(prev => new Set(prev).add(movie.id));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(movie.id);
        return next;
      });
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-4xl bg-dark-850 border border-dark-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-dark-700/80 flex items-center justify-between bg-dark-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Movie Discovery & Library</h3>
              <p className="text-xs text-slate-400">Discover curated cinematic media with instant group synchronization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="p-4 border-b border-dark-700 bg-dark-900/40 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Fuzzy search titles, genres, directors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-dark-800 text-slate-400 hover:text-slate-200 hover:bg-dark-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Movies Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {movies.map((movie) => {
            const isCurrent = currentMovieId === movie.id;
            const isQueued = addedIds.has(movie.id);

            return (
              <div
                key={movie.id}
                className="group relative bg-dark-800 border border-dark-700/80 rounded-xl overflow-hidden hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition flex flex-col"
              >
                {/* Poster */}
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-400 flex items-center gap-1 border border-amber-400/20">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{movie.rating}</span>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{movie.duration}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      {movie.category} • {movie.year}
                    </span>
                    <h4 className="font-bold text-white text-sm line-clamp-1 mt-0.5">
                      {movie.title}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {movie.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-dark-700/60">
                    <button
                      onClick={() => {
                        onPlayMovie(movie);
                        onClose();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{isCurrent ? 'Restart' : 'Play Now'}</span>
                    </button>

                    <button
                      onClick={() => handleQueue(movie)}
                      disabled={isQueued}
                      title="Add to shared room playlist queue"
                      className="p-1.5 bg-dark-700 hover:bg-dark-600 text-slate-300 hover:text-white rounded-lg border border-dark-600 transition disabled:opacity-60"
                    >
                      {isQueued ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

