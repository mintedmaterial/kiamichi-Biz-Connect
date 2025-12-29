/**
 * PreviewPane Component
 * Displays an iframe preview of the business listing with refresh and publish controls
 */
import { useState, useCallback } from "react";
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

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Reset loading state when preview key changes
  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    onRefresh();
  }, [onRefresh]);

  if (!businessId) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-neutral-300 dark:border-neutral-800 px-4 py-3 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeIcon
                size={20}
                className="text-neutral-600 dark:text-neutral-400"
              />
              <h3 className="font-semibold text-base">Preview</h3>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="p-8 max-w-md text-center bg-neutral-100 dark:bg-neutral-900">
            <div className="space-y-4">
              <div className="bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-full p-4 inline-flex">
                <EyeIcon size={32} />
              </div>
              <h3 className="font-semibold text-lg">No Business Selected</h3>
              <p className="text-muted-foreground text-sm">
                Loading your business information...
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const previewUrl = `/preview/${businessId}?t=${previewKey}`;

  return (
    <div className="h-full flex flex-col">
      {/* Header with Toolbar */}
      <div className="border-b border-neutral-300 dark:border-neutral-800 px-4 py-3 bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeIcon
              size={20}
              className="text-neutral-600 dark:text-neutral-400"
            />
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

      {/* Preview iframe */}
      <div className="flex-1 relative bg-neutral-100 dark:bg-neutral-900">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-neutral-50 dark:bg-neutral-900">
            <div className="text-center space-y-4">
              <div className="animate-spin h-8 w-8 border-4 border-neutral-300 dark:border-neutral-700 border-t-[#F48120] rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground">
                Loading preview...
              </p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-neutral-50 dark:bg-neutral-900">
            <Card className="p-6 max-w-md mx-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <div className="text-center space-y-3">
                <div className="text-red-600 dark:text-red-400 text-4xl">
                  ⚠️
                </div>
                <h3 className="font-semibold text-red-900 dark:text-red-100">
                  Preview Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Unable to load the preview. Please try refreshing.
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

        <iframe
          key={previewKey}
          src={previewUrl}
          className="w-full h-full border-0"
          title="Business Listing Preview"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
      </div>
    </div>
  );
}
