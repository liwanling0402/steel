import React from "react";
import { SearchIcon, XIcon } from "@/components/Icons";
import { ProductionPlan } from "@/types/production";

interface ToolbarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  plans: ProductionPlan[];
}

export const Toolbar: React.FC<ToolbarProps> = ({ searchTerm, onSearchChange, plans }) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      {/* Search */}
      <div className="relative w-full sm:w-80">
        <SearchIcon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索公司名称、钢材编号..."
          className="w-full pl-9 pr-8 py-2.5 text-sm rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors duration-200"
        />
        {searchTerm && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-sm text-slate-500">
        共 <span className="font-semibold text-slate-700">{Array.isArray(plans) ? plans.length : 0}</span> 条生产计划
      </p>
    </div>
  );
};
