import React from "react";
import { ProductionPlan } from "@/types/production";
import { PackageIcon, ClipboardListIcon, ScaleIcon, TruckIcon } from "@/components/Icons";

interface StatsCardsProps {
  plans: ProductionPlan[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ plans }) => {
  const safePlans = Array.isArray(plans) ? plans : [];
  const totalWeight = safePlans.reduce((sum, p) => {
    const w = Number.isFinite(p?.weight) ? p.weight : 0;
    const q = Number.isFinite(p?.quantity) ? p.quantity : 0;
    return sum + w * q;
  }, 0);
  const pendingCount = safePlans.filter((p) => p?.status === "pending").length;
  const inProgressCount = safePlans.filter((p) => p?.status === "in_progress").length;
  const completedCount = safePlans.filter((p) => p?.status === "completed").length;

  const stats = [
    {
      label: "计划总数",
      value: plans.length,
      unit: "条",
      icon: ClipboardListIcon,
      color: "bg-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      label: "总重量",
      value: totalWeight.toFixed(2),
      unit: "吨",
      icon: ScaleIcon,
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50",
    },
    {
      label: "进行中",
      value: inProgressCount,
      unit: "条",
      icon: PackageIcon,
      color: "bg-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      label: "已完成",
      value: completedCount,
      unit: `条 / ${pendingCount}条待处理`,
      icon: TruckIcon,
      color: "bg-violet-500",
      bgColor: "bg-violet-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow duration-200"
        >
          <div className={`w-11 h-11 rounded-lg ${stat.bgColor} flex items-center justify-center flex-shrink-0`}>
            <stat.icon size={20} className={stat.color.replace("bg-", "text-")} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
            <p className="text-xl font-bold text-slate-800 truncate">
              {stat.value}
              <span className="text-sm font-normal text-slate-400 ml-1">{stat.unit}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
