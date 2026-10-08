import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Flame, RefreshCw, Car, DollarSign, Sparkles } from 'lucide-react';
import axios from 'axios';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get('/api/leaderboard');
      if (res.data?.data) {
        setLeaderboard(res.data.data);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getRankBadge = (index) => {
    if (index === 0) {
      return (
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 border-2 border-amber-400 text-amber-700 flex items-center justify-center font-semibold text-lg shadow-sm">
          🥇
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-10 h-10 rounded-lg bg-slate-400/20 border-2 border-slate-300 text-slate-700 flex items-center justify-center font-semibold text-lg">
          🥈
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-10 h-10 rounded-lg bg-amber-700/20 border-2 border-amber-600 text-amber-500 flex items-center justify-center font-semibold text-lg">
          🥉
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm tabular-nums">
        #{index + 1}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-indigo-500/10 border border-amber-500/30 rounded-xl p-5 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-sm ">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-amber-500/20 border border-amber-400/40 rounded-lg text-amber-700 shadow-sm">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              Staff performance
              <Flame className="w-6 h-6 text-amber-700 " />
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Live bay rankings and daily commission earnings • Auto-refreshes every 30s.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLeaderboard}
            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-700" />
            Sync Now
          </button>
          <span className="text-xs tabular-nums text-slate-500">
            {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Leaderboard Cards */}
      <div className="space-y-3">
        {leaderboard.map((worker, index) => {
          const isTop = index === 0;

          return (
            <div
              key={worker.id}
              className={`rounded-lg p-4 sm:p-5 flex items-center justify-between transition-all duration-200 border ${
                isTop
                  ? 'bg-gradient-to-r from-amber-50 via-white to-white border-amber-500/50 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-200'
              }`}
            >
              {/* Left: Rank & Avatar */}
              <div className="flex items-center gap-4">
                {getRankBadge(index)}
                <div>
                  <h4 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    {worker.name}
                    {isTop && (
                      <span className="bg-amber-400 text-slate-950 text-xs font-semibold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                        <Sparkles className="w-3 h-3" /> MVP of the Day
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                    Commission Plan: {worker.commission_rate}% per billed job
                  </p>
                </div>
              </div>

              {/* Right: Metrics */}
              <div className="flex items-center gap-5 sm:gap-10">
                {/* Cars Washed Counter */}
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider block">
                    Cars Completed
                  </span>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <Car className="w-4 h-4 text-sky-700" />
                    <span className="text-xl sm:text-2xl font-semibold tabular-nums text-slate-900">
                      {worker.cars_completed}
                    </span>
                  </div>
                </div>

                {/* Estimated Commission */}
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider block">
                    Daily Commission
                  </span>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-xl sm:text-2xl font-semibold tabular-nums text-emerald-700">
                      Rs. {Number(worker.estimated_commission).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {leaderboard.length === 0 && !isLoading && (
          <div className="p-12 text-center text-slate-500 text-sm italic bg-white border border-slate-200 rounded-lg">
            No active technicians recorded today.
          </div>
        )}
      </div>
    </div>
  );
}
