import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BusinessInfo {
  businessId: number;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  categoryId: number | null;
  categoryName: string | null;
  listingPageId: number | null;
  isPublished: boolean;
  previewUrl: string;
  liveUrl: string;
}

interface BusinessContextType {
  selectedBusinessId: number | null;
  setSelectedBusinessId: (id: number | null) => void;
  businessInfo: BusinessInfo | null;
  loading: boolean;
  isAdmin: boolean;
  refreshBusiness: () => void;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Load user info on mount
  useEffect(() => {
    async function loadUserInfo() {
      try {
        const res = await fetch("/api/user-info");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Error loading user info:", error);
      }
    }
    loadUserInfo();
  }, []);

  // Load initial business (from session or first in list for admin)
  useEffect(() => {
    async function loadInitialBusiness() {
      setLoading(true);
      try {
        // First try to get user's own business
        const myBizRes = await fetch("/api/my-business");
        if (myBizRes.ok) {
          const data = await myBizRes.json();
          setSelectedBusinessId(data.businessId);
          setBusinessInfo(data);
          setLoading(false);
          return;
        }

        // If admin with no owned business, load the list and select first
        if (isAdmin) {
          const bizRes = await fetch("/api/businesses");
          if (bizRes.ok) {
            const data = await bizRes.json();
            if (data.businesses && data.businesses.length > 0) {
              setSelectedBusinessId(data.businesses[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Error loading initial business:", error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialBusiness();
  }, [isAdmin]);

  // Load business info when selection changes
  useEffect(() => {
    async function loadBusinessInfo() {
      if (!selectedBusinessId) {
        setBusinessInfo(null);
        return;
      }

      try {
        // Use admin endpoint if admin
        const endpoint = isAdmin
          ? `/api/business/${selectedBusinessId}`
          : "/api/my-business";
        
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          setBusinessInfo(data);
        } else {
          setBusinessInfo(null);
        }
      } catch (error) {
        console.error("Error loading business info:", error);
        setBusinessInfo(null);
      }
    }

    loadBusinessInfo();
  }, [selectedBusinessId, isAdmin]);

  const refreshBusiness = () => {
    if (selectedBusinessId) {
      // Trigger reload by setting to null and back
      const currentId = selectedBusinessId;
      setSelectedBusinessId(null);
      setTimeout(() => setSelectedBusinessId(currentId), 0);
    }
  };

  return (
    <BusinessContext.Provider
      value={{
        selectedBusinessId,
        setSelectedBusinessId,
        businessInfo,
        loading,
        isAdmin,
        refreshBusiness,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return context;
}
