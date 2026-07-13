import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "destructive";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClass: Record<Variant, string> = {
  primary: "apple-btn-primary",
  secondary: "apple-btn-secondary",
  destructive: "apple-btn-destructive",
};

export function AppleButton({ variant = "primary", className, ...props }: Props) {
  return (
    <button
      type="button"
      className={cn("apple-btn", variantClass[variant], className)}
      {...props}
    />
  );
}
