import { useState, useCallback } from "react";
import "./App.css";
import { useProductionPlans } from "@/hooks/useProductionPlans";
import { ProductionPlan, ProductionPlanFormData } from "@/types/production";
import { Header } from "@/components/Header";
import { StatsCards } from "@/components/StatsCards";
import { Toolbar } from "@/components/Toolbar";
import { PlanTable } from "@/components/PlanTable";
import { PlanForm } from "@/components/PlanForm";
import { DeleteDialog } from "@/components/DeleteDialog";

function App() {
  const { plans, allPlans, searchTerm, setSearchTerm, addPlan, updatePlan, deletePlan } =
    useProductionPlans();

  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<ProductionPlan | null>(null);

  const handleNewPlan = useCallback(() => {
    setEditingPlan(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback((plan: ProductionPlan) => {
    setEditingPlan(plan);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback((plan: ProductionPlan) => {
    setDeletingPlan(plan);
  }, []);

  const handleFormSubmit = useCallback(
    (data: ProductionPlanFormData) => {
      if (editingPlan) {
        updatePlan(editingPlan.id, data);
      } else {
        addPlan(data);
      }
      setShowForm(false);
      setEditingPlan(null);
    },
    [editingPlan, addPlan, updatePlan]
  );

  const handleStatusChange = useCallback(
    (id: string, status: ProductionPlan["status"]) => {
      if (!id || !status) return;
      updatePlan(id, { status });
    },
    [updatePlan]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deletingPlan) {
      deletePlan(deletingPlan.id);
      setDeletingPlan(null);
    }
  }, [deletingPlan, deletePlan]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header onNewPlan={handleNewPlan} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Cards */}
        <StatsCards plans={allPlans} />

        {/* Toolbar */}
        <Toolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          plans={plans}
        />

        {/* Plan Table */}
        <PlanTable
          plans={plans}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      </main>

      {/* Plan Form Modal */}
      {showForm && (
        <PlanForm
          onSubmit={handleFormSubmit}
          onClose={() => {
            setShowForm(false);
            setEditingPlan(null);
          }}
          editPlan={editingPlan}
        />
      )}

      {/* Delete Confirmation */}
      {deletingPlan && (
        <DeleteDialog
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingPlan(null)}
          companyName={deletingPlan.companyName}
        />
      )}
    </div>
  );
}

export default App;
