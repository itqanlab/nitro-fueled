import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AgentEditorStore } from '../agent-editor.store';
import { EditorViewMode, CursorPosition } from '../../../models/agent-editor.model';
import { MarkdownInsertType, buildInsertedContent } from './markdown-insert.utils';

@Component({
  selector: 'app-editor-panel',
  standalone: true,
  imports: [],
  templateUrl: './editor-panel.component.html',
  styleUrl: './editor-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPanelComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorTextarea') editorRef!: ElementRef<HTMLTextAreaElement>;

  protected readonly store = inject(AgentEditorStore);
  private readonly cdr = inject(ChangeDetectorRef);

  protected previewHtml = '';
  private previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    this.schedulePreviewUpdate(this.store.editorContent());
  }

  ngOnDestroy(): void {
    if (this.previewDebounceTimer !== null) {
      clearTimeout(this.previewDebounceTimer);
      this.previewDebounceTimer = null;
    }
  }

  protected get isEditorVisible(): boolean {
    const mode = this.store.viewMode();
    return mode === 'split' || mode === 'editor';
  }

  protected get isPreviewVisible(): boolean {
    const mode = this.store.viewMode();
    return mode === 'split' || mode === 'preview';
  }

  protected setViewMode(mode: EditorViewMode): void {
    this.store.setViewMode(mode);
  }

  protected onContentInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const content = textarea.value;
    this.store.updateContent(content);
    this.updateCursorFromTextarea(textarea);
    this.schedulePreviewUpdate(content);
  }

  protected onTextareaClick(event: MouseEvent): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.updateCursorFromTextarea(textarea);
  }

  protected insertMarkdown(type: MarkdownInsertType): void {
    const textarea = this.editorRef?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = this.store.editorContent();
    const selectedText = content.slice(start, end);

    const { newContent, newCursorPos } = buildInsertedContent(
      content,
      start,
      end,
      selectedText,
      type,
    );

    this.store.updateContent(newContent);
    this.schedulePreviewUpdate(newContent);

    requestAnimationFrame(() => {
      textarea.value = newContent;
      textarea.selectionStart = newCursorPos;
      textarea.selectionEnd = newCursorPos;
      textarea.focus();
      this.updateCursorFromTextarea(textarea);
      this.cdr.markForCheck();
    });
  }

  private updateCursorFromTextarea(textarea: HTMLTextAreaElement): void {
    const pos = textarea.selectionStart;
    const contentUpToCursor = textarea.value.slice(0, pos);
    const lines = contentUpToCursor.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    const totalLines = textarea.value.split('\n').length;
    const cursorPos: CursorPosition = { line, col, totalLines };
    this.store.setCursorPosition(cursorPos);
  }

  private schedulePreviewUpdate(content: string): void {
    if (this.previewDebounceTimer !== null) {
      clearTimeout(this.previewDebounceTimer);
    }
    this.previewDebounceTimer = setTimeout(() => {
      this.previewHtml = this.renderMarkdown(content);
      this.previewDebounceTimer = null;
      this.cdr.markForCheck();
    }, 300);
  }

  private renderMarkdown(content: string): string {
    try {
      const raw = marked.parse(content) as string;
      return DOMPurify.sanitize(raw);
    } catch {
      return content;
    }
  }
}
