"use client";

import { useState, useCallback, type ReactNode } from "react";
import { Renderer, type ActionEvent, type ParseResult } from "@openuidev/react-lang";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { arctavernLibrary } from "@/lib/openui";

const markdownStyles =
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5";

interface OpenUiMessageProps {
  content: string;
  isStreaming?: boolean;
  onAction?: (event: ActionEvent) => void;
}

export function OpenUiMessage({ content, isStreaming, onAction }: OpenUiMessageProps) {
  const [fallback, setFallback] = useState(false);

  const handleParseResult = useCallback((result: ParseResult | null) => {
    if (result && !result.meta.incomplete && result.root === null && !isStreaming) {
      setFallback(true);
    }
  }, [isStreaming]);

  if (fallback) {
    return (
      <div className={markdownStyles}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <OpenUiErrorBoundary fallback={
      <div className={markdownStyles}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    }>
      <Renderer
        response={content}
        library={arctavernLibrary}
        isStreaming={isStreaming}
        onAction={onAction}
        onParseResult={handleParseResult}
      />
    </OpenUiErrorBoundary>
  );
}

// Simple error boundary for OpenUI rendering failures
import { Component, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class OpenUiErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[OpenUI] Renderer error, falling back to markdown:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
