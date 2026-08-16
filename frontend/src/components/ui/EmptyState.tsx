import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title = "Nothing here yet", hint, icon, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon ?? <Inbox size={36} strokeWidth={1.4} />}</div>
      <div className="empty-state-title">{title}</div>
      {hint && <p className="empty-state-hint">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
