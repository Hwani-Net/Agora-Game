import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface ShareButtonProps {
  /** The URL to share. Defaults to current page URL. */
  url?: string;
  /** Title for sharing metadata */
  title?: string;
  /** Description for sharing metadata */
  description?: string;
  /** Optional additional CSS class */
  className?: string;
}

export default function ShareButton({ url, title, description, className }: ShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const shareUrl = url || window.location.href;

  const handleShare = useCallback(async () => {
    // Use Web Share API if available (mobile, modern browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || document.title,
          text: description || '',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [shareUrl, title, description]);

  return (
    <button
      className={`btn btn--secondary btn--sm share-button ${className || ''}`}
      onClick={handleShare}
      aria-label={t('agent_detail.share.button')}
    >
      {copied ? (
        <>✅ {t('agent_detail.share.copied')}</>
      ) : (
        <>🔗 {t('agent_detail.share.button')}</>
      )}
    </button>
  );
}
