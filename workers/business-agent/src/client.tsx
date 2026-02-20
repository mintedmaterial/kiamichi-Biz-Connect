import "./styles.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Providers } from "@/providers";
import { AppLayout } from "@/components/layout";
import { ChatPage, AgentsPage, DeploymentsPage, EditsPage, AccountPage } from "@/pages";
import { PreviewPane } from "@/components/preview-pane/PreviewPane";
import { useState, useCallback } from "react";

// Listing page - standalone preview with publish capability
function ListingPage() {
  const [previewKey, setPreviewKey] = useState(0);
  const [isPublishing] = useState(false);

  const handleRefresh = useCallback(() => {
    setPreviewKey((prev) => prev + 1);
  }, []);

  const handlePublish = useCallback(() => {
    // TODO: Implement publish dialog
    console.log("Publish clicked");
  }, []);

  return (
    <div className="h-full flex flex-col">
      <PreviewPane
        businessId={null}
        previewKey={previewKey}
        onPublish={handlePublish}
        onRefresh={handleRefresh}
        isPublishing={isPublishing}
      />
    </div>
  );
}

const root = createRoot(document.getElementById("app")!);

root.render(
  <Providers>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/listing" element={<ListingPage />} />
          <Route path="/deployments" element={<DeploymentsPage />} />
          <Route path="/edits" element={<EditsPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </Providers>
);
