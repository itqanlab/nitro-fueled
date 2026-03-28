export type MarkdownInsertType = 'bold' | 'italic' | 'heading' | 'list' | 'code' | 'link';

export interface InsertResult {
  newContent: string;
  newCursorPos: number;
}

export function buildInsertedContent(
  content: string,
  start: number,
  end: number,
  selectedText: string,
  type: MarkdownInsertType,
): InsertResult {
  const before = content.slice(0, start);
  const after = content.slice(end);

  switch (type) {
    case 'bold': {
      const wrapped = `**${selectedText || 'bold text'}**`;
      return { newContent: before + wrapped + after, newCursorPos: start + wrapped.length };
    }
    case 'italic': {
      const wrapped = `_${selectedText || 'italic text'}_`;
      return { newContent: before + wrapped + after, newCursorPos: start + wrapped.length };
    }
    case 'heading': {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = content.indexOf('\n', start);
      const lineEndPos = lineEnd === -1 ? content.length : lineEnd;
      const lineText = content.slice(lineStart, lineEndPos);
      const newLine = lineText.startsWith('#') ? lineText : `## ${lineText}`;
      const newContent = content.slice(0, lineStart) + newLine + content.slice(lineEndPos);
      return { newContent, newCursorPos: lineStart + newLine.length };
    }
    case 'list': {
      const insertion = `\n- ${selectedText || 'list item'}`;
      return { newContent: before + insertion + after, newCursorPos: start + insertion.length };
    }
    case 'code': {
      const wrapped = selectedText.includes('\n')
        ? `\`\`\`\n${selectedText || 'code'}\n\`\`\``
        : `\`${selectedText || 'code'}\``;
      return { newContent: before + wrapped + after, newCursorPos: start + wrapped.length };
    }
    case 'link': {
      const wrapped = `[${selectedText || 'link text'}](url)`;
      return { newContent: before + wrapped + after, newCursorPos: start + wrapped.length };
    }
  }
}
