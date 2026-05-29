import { useState, useCallback, useMemo } from "react";
import { ProductionPlan, ProductionPlanFormData } from "@/types/production";

const STORAGE_KEY = "steel-production-plans";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/** 验证 localStorage 读取的数据是否为有效数组 */
function isValidPlanArray(data: unknown): data is ProductionPlan[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.companyName === "string" &&
      typeof item.steelCode === "string" &&
      typeof item.weight === "number" &&
      typeof item.quantity === "number" &&
      typeof item.dimensions === "string" &&
      typeof item.deliveryDate === "string" &&
      typeof item.notes === "string" &&
      typeof item.status === "string" &&
      ["pending", "in_progress", "completed"].includes(item.status) &&
      typeof item.createdAt === "string"
  );
}

function loadPlans(): ProductionPlan[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!isValidPlanArray(parsed)) {
      console.warn("localStorage 中数据格式无效，已重置");
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed;
  } catch (e) {
    console.error("读取生产计划数据失败:", e);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 静默处理清除失败
    }
    return [];
  }
}

function savePlans(plans: ProductionPlan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch (e) {
    console.error("保存生产计划数据失败（可能是 localStorage 已满）:", e);
  }
}

export function useProductionPlans() {
  const [plans, setPlans] = useState<ProductionPlan[]>(() => {
    try {
      return loadPlans();
    } catch {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState("");

  const addPlan = useCallback((data: ProductionPlanFormData) => {
    const newPlan: ProductionPlan = {
      companyName: data.companyName?.trim() ?? "",
      steelCode: data.steelCode?.trim() ?? "",
      weight: Number.isFinite(data.weight) ? data.weight : 0,
      quantity: Number.isFinite(data.quantity) ? data.quantity : 0,
      dimensions: data.dimensions?.trim() ?? "",
      deliveryDate: data.deliveryDate ?? "",
      notes: data.notes?.trim() ?? "",
      id: generateId(),
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };
    setPlans((prev) => {
      const updated = [newPlan, ...prev];
      savePlans(updated);
      return updated;
    });
  }, []);

  const updatePlan = useCallback((id: string, data: Partial<ProductionPlan>) => {
    if (!id) return;
    setPlans((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, ...data } : p
      );
      savePlans(updated);
      return updated;
    });
  }, []);

  const deletePlan = useCallback((id: string) => {
    if (!id) return;
    setPlans((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePlans(updated);
      return updated;
    });
  }, []);

  const filteredPlans = useMemo(() => {
    if (!searchTerm) return plans;
    const term = searchTerm.toLowerCase();
    return plans.filter(
      (plan) =>
        (plan.companyName ?? "").toLowerCase().includes(term) ||
        (plan.steelCode ?? "").toLowerCase().includes(term) ||
        (plan.notes ?? "").toLowerCase().includes(term)
    );
  }, [plans, searchTerm]);

  return {
    plans: filteredPlans,
    allPlans: plans,
    searchTerm,
    setSearchTerm,
    addPlan,
    updatePlan,
    deletePlan,
  };
}
