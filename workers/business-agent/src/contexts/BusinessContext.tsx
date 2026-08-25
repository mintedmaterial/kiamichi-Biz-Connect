import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

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
  sessionKey: string | null;
}

interface UserInfoResponse {
  isAdmin: boolean;
  sessionKey: string;
}

const BusinessContext = createContext<BusinessContextType | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  // Load user info on mount
  useEffect(() => {
    async function loadUserInfo() {
      try {
        const res = await fetch("/api/user-info");
        if (res.ok) {
          const data = await res.json() as UserInfoResponse;
          setIsAdmin(data.isAdmin);
          setSessionKey(data.sessionKey);
        }
      } catch (error) {
        console.error("Error loading user info:", error);
      }
    }
    loadUserInfo();
  }, []);

  // Admins choose from the full directory. Owners are limited to their verified businesses.
  useEffect(() => {
    async function loadInitialBusiness() {
      setLoading(true);
      try {
        if (isAdmin) {
          const bizRes = await fetch("/api/businesses");
          if (bizRes.ok) {
            const data = await bizRes.json() as { businesses?: Array<{ id: number }> };
            const businesses = data.businesses || [];
            const storedId = Number(sessionStorage.getItem("kbc-selected-business"));
            const selectedId = businesses.some((business) => business.id === storedId)
              ? storedId
              : businesses[0]?.id;
            if (selectedId) setSelectedBusinessId(selectedId);
          }
          return;
        }

        const myBizRes = await fetch("/api/my-business");
        if (myBizRes.ok) {
          const data = await myBizRes.json() as BusinessInfo;
          setSelectedBusinessId(data.businessId);
          setBusinessInfo(data);
        }
      } catch (error) {
        console.error("Error loading initial business:", error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialBusiness();
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && selectedBusinessId) {
      sessionStorage.setItem("kbc-selected-business", String(selectedBusinessId));
    }
  }, [isAdmin, selectedBusinessId]);

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
          const data = await res.json() as BusinessInfo;
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
        sessionKey,
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
