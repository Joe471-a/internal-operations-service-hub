interface AiCheckBadgeProps {
  verified: boolean;
  /** The two call sites word the "not checked" case slightly differently. */
  uncheckedLabel?: string;
}

export function AiCheckBadge({ verified, uncheckedLabel = 'Not checked' }: AiCheckBadgeProps) {
  return (
    <span className={`ai-check ${verified ? 'ai-check-yes' : 'ai-check-no'}`}>
      {verified ? 'AI-checked' : uncheckedLabel}
    </span>
  );
}
