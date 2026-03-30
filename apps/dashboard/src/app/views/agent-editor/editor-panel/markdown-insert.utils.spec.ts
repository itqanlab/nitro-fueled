import { buildInsertedContent, MarkdownInsertType, InsertResult } from './markdown-insert.utils';

describe('markdown-insert.utils', () => {
  describe('buildInsertedContent', () => {
    describe('bold formatting', () => {
      it('should wrap selected text in bold', () => {
        const result = buildInsertedContent('Hello world', 6, 11, 'world', 'bold');
        expect(result.newContent).toBe('Hello **world**');
        expect(result.newCursorPos).toBe(12);
      });

      it('should insert empty bold when no selection', () => {
        const result = buildInsertedContent('Hello world', 6, 6, '', 'bold');
        expect(result.newContent).toBe('Hello **** world');
        expect(result.newCursorPos).toBe(8);
      });
    });

    describe('italic formatting', () => {
      it('should wrap selected text in italic', () => {
        const result = buildInsertedContent('Hello world', 6, 11, 'world', 'italic');
        expect(result.newContent).toBe('Hello _world_');
        expect(result.newCursorPos).toBe(12);
      });

      it('should insert empty italic when no selection', () => {
        const result = buildInsertedContent('Hello world', 6, 6, '', 'italic');
        expect(result.newContent).toBe('Hello __ world');
        expect(result.newCursorPos).toBe(7);
      });
    });

    describe('heading formatting', () => {
      it('should add heading to line', () => {
        const result = buildInsertedContent('Hello world', 0, 11, 'Hello world', 'heading');
        expect(result.newContent).toBe('## Hello world');
        expect(result.newCursorPos).toBe(13);
      });

      it('should not add heading if line already starts with #', () => {
        const result = buildInsertedContent('# Existing heading', 0, 16, '# Existing heading', 'heading');
        expect(result.newContent).toBe('# Existing heading');
        expect(result.newCursorPos).toBe(16);
      });
    });

    describe('list formatting', () => {
      it('should insert list item', () => {
        const result = buildInsertedContent('Hello world', 6, 6, '', 'list');
        expect(result.newContent).toBe('Hello \n- list item world');
        expect(result.newCursorPos).toBe(14);
      });

      it('should use selected text as list item', () => {
        const result = buildInsertedContent('Hello world', 6, 11, 'world', 'list');
        expect(result.newContent).toBe('Hello \n- world');
        expect(result.newCursorPos).toBe(13);
      });
    });

    describe('code formatting', () => {
      it('should wrap selected text in inline code', () => {
        const result = buildInsertedContent('Hello world', 6, 11, 'world', 'code');
        expect(result.newContent).toBe('Hello `world`');
        expect(result.newCursorPos).toBe(12);
      });

      it('should insert empty code block when no selection', () => {
        const result = buildInsertedContent('Hello world', 6, 6, '', 'code');
        expect(result.newContent).toBe('Hello \n```\nlanguage\ncode here\n```\n world');
        expect(result.newCursorPos).toBe(10);
      });

      it('should wrap multi-line text in code block', () => {
        const result = buildInsertedContent('Hello\nworld', 6, 11, 'world', 'code');
        expect(result.newContent).toBe('Hello\n```\nworld\n```\n');
        expect(result.newCursorPos).toBe(14);
      });
    });

    describe('link formatting', () => {
      it('should insert link with selected text', () => {
        const result = buildInsertedContent('Hello world', 6, 11, 'world', 'link');
        expect(result.newContent).toBe('Hello [world](url)');
        expect(result.newCursorPos).toBe(12);
      });

      it('should insert default link text when no selection', () => {
        const result = buildInsertedContent('Hello world', 6, 6, '', 'link');
        expect(result.newContent).toBe('Hello [link text](url)');
        expect(result.newCursorPos).toBe(12);
      });
    });

    describe('edge cases', () => {
      it('should handle empty content', () => {
        const result = buildInsertedContent('', 0, 0, '', 'bold');
        expect(result.newContent).toBe('****');
        expect(result.newCursorPos).toBe(2);
      });

      it('should handle full content selection', () => {
        const result = buildInsertedContent('Hello world', 0, 11, 'Hello world', 'bold');
        expect(result.newContent).toBe('**Hello world**');
        expect(result.newCursorPos).toBe(13);
      });
    });
  });
});