import React from 'react';
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-800 rounded-lg ${className}`} />
);
export const SkeletonCard = () => (
  <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-4 space-y-3">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-8 w-2/3" />
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-4/5" />
  </div>
);
export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: rows }).map((_, i) => (
      <React.Fragment key={i}>
        <Skeleton className="h-14 w-full" />
      </React.Fragment>
    ))}
  </div>
);
