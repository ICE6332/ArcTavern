"use client"

import { cn } from "@/lib/utils"

export interface LoaderProps {
  variant?:
    | "circular"
    | "classic"
    | "pulse"
    | "pulse-dot"
    | "dots"
    | "typing"
    | "wave"
    | "bars"
    | "terminal"
    | "text-blink"
    | "text-shimmer"
    | "loading-dots"
  size?: "sm" | "md" | "lg"
  text?: string
  className?: string
}

export function CircularLoader({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const sizeClasses = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
  }

  return (
    <div role="status" aria-label="Loading" className={cn("inline-flex items-center justify-center", className)}>
      <svg className={cn("animate-spin text-current", sizeClasses[size])} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function DotsLoader({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const dotSizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
  }

  const containerSizes = {
    sm: "h-4",
    md: "h-5",
    lg: "h-6",
  }

  return (
    <div role="status" aria-label="Loading" className={cn("inline-flex items-center justify-center gap-1", containerSizes[size], className)}>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={cn("animate-[bounce-dots_1.4s_ease-in-out_infinite] rounded-full bg-current", dotSizes[size])}
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function TypingLoader({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const dotSizes = {
    sm: "h-1 w-1",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
  }

  const containerSizes = {
    sm: "h-4",
    md: "h-5",
    lg: "h-6",
  }

  return (
    <div role="status" aria-label="Loading" className={cn("inline-flex items-center justify-center gap-1", containerSizes[size], className)}>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={cn("animate-[typing_1.4s_ease-in-out_infinite] rounded-full bg-current opacity-50", dotSizes[size])}
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function TextShimmerLoader({
  text = "Thinking",
  className,
  size = "md",
}: {
  text?: string
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  return (
    <div role="status" aria-label={text} className={cn("inline-flex items-center", className)}>
      <span
        className={cn(
          "animate-[shimmer-text_3s_ease-in-out_infinite] bg-[linear-gradient(90deg,var(--muted-foreground)_0%,var(--foreground)_50%,var(--muted-foreground)_100%)] bg-[length:250%_100%] bg-clip-text text-transparent",
          textSizes[size],
        )}
      >
        {text}
      </span>
    </div>
  )
}

export function TextDotsLoader({
  className,
  text = "Thinking",
  size = "md",
}: {
  className?: string
  text?: string
  size?: "sm" | "md" | "lg"
}) {
  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  return (
    <div role="status" aria-label={text} className={cn("inline-flex items-baseline", className)}>
      <span className={cn("text-current", textSizes[size])}>
        {text}
      </span>
      <span className="ml-0.5 inline-flex">
        <span className="animate-[loading-dots_1.4s_ease-in-out_infinite] text-current" style={{ animationDelay: "0s" }}>
          .
        </span>
        <span className="animate-[loading-dots_1.4s_ease-in-out_infinite] text-current" style={{ animationDelay: "0.2s" }}>
          .
        </span>
        <span className="animate-[loading-dots_1.4s_ease-in-out_infinite] text-current" style={{ animationDelay: "0.4s" }}>
          .
        </span>
      </span>
    </div>
  )
}

function Loader({
  variant = "circular",
  size = "md",
  text,
  className,
}: LoaderProps) {
  switch (variant) {
    case "circular":
      return <CircularLoader size={size} className={className} />
    case "dots":
      return <DotsLoader size={size} className={className} />
    case "typing":
      return <TypingLoader size={size} className={className} />
    case "text-shimmer":
      return <TextShimmerLoader text={text} size={size} className={className} />
    case "loading-dots":
      return <TextDotsLoader text={text} size={size} className={className} />
    default:
      return <CircularLoader size={size} className={className} />
  }
}

export { Loader }
