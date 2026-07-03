import { memo } from 'react';

export const SmartTableErrorState = memo(function SmartTableErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-noorix-red">
      ⚠ {message}
    </div>
  );
});

export const SmartTableLoadingState = memo(function SmartTableLoadingState({
  loadingLabel,
}: {
  loadingLabel: string;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-6 h-6 rounded-full border-2 border-noorix-border border-t-noorix-blue nx-smart-table-loading-spinner"
        />
        <span className="text-noorix-muted text-[14px] font-medium">{loadingLabel}</span>
      </div>
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i: any) => (
          <div
            key={i}
            className="rounded-lg h-11 nx-smart-table-skeleton-line"
          />
        ))}
      </div>
    </div>
  );
});
