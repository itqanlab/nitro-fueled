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
      if (selectedText === '') {
        const wrapped = `****`;
        // Cursor lands inside: after 2nd asterisk (position start + 2)
        return { newContent: before + wrapped + after, newCursorPos: start + 2 };
      }
      const wrapped = `**${selectedText}**`;
      return { newContent: before + wrapped + after, newCursorPos: start + wrapped.length };
    }
    case 'italic': {
      if (selectedText === '') {
        const wrapped = `__`;
        // Cursor lands inside: after opening underscore (position start + 1)
        return { newContent: before + wrapped + after, newCursorPos: start + 1 };
      }
      const wrapped = `_${selectedText}_`;
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
      if (selectedText === '' || selectedText.includes('\n')) {
        const inner = selectedText === '' ? 'language\ncode here' : selectedText;
        const wrapped = `\`\`\`\n${inner}\n\`\`\``;
        // Place cursor inside the fenced block, after the opening fence newline
        const cursorPos = selectedText === '' ? start + 4 : start + wrapped.length;
        return { newContent: before + wrapped + after, newCursorPos: cursorPos };
      }
      const wrapped = `\`${selectedText}\``;
      return { newContent: before + wrapped + after, newCursorPos: start + wrapped.length };
    }
    case 'link': {
      const wrapped = `[${selectedText || 'link text'}](url)`;
      return { newContent: before + wrapped + after, newCursorPos: start + wrapped.length };
    }
  }
}
