import "./styles.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Providers } from "@/providers";
import { AppLayout } from "@/components/layout";
import Chat from "./app";
import { AgentsPage, DeploymentsPage, EditsPage, AccountPage } from "@/pages";

// Listing page - wraps the existing PreviewPane
function ListingPage() {
  // TODO: Extract PreviewPane from Chat and use here
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-neutral-100 mb-4">My Listing</h2>
      <p className="text-neutral-400">
        View and edit your business listing. This will show your live listing preview.
      </p>
      {/* Preview iframe or component goes here */}
    </div>
  );
}

const root = createRoot(document.getElementById("app")!);

root.render(
  <Providers>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Chat />} />
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
