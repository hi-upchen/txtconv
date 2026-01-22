interface ProBadgeProps {
  className?: string;
}

export default function ProBadge({ className = '' }: ProBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded ${className}`}>
      <span className="material-symbols-outlined text-sm" style={{ fontSize: '14px' }}>verified</span>
      Pro
    </span>
  );
}
