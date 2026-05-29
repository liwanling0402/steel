import React from "react";
import { FactoryIcon } from "@/components/Icons";

interface HeaderProps {
  onNewPlan: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewPlan }) => {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center">
              <FactoryIcon size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">钢材生产计划管理系统</h1>
              <p className="text-xs text-slate-400">Production Planning Management</p>
            </div>
          </div>

          {/* New Plan Button */}
          <button
            onClick={onNewPlan}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm shadow-orange-500/25 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            新建计划
          </button>
        </div>
      </div>
    </header>
  );
};
