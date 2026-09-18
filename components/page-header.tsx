import { DataBadge, type DataStatus } from "@/components/badge";

type Props = {
  title: string;
  caption: string;
  status: DataStatus;
  reason?: string;
};

/** Every page opens with a bold headline, one caption line saying why it exists, and its badge. */
export function PageHeader({ title, caption, status, reason }: Props) {
  return (
    <header className="flex flex-col gap-2 border-b border-line pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-32">{title}</h1>
        <DataBadge status={status} reason={reason} />
      </div>
      <p className="text-15 text-muted">{caption}</p>
    </header>
  );
}
