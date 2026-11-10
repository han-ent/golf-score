import { useEffect, useState } from 'react';

type WakeLockHandle = { release: () => Promise<void>; addEventListener?: (type: 'release', listener: () => void) => void };
type WakeLockStatus = 'idle' | 'on' | 'unsupported' | 'failed';

const unsupportedMessage = '이 브라우저는 화면 켜 두기를 지원하지 않습니다. 기기의 자동 잠금을 늘려 주세요.';
const failedMessage = '화면 켜 두기에 실패했습니다. 기기의 자동 잠금을 늘려 주세요.';

export function useWakeLock(enabled: boolean): { readonly active: boolean; readonly message: string | null } {
  const [status, setStatus] = useState<WakeLockStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    let current: WakeLockHandle | null = null;
    const lockApi = typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockHandle> } }).wakeLock;

    if (!lockApi) {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          setStatus('unsupported');
        }
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const wakeLock = lockApi;
    async function requestLock() {
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) {
          await next.release();
          return;
        }
        current = next;
        setStatus('on');
        next.addEventListener?.('release', () => {
          if (!cancelled) {
            setStatus('idle');
          }
        });
      } catch {
        if (!cancelled) {
          setStatus('failed');
        }
      }
    }

    void requestLock();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void requestLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void current?.release();
    };
  }, [enabled]);

  if (!enabled || status === 'idle') {
    return { active: false, message: null };
  }
  if (status === 'on') {
    return { active: true, message: null };
  }
  return { active: false, message: status === 'unsupported' ? unsupportedMessage : failedMessage };
}
