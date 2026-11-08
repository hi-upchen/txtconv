'use client';

import Link from 'next/link';
import { trackUpgradeCtaClicked, type UpgradeCtaLocation } from '@/lib/analytics';
import { CHECKOUT_PATH, REFUND_NOTE } from '@/lib/payment/price';

interface ProMentionProps {
  /** Which feature area shows this line. It is sent with the click event. */
  location: UpgradeCtaLocation;
  /** The sentence about what Pro adds here. Callers build it from the shared limits. */
  children: React.ReactNode;
}

/**
 * A quiet one-line Pro offer placed next to a feature.
 *
 * It never blocks the feature. The link goes to the checkout page.
 * Callers render it only for users who are not on a paid plan.
 */
export default function ProMention({ location, children }: ProMentionProps) {
  return (
    <p className="text-xs text-gray-500" data-testid={`pro-mention-${location}`}>
      {children}
      <Link
        href={CHECKOUT_PATH}
        onClick={() => trackUpgradeCtaClicked(location)}
        className="ml-1 text-primary hover:text-primary-hover underline underline-offset-2"
      >
        了解 Pro 終身版 →
      </Link>
      <span className="ml-1">（{REFUND_NOTE}）</span>
    </p>
  );
}
