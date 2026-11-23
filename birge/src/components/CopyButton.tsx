import { useState } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt('', text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={16} />
      <span>{done ? t('common.copied') : label ?? t('common.copy')}</span>
    </button>
  );
}
