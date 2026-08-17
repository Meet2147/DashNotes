/**
 * Flattens a BlockNote document into the plain text the handwriting renderer
 * lays out, so a note written in the editor can be handed straight to the
 * handwriting page.
 *
 * Structure is preserved the way a student would write it by hand: headings on
 * their own line, list items with their bullet or number, nesting by
 * indentation. Anything with no textual equivalent (images, embeds) is skipped.
 */

interface InlineNode {
  type?: string;
  text?: string;
  content?: InlineNode[] | null;
}

interface BlockNode {
  type?: string;
  props?: Record<string, unknown> | null;
  content?: InlineNode[] | { rows?: { cells?: InlineNode[][] }[] } | null;
  children?: BlockNode[] | null;
}

function inlineText(nodes: InlineNode[] | null | undefined): string {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (typeof node?.text === 'string') return node.text;
      if (Array.isArray(node?.content)) return inlineText(node.content);
      return '';
    })
    .join('');
}

function blockText(block: BlockNode): string {
  const content = block.content;
  if (Array.isArray(content)) return inlineText(content);
  if (content && Array.isArray((content as { rows?: unknown[] }).rows)) {
    const rows = (content as { rows: { cells?: InlineNode[][] }[] }).rows;
    return rows
      .map((row) => (row.cells ?? []).map((cell) => inlineText(cell)).join('  |  '))
      .join('\n');
  }
  return '';
}

function walk(blocks: BlockNode[], depth: number, out: string[]): void {
  let numbered = 0;

  for (const block of blocks) {
    const indent = '  '.repeat(depth);
    const text = blockText(block);
    const type = block.type ?? 'paragraph';

    if (type !== 'numberedListItem') numbered = 0;

    switch (type) {
      case 'bulletListItem':
        out.push(`${indent}- ${text}`);
        break;
      case 'numberedListItem':
        numbered++;
        out.push(`${indent}${numbered}. ${text}`);
        break;
      case 'checkListItem': {
        const checked = Boolean((block.props ?? {}).checked);
        out.push(`${indent}${checked ? '[x]' : '[ ]'} ${text}`);
        break;
      }
      case 'heading':
        // A blank line above a heading, the way a handwritten page breathes.
        if (out.length > 0 && out[out.length - 1] !== '') out.push('');
        out.push(`${indent}${text}`);
        break;
      case 'codeBlock':
        for (const line of text.split('\n')) out.push(`${indent}${line}`);
        break;
      case 'image':
      case 'video':
      case 'audio':
      case 'file':
        break; // nothing sensible to write by hand
      default:
        out.push(`${indent}${text}`);
        break;
    }

    if (Array.isArray(block.children) && block.children.length > 0) {
      walk(block.children, depth + 1, out);
    }
  }
}

/** BlockNote document (as stored on a Note) -> plain text. */
export function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  const out: string[] = [];
  walk(blocks as BlockNode[], 0, out);
  // Collapse runs of blank lines to at most one.
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
