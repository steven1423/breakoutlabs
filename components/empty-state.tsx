type Props = { title: string; body: string };

/** Empty states tell the user what to do, or what will fill the space (CLAUDE.md §14). */
export function EmptyState({ title, body }: Props) {
  return (
    <div className="mt-8 rounded-panel border border-line bg-surface px-6 py-10 text-center">
      <p className="text-18 font-medium">{title}</p>
      <p className="mt-2 text-15 text-muted">{body}</p>
    </div>
  );
}
