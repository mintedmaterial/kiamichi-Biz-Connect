import { useState, useEffect } from "react";
import { CaretDownIcon, BuildingsIcon, CheckIcon } from "@phosphor-icons/react";

interface Business {
  id: number;
  name: string;
  slug: string;
  categoryName: string | null;
}

interface BusinessSelectorProps {
  selectedBusinessId: number | null;
  onSelect: (businessId: number) => void;
}

export function BusinessSelector({ selectedBusinessId, onSelect }: BusinessSelectorProps) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Check if user is admin
        const userRes = await fetch("/api/user-info");
        if (userRes.ok) {
          const userData = await userRes.json();
          setIsAdmin(userData.isAdmin);

          // Load all businesses if admin
          if (userData.isAdmin) {
            const bizRes = await fetch("/api/businesses");
            if (bizRes.ok) {
              const bizData = await bizRes.json();
              setBusinesses(bizData.businesses || []);
            }
          }
        }
      } catch (error) {
        console.error("Error loading business selector data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Don't show selector if not admin
  if (!isAdmin || loading) {
    return null;
  }

  const selectedBusiness = businesses.find(b => b.id === selectedBusinessId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141419] border border-[#27272a] hover:border-amber-500/50 transition-colors text-sm"
      >
        <BuildingsIcon size={16} className="text-amber-500" />
        <span className="text-neutral-100 max-w-[200px] truncate">
          {selectedBusiness?.name || "Select Business"}
        </span>
        <CaretDownIcon
          size={14}
          className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-72 max-h-80 overflow-y-auto z-50 rounded-lg bg-[#141419] border border-[#27272a] shadow-xl">
            <div className="p-2">
              <input
                type="text"
                placeholder="Search businesses..."
                className="w-full px-3 py-2 rounded-lg bg-[#0D0D0F] border border-[#27272a] text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="py-1">
              {businesses.map((business) => (
                <button
                  key={business.id}
                  onClick={() => {
                    onSelect(business.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-800/50 transition-colors ${
                    selectedBusinessId === business.id ? "bg-amber-500/10" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-100 truncate">
                      {business.name}
                    </p>
                    {business.categoryName && (
                      <p className="text-xs text-neutral-500 truncate">
                        {business.categoryName}
                      </p>
                    )}
                  </div>
                  {selectedBusinessId === business.id && (
                    <CheckIcon size={16} className="text-amber-500 flex-shrink-0" />
                  )}
                </button>
              ))}
              {businesses.length === 0 && (
                <p className="px-3 py-4 text-sm text-neutral-500 text-center">
                  No businesses found
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
