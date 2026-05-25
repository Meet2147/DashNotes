'use client';

import React from 'react';
import { X, Download, FileText, Code2 } from 'lucide-react';
import { Note } from '@/lib/db';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
}

function htmlToMarkdown(html: string): string {
  // Basic HTML to Markdown conversion
  let md = html;

  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');

  // Bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');

  // Blockquote
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n';
  });

  // Lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, li: string) => `- ${li.trim()}\n`);
  });
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let i = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, li: string) => `${++i}. ${li.trim()}\n`);
  });

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*/gi, '![]($1)');

  // Horizontal rule
  md = md.replace(/<hr[^>]*>/gi, '\n---\n');

  // Paragraphs and line breaks
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<br[^>]*>/gi, '\n');
  md = md.replace(/<p[^>]*>/gi, '');

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up excess newlines
  md = md.replace(/\n{3,}/g, '\n\n');

  return md.trim();
}

function htmlToPlainText(html: string): string {
  let text = html;

  // Convert structural elements
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '$1\n');
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gis, '• $1\n');
  text = text.replace(/<br[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<hr[^>]*>/gi, '\n---\n');
  text = text.replace(/<[^>]+>/g, '');

  // Decode entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');

  return text.trim();
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportModal({ isOpen, onClose, note }: ExportModalProps) {
  if (!isOpen) return null;

  const safeTitle = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'note';

  const handleExportMarkdown = () => {
    const frontMatter = [
      '---',
      `title: "${note.title}"`,
      `date: ${note.createdAt instanceof Date ? note.createdAt.toISOString() : new Date(note.createdAt).toISOString()}`,
      note.tags.length ? `tags: [${note.tags.map((t) => `"${t}"`).join(', ')}]` : '',
      '---',
      '',
    ]
      .filter(Boolean)
      .join('\n');

    const content = frontMatter + `# ${note.title}\n\n` + htmlToMarkdown(note.content);
    downloadFile(content, `${safeTitle}.md`, 'text/markdown');
    onClose();
  };

  const handleExportText = () => {
    const content = `${note.title}\n${'='.repeat(note.title.length)}\n\n${htmlToPlainText(note.content)}`;
    downloadFile(content, `${safeTitle}.txt`, 'text/plain');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Download size={20} className="text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export Note</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Choose a format to export &ldquo;{note.title || 'Untitled'}&rdquo;
        </p>

        <div className="space-y-3">
          <button
            onClick={handleExportMarkdown}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:bg-violet-200 dark:group-hover:bg-violet-900/60 transition-colors">
              <Code2 size={20} />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">Markdown (.md)</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">With YAML front matter</div>
            </div>
          </button>

          <button
            onClick={handleExportText}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
              <FileText size={20} />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">Plain Text (.txt)</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Simple text format</div>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
