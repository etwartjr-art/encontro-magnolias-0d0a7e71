import { ReactNode, CSSProperties } from "react";
import { useReveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

type Variant = "up" | "left" | "right" | "fade" | "scale";

interface RevealProps {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "header" | "footer";
}

const hiddenStyles: Record<Variant, string> = {
  up: "opacity-0 translate-y-8",
  left: "opacity-0 -translate-x-8",
  right: "opacity-0 translate-x-8",
  fade: "opacity-0",
  scale: "opacity-0 scale-95",
};

export const Reveal = ({
  children,
  variant = "up",
  delay = 0,
  className,
  as: Tag = "div",
}: RevealProps) => {
  const { ref, visible } = useReveal<HTMLElement>();

  const style: CSSProperties = {
    transitionDelay: visible ? `${delay}ms` : "0ms",
  };

  return (
    <Tag
      ref={ref as never}
      style={style}
      className={cn(
        "transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        visible ? "opacity-100 translate-x-0 translate-y-0 scale-100" : hiddenStyles[variant],
        className
      )}
    >
      {children}
    </Tag>
  );
};
