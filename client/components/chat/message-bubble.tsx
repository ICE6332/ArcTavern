"use client";

interface MessageBubbleProps {
  role: string;
  name?: string;
  content: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, name, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        }`}
      >
        {isUser ? "U" : (name?.charAt(0)?.toUpperCase() ?? "A")}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? "text-right" : ""}`}>
        {name && !isUser && (
          <p className="mb-1 text-xs font-medium text-muted-foreground">{name}</p>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground border border-border"
          } ${isStreaming ? "animate-pulse" : ""}`}
        >
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    </div>
  );
}
