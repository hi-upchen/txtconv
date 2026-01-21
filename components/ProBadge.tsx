interface ProBadgeProps {
  className?: string;
}

export default function ProBadge({ className = '' }: ProBadgeProps) {
  return (
    <span className={`tag is-warning ${className}`}>
      <span className="icon is-small mr-1">
        <i className="fas fa-star" />
      </span>
      Pro
    </span>
  );
}
