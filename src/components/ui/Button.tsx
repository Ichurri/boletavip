import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-glow focus-visible:ring-ring",
  secondary:
    "bg-muted text-foreground hover:bg-border focus-visible:ring-muted-foreground",
  outline:
    "border border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary focus-visible:ring-muted-foreground",
  ghost:
    "bg-transparent text-foreground hover:bg-muted focus-visible:ring-muted-foreground",
  danger:
    "bg-danger text-white hover:opacity-90 focus-visible:ring-danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleProps = {}) {
  return cn(
    "inline-flex cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & ButtonStyleProps) {
  return (
    <button className={buttonVariants({ variant, size, className })} {...props} />
  );
}
