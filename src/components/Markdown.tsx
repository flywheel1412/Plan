import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "../utils/ui";

interface MarkdownViewProps {
  content: string;
  className?: string;
  compact?: boolean;
}

const components: Components = {
  a({ node, ...props }) {
    void node;
    return (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      />
    );
  },
  img({ node, ...props }) {
    void node;
    return <img {...props} loading="lazy" alt={props.alt ?? ""} />;
  },
};

export function MarkdownView({ content, className, compact = false }: MarkdownViewProps) {
  if (!content.trim()) return null;
  return (
    <div className={cx("markdown-body", compact && "is-compact", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
