import clsx from 'clsx';

export function TagChip({
  name,
  category,
  active,
  onClick,
}: {
  name: string;
  category?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const base = 'chip';
  const classes = clsx(base, active && 'chip-active', onClick && 'cursor-pointer select-none');
  return (
    <span
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={classes}
      data-category={category}
    >
      {name}
    </span>
  );
}
