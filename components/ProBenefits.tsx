import { PRO_DICT_PAIR_LIMIT_LABEL } from '@/lib/custom-dict';
import { FREE_MAX_FILE_SIZE_LABEL, PRO_MAX_FILE_SIZE_LABEL } from '@/lib/file-validator';

interface ProBenefitsProps {
  /** Classes for the list itself. Each caller sets its own spacing. */
  className: string;
  /**
   * How the dictionary bullet reads.
   *   - explained: names the limit and says what the dictionary is for.
   *   - compact: names the limit only.
   */
  dictionaryWording: 'explained' | 'compact';
  /** Bullets that follow the file size and dictionary bullets. */
  extraItems: string[];
}

/**
 * Renders the bulleted list of Pro lifetime benefits.
 *
 * The numbers come from the limits the app enforces.
 * So the copy cannot drift from what Pro actually unlocks.
 */
export default function ProBenefits({ className, dictionaryWording, extraItems }: ProBenefitsProps) {
  const items = [
    `單檔最大 ${PRO_MAX_FILE_SIZE_LABEL}（免費版 ${FREE_MAX_FILE_SIZE_LABEL}）`,
    dictionaryWording === 'explained'
      ? `自訂字典 ${PRO_DICT_PAIR_LIMIT_LABEL} 組，固定人名與專有名詞譯法`
      : `自訂字典對照 ${PRO_DICT_PAIR_LIMIT_LABEL} 組`,
    ...extraItems,
  ];

  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="text-gray-900 mt-0.5">•</span>
          {item}
        </li>
      ))}
    </ul>
  );
}
