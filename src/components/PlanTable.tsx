import React from "react";
import { ProductionPlan } from "@/types/production";
import { EditIcon, TrashIcon, CheckIcon, PackageIcon } from "@/components/Icons";

interface PlanTableProps {
  plans: ProductionPlan[];
  onEdit: (plan: ProductionPlan) => void;
  onDelete: (plan: ProductionPlan) => void;
  onStatusChange: (id: string, status: ProductionPlan["status"]) => void;
}

const statusConfig: Record<ProductionPlan["status"], { label: string; className: string }> = {
  pending: { label: "待处理", className: "bg-amber-100 text-amber-700" },
  in_progress: { label: "生产中", className: "bg-blue-100 text-blue-700" },
  completed: { label: "已完成", className: "bg-emerald-100 text-emerald-700" },
};

export const PlanTable: React.FC<PlanTableProps> = ({
  plans,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const getNextStatus = (status: ProductionPlan["status"]): ProductionPlan["status"] | null => {
    switch (status) {
      case "pending":
        return "in_progress";
      case "in_progress":
        return "completed";
      default:
        return null;
    }
  };

  if (plans.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <PackageIcon size={28} className="text-slate-300" />
        </div>
        <h3 className="text-base font-semibold text-slate-600 mb-1">暂无生产计划</h3>
        <p className="text-sm text-slate-400">点击"新建计划"按钮添加第一个生产计划</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                状态
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                公司名称
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                钢材编号
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                重量（吨）
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                数量
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                尺寸（mm）
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                发货时间
              </th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider max-w-[200px]">
                备注
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, index) => {
              const statusInfo = statusConfig[plan.status];
              const nextStatus = getNextStatus(plan.status);

              return (
                <tr
                  key={plan.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-150 ${
                    index === plans.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className} cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => nextStatus && onStatusChange(plan.id, nextStatus)}
                      title={nextStatus ? `点击切换为"${statusConfig[nextStatus].label}"` : undefined}
                    >
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-medium text-slate-800">
                      {plan.companyName ?? "-"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-sm bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                      {plan.steelCode ?? "-"}
                    </code>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm text-slate-600 font-medium">
                      {Number.isFinite(plan.weight) ? plan.weight : "-"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm text-slate-600 font-medium">
                      {Number.isFinite(plan.quantity) ? plan.quantity : "-"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-slate-600">{plan.dimensions ?? "-"}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm text-slate-600">{plan.deliveryDate ?? "-"}</span>
                  </td>
                  <td className="px-5 py-3.5 max-w-[200px]">
                    <p
                      className="text-sm text-slate-500 truncate"
                      title={plan.notes || "无备注"}
                    >
                      {plan.notes || "无备注"}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {nextStatus && (
                        <button
                          onClick={() => onStatusChange(plan.id, nextStatus)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors duration-200 cursor-pointer"
                          title={`标记为"${statusConfig[nextStatus].label}"`}
                        >
                          <CheckIcon size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(plan)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                        title="编辑"
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(plan)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
                        title="删除"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
