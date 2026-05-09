const KEY = 'btw:lastVisit';

export const useLastVisit = (): {
  getLastVisit: () => number;
  recordVisit: () => void;
  isNew: (createdAt: number) => boolean;
} => {
  const getLastVisit = (): number => {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? parseInt(raw, 10) : 0;
  };

  const recordVisit = (): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, String(Date.now()));
    }
  };

  const isNew = (createdAt: number): boolean => createdAt > getLastVisit();

  return { getLastVisit, recordVisit, isNew };
};
