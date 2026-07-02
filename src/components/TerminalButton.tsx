import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type TerminalButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: "default" | "good" | "warn" | "bad";
  }
>;

export function TerminalButton({
  children,
  className = "",
  tone = "default",
  type = "button",
  ...props
}: TerminalButtonProps) {
  return (
    <button className={`terminal-button terminal-button--${tone} ${className}`} type={type} {...props}>
      {children}
    </button>
  );
}
