import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  pad?: "sm" | "md" | "none";
  children?: ReactNode;
}

export function Card({ title, actions, flush, pad = "md", className = "", children, ...rest }: CardProps) {
  const bodyClass = pad === "none" ? "card-body-flush" : pad === "sm" ? "card-body-sm" : "card-body";
  return (
    <div className={`card ${className}`} {...rest}>
      {title !== undefined && (
        <div className="card-header">
          <div className="card-title">{title}</div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={flush ? "card-body-flush" : bodyClass}>{children}</div>
    </div>
  );
}
