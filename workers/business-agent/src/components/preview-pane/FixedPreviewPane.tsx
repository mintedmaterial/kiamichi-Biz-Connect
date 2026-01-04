// Fixed PreviewPane Component
// Shows actual business page instead of empty/chat content

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import {
  ArrowClockwise as ArrowClockwiseIcon,
  CheckCircle as CheckCircleIcon,
  Eye as EyeIcon
} from "@phosphor-icons/react";

export interface PreviewPaneProps {
  businessId: number | null;
  previewKey: number;
  onPublish: () => void;
  onRefresh: () => void;
  isPublishing?: boolean;
}

export function PreviewPane({
  businessId,
  previewKey,
  onPublish,
  onRefresh,
  isPublishing = false
}: PreviewPaneProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Construct proper business page URL
  const getPreviewUrl = () => {
    if (!businessId) return null;
    // Use the main site's business page URL
    return `https://kiamichibizconnect.com/business/${businessId}?preview=true&key=${previewKey}`;
  };

  const previewUrl = getPreviewUrl();

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    onRefresh();
  }, [onRefresh]);

  // Reset loading state when business changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [businessId]);

  if (!businessId) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-neutral-300 dark:border-neutral-800 px-4 py-3 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeIcon size={20} className="text-neutral-600 dark:text-neutral-400" />
              <h3 className="font-semibold text-base">Preview</h3>
            </div>
          </div>
        </div>

        {/* Empty State - Fixed */}
        <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900">
          <Card className="p-8 max-w-md text-center bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
            <div className="space-y-4">
              <div className="bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded-full p-4 inline-flex">
                <EyeIcon size={32} />
              </div>
              <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100">No Business Selected</h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                Select a business from the chat to preview their page
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-900">
        <Card className="p-6 max-w-md text-center bg-white dark:bg-neutral-800">
          <div className="text-center space-y-3">
            <div className="text-red-600 dark:text-red-400 text-4xl">⚠️</div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">Preview Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              Unable to generate preview URL
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Toolbar */}
      <div className="border-b border-neutral-300 dark:border-neutral-800 px-4 py-3 bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeIcon size={20} className="text-neutral-600 dark:text-neutral-400" />
            <h3 className="font-semibold text-base">Preview</h3>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              DRAFT
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
              title="Refresh preview"
            >
              <ArrowClockwiseIcon
                size={16}
                className={isLoading ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={onPublish}
              disabled={isPublishing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-green-700"
              title="Publish changes"
            >
              <CheckCircleIcon size={16} weight="fill" />
              <span>{isPublishing ? "Publishing..." : "Publish"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Preview iframe - Fixed to show actual business page */}
      <div className="flex-1 relative bg-neutral-50 dark:bg-neutral-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-neutral-50 dark:bg-neutral-900">
            <div className="text-center space-y-4">
              <div className="animate-spin h-8 w-8 border-4 border-neutral-300 dark:border-neutral-700 border-t-[#F48120] rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground">
                Loading business preview...
              </p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-neutral-50 dark:bg-neutral-900">
            <Card className="p-6 max-w-md mx-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <div className="text-center space-y-3">
                <div className="text-red-600 dark:text-red-400 text-4xl">⚠️</div>
                <h3 className="font-semibold text-red-900 dark:text-red-100">
                  Preview Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Unable to load the business page preview. Please try refreshing.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRefresh}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Business Page Preview */}
        {previewUrl && (
          <iframe
            key={`${businessId}-${previewKey}`}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Business Listing Preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}