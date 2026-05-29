import React, { useState, useEffect } from "react";
import { ProductionPlan, ProductionPlanFormData } from "@/types/production";
import {
  BuildingIcon,
  HashIcon,
  ScaleIcon,
  RulerIcon,
  CalendarIcon,
  FileTextIcon,
  XIcon,
  PackageIcon,
  TruckIcon,
} from "@/components/Icons";

interface PlanFormProps {
  onSubmit: (data: ProductionPlanFormData) => void;
  onClose: () => void;
  editPlan?: ProductionPlan | null;
}

export const PlanForm: React.FC<PlanFormProps> = ({ onSubmit, onClose, editPlan }) => {
  const [formData, setFormData] = useState<ProductionPlanFormData>({
    companyName: "",
    steelCode: "",
    weight: 0,
    quantity: 0,
    dimensions: "",
    deliveryDate: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProductionPlanFormData, string>>>({});

  useEffect(() => {
    if (editPlan) {
      setFormData({
        companyName: editPlan.companyName ?? "",
        steelCode: editPlan.steelCode ?? "",
        weight: Number.isFinite(editPlan.weight) ? editPlan.weight : 0,
        quantity: Number.isFinite(editPlan.quantity) ? editPlan.quantity : 0,
        dimensions: editPlan.dimensions ?? "",
        deliveryDate: editPlan.deliveryDate ?? "",
        notes: editPlan.notes ?? "",
      });
    }
  }, [editPlan]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ProductionPlanFormData, string>> = {};
    const companyName = formData.companyName ?? "";
    const steelCode = formData.steelCode ?? "";
    const dimensions = formData.dimensions ?? "";

    if (!companyName.trim()) newErrors.companyName = "请输入公司名称";
    if (!steelCode.trim()) newErrors.steelCode = "请输入钢材编号";
    if (!Number.isFinite(formData.weight) || formData.weight <= 0)
      newErrors.weight = "重量必须大于0";
    if (!Number.isFinite(formData.quantity) || formData.quantity <= 0)
      newErrors.quantity = "数量必须大于0";
    if (!dimensions.trim()) newErrors.dimensions = "请输入尺寸";
    if (!formData.deliveryDate) newErrors.deliveryDate = "请选择发货时间";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof ProductionPlanFormData, value: string | number) => {
    setFormData((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
              {editPlan ? (
                <FileTextIcon className="w-5 h-5 text-white" />
              ) : (
                <PackageIcon className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {editPlan ? "编辑生产计划" : "新建生产计划"}
              </h2>
              <p className="text-sm text-slate-500">
                {editPlan ? "修改现有生产计划信息" : "添加新的钢材生产计划"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Company Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <BuildingIcon size={16} className="text-slate-400" />
              公司名称
            </label>
            <input
              type="text"
              value={formData.companyName ?? ""}
              onChange={(e) => handleChange("companyName", e.target.value)}
              placeholder="请输入订购公司名称"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                errors.companyName ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
              }`}
            />
            {errors.companyName && (
              <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>
            )}
          </div>

          {/* Steel Code & Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                <HashIcon size={16} className="text-slate-400" />
                钢材编号
              </label>
              <input
                type="text"
                value={formData.steelCode ?? ""}
                onChange={(e) => handleChange("steelCode", e.target.value)}
                placeholder="如：Q235B"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                  errors.steelCode ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
                }`}
              />
              {errors.steelCode && (
                <p className="mt-1 text-xs text-red-500">{errors.steelCode}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                <PackageIcon size={16} className="text-slate-400" />
                数量
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleChange("quantity", Number(e.target.value))}
                placeholder="请输入数量"
                min="1"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                  errors.quantity ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
                }`}
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-500">{errors.quantity}</p>
              )}
            </div>
          </div>

          {/* Weight & Dimensions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                <ScaleIcon size={16} className="text-slate-400" />
                重量（吨）
              </label>
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => handleChange("weight", Number(e.target.value))}
                placeholder="请输入重量"
                min="0"
                step="0.01"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                  errors.weight ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
                }`}
              />
              {errors.weight && (
                <p className="mt-1 text-xs text-red-500">{errors.weight}</p>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                <RulerIcon size={16} className="text-slate-400" />
                尺寸（毫米）
              </label>
              <input
                type="text"
                value={formData.dimensions ?? ""}
                onChange={(e) => handleChange("dimensions", e.target.value)}
                placeholder="如：2000×1500×10"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                  errors.dimensions ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
                }`}
              />
              {errors.dimensions && (
                <p className="mt-1 text-xs text-red-500">{errors.dimensions}</p>
              )}
            </div>
          </div>

          {/* Delivery Date */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <TruckIcon size={16} className="text-slate-400" />
              发货时间
            </label>
              <input
                type="date"
                value={formData.deliveryDate ?? ""}
                onChange={(e) => handleChange("deliveryDate", e.target.value)}
              className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors duration-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                errors.deliveryDate ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
              }`}
            />
            {errors.deliveryDate && (
              <p className="mt-1 text-xs text-red-500">{errors.deliveryDate}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <FileTextIcon size={16} className="text-slate-400" />
              备注
            </label>
            <textarea
              value={formData.notes ?? ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="特殊要求、制作方法、注意事项等..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm transition-colors duration-200 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors duration-200 cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors duration-200 cursor-pointer shadow-sm shadow-orange-500/25"
            >
              {editPlan ? "保存修改" : "创建计划"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
