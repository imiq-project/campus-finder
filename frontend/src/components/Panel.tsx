import type { ReactNode } from "react";
import "./Panel.css";

interface PanelProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Panel({
  children,
  className = "",
  onClick,
}: PanelProps) {
  return (
    <section
      className={`glass-panel ${className}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children && <div>{children}</div>}
    </section>
  );
}
