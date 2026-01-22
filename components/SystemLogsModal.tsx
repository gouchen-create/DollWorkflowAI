import React, { useState, useMemo } from "react";
import { X, FileText, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { LogEntry } from "../types";

interface SystemLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

const ITEMS_PER_PAGE = 50;

export const SystemLogsModal: React.FC<SystemLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when opening
  React.useEffect(() => {
    if (isOpen) setCurrentPage(1);
  }, [isOpen]);

  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE);
  
  // Sort logs by timestamp descending (newest first)
  const currentLogs = useMemo(() => {
    const sorted = [...logs].reverse(); 
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [logs, currentPage]);

  if (!isOpen) return null;

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR': return <AlertCircle size={16} className="text-red-500" />;
      case 'WARN': return <AlertTriangle size={16} className="text-amber-500" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  const getLevelClass = (level: string) => {
    switch (level) {
      case 'ERROR': return "text-red-700 bg-red-50";
      case 'WARN': return "text-amber-700 bg-amber-50";
      default: return "text-blue-700 bg-blue-50";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                <FileText size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800">系统日志 (System Logs)</h2>
                <p className="text-xs text-slate-500">Real-time backend events</p>
             </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-3 w-48 border-b border-slate-200">Timestamp</th>
                        <th className="px-6 py-3 w-24 border-b border-slate-200">Level</th>
                        <th className="px-6 py-3 border-b border-slate-200">Message</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {currentLogs.length === 0 ? (
                        <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                No logs recorded in this session.
                            </td>
                        </tr>
                    ) : (
                        currentLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors font-mono text-xs sm:text-sm">
                                <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                                <td className="px-6 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getLevelClass(log.level)}`}>
                                        {getLevelIcon(log.level)}
                                        {log.level}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-slate-700 break-all">{log.message}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* Footer / Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between">
            <span className="text-xs text-slate-500">
                Total entries: {logs.length}
            </span>
            {totalPages > 1 && (
                <div className="flex gap-2">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-3 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-xs flex items-center px-2 text-slate-600">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-3 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};