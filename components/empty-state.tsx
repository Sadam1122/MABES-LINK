import { Inbox } from "lucide-react";
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="card flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 rounded-2xl bg-slate-100 p-3 text-slate-500">
        <Inbox size={24} />
      </div>
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
    </div>
  );
}
