import React, { useState, useMemo } from "react";
import { X, List, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { TaskItem } from "../types";

interface TaskListModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskItem[];
}

const ITEMS_PER_PAGE = 50;

export const TaskListModal: React.FC<TaskListModalProps> = ({
  isOpen,
  onClose,
  tasks,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
        setCurrentPage(1);
        setExpandedTaskId(null);
    }
  }, [isOpen]);

  const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);

  // Sort tasks by startTime descending (newest first)
  const currentTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sorted.slice(start, start + ITEMS_PER_PAGE);
  }, [tasks, currentPage]);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
      setExpandedTaskId(prev => prev === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 size={12} /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle size={12} /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock size={12} /> Processing
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                <List size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800">任务列表 (Task Queue)</h2>
                <p className="text-xs text-slate-500">History of all operations</p>
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
            <table className="w-full text-left text-sm border-collapse table-fixed">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="w-10 px-4 py-3 border-b border-slate-200"></th>
                        <th className="w-48 px-4 py-3 border-b border-slate-200">Task Type</th>
                        <th className="w-32 px-4 py-3 border-b border-slate-200">Status</th>
                        <th className="w-32 px-4 py-3 border-b border-slate-200">Model</th>
                        <th className="w-32 px-4 py-3 border-b border-slate-200">Input</th>
                        <th className="w-32 px-4 py-3 border-b border-slate-200">Output</th>
                        <th className="w-40 px-4 py-3 border-b border-slate-200">Start Time</th>
                        <th className="w-24 px-4 py-3 border-b border-slate-200">Duration</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {currentTasks.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                No tasks found in history.
                            </td>
                        </tr>
                    ) : (
                        currentTasks.map((task) => (
                            <React.Fragment key={task.id}>
                                <tr className={`hover:bg-slate-50 transition-colors text-xs sm:text-sm ${expandedTaskId === task.id ? 'bg-blue-50/50' : ''}`} onClick={() => toggleExpand(task.id)}>
                                    <td className="px-4 py-3 text-center cursor-pointer text-slate-400">
                                        {expandedTaskId === task.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-700 truncate" title={task.type}>{task.type}</td>
                                    <td className="px-4 py-3">{getStatusBadge(task.status)}</td>
                                    <td className="px-4 py-3 text-slate-500 truncate" title={task.model}>{task.model}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {task.inputImages.length > 0 && (
                                                <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                                                    <img src={task.inputImages[0].url} alt="in" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <span className="text-xs text-slate-500">{task.inputImages.length} items</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {task.outputImages.length > 0 ? (
                                                <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
                                                    <img src={task.outputImages[0].url} alt="out" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                            {task.outputImages.length > 0 && <span className="text-xs text-slate-500">{task.outputImages.length} items</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{task.startTime}</td>
                                    <td className="px-4 py-3 text-slate-500 font-mono">{task.duration || '-'}</td>
                                </tr>
                                
                                {/* Expanded Details Row */}
                                {expandedTaskId === task.id && (
                                    <tr className="bg-slate-50/50">
                                        <td colSpan={8} className="px-4 py-4">
                                            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 shadow-inner overflow-hidden">
                                                <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-700 pb-2">
                                                    <Terminal size={14} />
                                                    <span className="font-semibold uppercase tracking-wider">Execution Log</span>
                                                    <span className="text-slate-600 ml-auto">{task.id}</span>
                                                </div>
                                                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-2">
                                                    {task.logs && task.logs.length > 0 ? (
                                                        task.logs.map((log, idx) => (
                                                            <div key={idx} className="whitespace-pre-wrap break-all hover:text-white transition-colors">
                                                                <span className="text-slate-500 mr-2">{log.substring(0, log.indexOf(']') + 1)}</span>
                                                                <span className={log.includes('ERROR') || log.includes('Failed') ? 'text-red-400' : 'text-slate-300'}>
                                                                    {log.substring(log.indexOf(']') + 1)}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-slate-500 italic">No detailed logs available for this task.</div>
                                                    )}
                                                    
                                                    {task.error_message && (
                                                        <div className="text-red-400 font-bold mt-2 pt-2 border-t border-slate-800">
                                                            Final Error: {task.error_message}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* Footer / Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex items-center justify-between">
            <span className="text-xs text-slate-500">
                Total tasks: {tasks.length}
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