import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension, InputRule } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Code2,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function markdownOf(editor: Editor): string {
  const storage = editor.storage as unknown as {
    markdown?: { getMarkdown: () => string };
  };
  return storage.markdown?.getMarkdown() ?? "";
}

/** Converts typed "[ ] " / "[x] " (optionally after "- ") into a task list item. */
const TaskListShortcut = Extension.create({
  name: "taskListShortcut",
  addInputRules() {
    return [
      new InputRule({
        find: /^\s*\[([ xX])\]\s$/,
        handler: ({ range, match, chain }) => {
          const checked = match[1].toLowerCase() === "x";
          chain().deleteRange(range).toggleTaskList().run();
          if (checked) {
            chain().updateAttributes("taskItem", { checked: true }).run();
          }
        },
      }),
    ];
  },
});

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  const lastEmitted = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListShortcut,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Placeholder.configure({
        placeholder:
          "支持 Markdown：## 标题、**粗体**、- 列表、`代码`、[链接](https://...)",
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "markdown-body markdown-editor-content",
        "aria-label": "任务描述（Markdown）",
      },
    },
    onUpdate: ({ editor: instance }) => {
      const markdown = markdownOf(instance);
      lastEmitted.current = markdown;
      onChange(markdown);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    if (markdownOf(editor) === value) {
      lastEmitted.current = value;
      return;
    }
    editor.commands.setContent(value, false);
    lastEmitted.current = value;
  }, [editor, value]);

  const setLink = () => {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("输入链接地址", previous ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  if (!editor) {
    return <div className="markdown-editor markdown-editor-loading" />;
  }

  const buttons: Array<{
    label: string;
    icon: JSX.Element;
    action: () => void;
  }> = [
    { label: "加粗", icon: <Bold size={15} />, action: () => editor.chain().focus().toggleBold().run() },
    { label: "斜体", icon: <Italic size={15} />, action: () => editor.chain().focus().toggleItalic().run() },
    { label: "二级标题", icon: <Heading2 size={15} />, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "无序列表", icon: <List size={15} />, action: () => editor.chain().focus().toggleBulletList().run() },
    { label: "有序列表", icon: <ListOrdered size={15} />, action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "任务列表", icon: <ListChecks size={15} />, action: () => editor.chain().focus().toggleTaskList().run() },
    { label: "引用", icon: <Quote size={15} />, action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "代码块", icon: <Code2 size={15} />, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: "链接", icon: <Link2 size={15} />, action: setLink },
    { label: "撤销", icon: <Undo2 size={15} />, action: () => editor.chain().focus().undo().run() },
    { label: "重做", icon: <Redo2 size={15} />, action: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div className="markdown-editor">
      <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 格式工具栏">
        {buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            title={button.label}
            aria-label={button.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={button.action}
          >
            {button.icon}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
