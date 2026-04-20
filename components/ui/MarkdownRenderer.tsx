"use client";

import { useState, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import React from "react";

import "highlight.js/styles/github.css";

const YOUTUBE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;

// Allow highlight.js class names through the sanitizer
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      ["className", /^language-./],
      ["className", /^hljs/],
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      ["className", /^hljs-/],
    ],
  },
};

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: Props) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:font-bold prose-headings:text-foreground",
        "prose-a:text-primary prose-a:underline",
        "prose-img:rounded-lg prose-img:max-h-96",
        "prose-pre:bg-transparent prose-pre:p-0",
        "prose-code:text-sm",
        "prose-blockquote:border-s-4 prose-blockquote:border-primary/30 prose-blockquote:ps-4 prose-blockquote:italic",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSanitize, sanitizeSchema],
          rehypeHighlight,
        ]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              {...props}
            >
              {children}
            </a>
          ),
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          img: ({ src, alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || ""}
              loading="lazy"
              className="rounded-lg max-h-96 object-contain"
              {...props}
            />
          ),
          p: ({ children, ...props }) => {
            // Check if paragraph contains only a YouTube URL
            const childArray = React.Children.toArray(children);
            if (childArray.length === 1) {
              const child = childArray[0];
              if (typeof child === "string") {
                const match = child.trim().match(YOUTUBE_REGEX);
                if (match) {
                  return (
                    <iframe
                      src={`https://www.youtube.com/embed/${match[1]}`}
                      className="w-full aspect-video rounded-lg"
                      allowFullScreen
                    />
                  );
                }
              }
              // Also handle when it's an <a> tag wrapping the URL
              if (React.isValidElement(child) && (child as React.ReactElement<{ href?: string }>).props?.href) {
                const href = (child as React.ReactElement<{ href?: string }>).props.href || "";
                const match = href.match(YOUTUBE_REGEX);
                if (match) {
                  return (
                    <iframe
                      src={`https://www.youtube.com/embed/${match[1]}`}
                      className="w-full aspect-video rounded-lg"
                      allowFullScreen
                    />
                  );
                }
              }
            }
            return <p {...props}>{children}</p>;
          },
          pre: ({ children, ...props }) => (
            <CodeBlockWrapper {...props}>{children}</CodeBlockWrapper>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlockWrapper({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement> & { children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = preRef.current?.textContent || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="group relative">
      <pre
        ref={preRef}
        className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900 overflow-x-auto"
        {...props}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute end-2 top-2 rounded-md bg-white/80 p-1.5 text-gray-500 opacity-0 backdrop-blur transition-opacity hover:text-gray-900 group-hover:opacity-100 dark:bg-gray-800/80 dark:hover:text-gray-100"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
