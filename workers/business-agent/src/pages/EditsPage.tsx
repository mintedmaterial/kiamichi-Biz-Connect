import { ClockCounterClockwiseIcon, CheckCircleIcon, XCircleIcon, HourglassIcon } from "@phosphor-icons/react";

const mockEdits = [
  {
    id: 1,
    type: "Component Update",
    description: "Updated hero section headline",
    status: "approved",
    date: "2 hours ago",
  },
  {
    id: 2,
    type: "SEO Optimization",
    description: "Added meta description and keywords",
    status: "approved",
    date: "Yesterday",
  },
  {
    id: 3,
    type: "Image Upload",
    description: "Added gallery images",
    status: "pending",
    date: "Yesterday",
  },
];

export function EditsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">Edit History</h2>
        <p className="text-neutral-400 text-sm mt-1">
          Review all changes made to your listing
        </p>
      </div>

      {/* Edits list */}
      <div className="space-y-3">
        {mockEdits.map((edit) => (
          <div
            key={edit.id}
            className="p-4 rounded-xl bg-[#141419] border border-[#27272a] flex items-center gap-4"
          >
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center
              ${edit.status === "approved" ? "bg-green-500/10" : "bg-yellow-500/10"}
            `}>
              {edit.status === "approved" ? (
                <CheckCircleIcon size={20} className="text-green-400" />
              ) : (
                <HourglassIcon size={20} className="text-yellow-400" />
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-neutral-100">{edit.type}</h4>
              <p className="text-sm text-neutral-400">{edit.description}</p>
            </div>
            <div className="text-right">
              <span className={`
                px-2 py-1 text-xs rounded-full
                ${edit.status === "approved" 
                  ? "bg-green-500/10 text-green-400" 
                  : "bg-yellow-500/10 text-yellow-400"
                }
              `}>
                {edit.status === "approved" ? "Approved" : "Pending"}
              </span>
              <p className="text-xs text-neutral-500 mt-1">{edit.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
