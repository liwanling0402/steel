import React from "react";
import { AlertTriangleIcon, XIcon } from "@/components/Icons";

interface DeleteDialogProps {
  onConfirm: () => void;
  onClose: () => void;
  companyName: string;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({ onConfirm, onClose, companyName }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangleIcon size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-slate-800">确认删除</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              确定要删除 <span className="font-medium text-slate-700">{companyName}</span> 的生产计划吗？此操作不可撤销。
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors duration-200 cursor-pointer flex-shrink-0"
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="px-6 py-4 bg-slate-50 rounded-b-xl flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors duration-200 cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors duration-200 cursor-pointer shadow-sm shadow-red-500/25"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
};
