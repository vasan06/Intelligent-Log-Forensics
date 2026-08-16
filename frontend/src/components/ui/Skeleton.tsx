export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="flex-col gap-2" style={{ padding: "16px", ...style }}>
      <div className="skeleton skeleton-line" style={{ width: "60%" }} />
      <div className="skeleton skeleton-line" style={{ width: "90%" }} />
      <div className="skeleton skeleton-line" style={{ width: "75%" }} />
      <div className="skeleton skeleton-block mt-2" />
    </div>
  );
}
