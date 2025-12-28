/**
 * PublishDialog Component
 * Modal dialog for confirming publication of business listing changes
 */
import { useState, useCallback } from "react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { Toggle } from "@/components/toggle/Toggle";
import {
  CheckCircle as CheckCircleIcon,
  X as XIcon,
  Warning as WarningIcon,
  FloppyDisk as FloppyDiskIcon
} from "@phosphor-icons/react";

export interface PublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (createSnapshot: boolean) => void;
  isPublishing?: boolean;
}

export function PublishDialog({
  isOpen,
  onClose,
  onConfirm,
  isPublishing = false
}: PublishDialogProps) {
  const [createSnapshot, setCreateSnapshot] = useState(true);

  const handleConfirm = useCallback(() => {
    onConfirm(createSnapshot);
  }, [onConfirm, createSnapshot]);

  const handleCancel = useCallback(() => {
    if (!isPublishing) {
      onClose();
    }
  }, [onClose, isPublishing]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={handleCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-dialog-title"
        >
        <Card
          className="max-w-md w-full bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800 shadow-2xl animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                  <CheckCircleIcon
                    size={24}
                    weight="fill"
                    className="text-green-600 dark:text-green-400"
                  />
                </div>
                <h2
                  id="publish-dialog-title"
                  className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
                >
                  Publish Changes
                </h2>
              </div>
              {!isPublishing && (
                <button
                  onClick={handleCancel}
                  className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                  aria-label="Close dialog"
                >
                  <XIcon size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <p className="text-neutral-700 dark:text-neutral-300">
                You're about to publish your changes to the live business
                listing page. This will make your updates visible to all
                visitors.
              </p>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex gap-3">
                <WarningIcon
                  size={20}
                  weight="fill"
                  className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <strong className="font-medium">Important:</strong> Once
                  published, changes will be immediately visible to the public.
                  Make sure you've reviewed the preview carefully.
                </div>
              </div>
            </div>

            {/* Snapshot Option */}
            <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className={isPublishing ? "opacity-50 pointer-events-none" : ""}>
                  <Toggle
                    toggled={createSnapshot}
                    onClick={() => setCreateSnapshot(!createSnapshot)}
                    aria-label="Create snapshot before publishing"
                    className="mt-0.5"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FloppyDiskIcon
                      size={16}
                      className="text-neutral-600 dark:text-neutral-400"
                    />
                    <span className="font-medium text-neutral-900 dark:text-neutral-100 text-sm">
                      Create snapshot before publishing
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    Recommended. Allows you to rollback to the previous version
                    if needed.
                  </p>
                </div>
              </label>
            </div>

            {/* Publishing State */}
            {isPublishing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Publishing your changes...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                size="md"
                onClick={handleCancel}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirm}
                disabled={isPublishing}
                className="bg-green-600 hover:bg-green-700 text-white border-green-700 min-w-[120px]"
              >
                {isPublishing ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Publishing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircleIcon size={16} weight="fill" />
                    Publish Now
                  </span>
                )}
              </Button>
            </div>
          </div>
        </Card>
        </div>
      </div>
    </>
  );
}
