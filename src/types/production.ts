export interface ProductionPlan {
  id: string;
  companyName: string;
  steelCode: string;
  weight: number; // 吨
  quantity: number;
  dimensions: string; // 毫米
  deliveryDate: string;
  notes: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
}

export type ProductionPlanFormData = Omit<ProductionPlan, "id" | "status" | "createdAt">;
