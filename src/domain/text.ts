export const capitalizeInitial = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const first = trimmed[0]!;
  const upper = first.toLocaleUpperCase();
  if (first === upper) return trimmed;
  return upper + trimmed.slice(1);
};
