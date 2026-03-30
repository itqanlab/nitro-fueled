# Code Logic Review — TASK_2026_080

## Score: 6/10

## Summary

| Metric              | Value           |
|---------------------|-----------------|
| Overall Score       | 6/10            |
| Assessment          | NEEDS_FIXES     |
| Critical Issues     | 2               |
| Serious Issues      | 4               |
| Moderate Issues     | 3               |
| Failure Modes Found | 9               |

---

## Requirements Fulfillment

| Requirement | Status | Concern |
|-------------|--------|---------|
| 3-column layout renders at correct proportions | PARTIAL | Layout structure is present in HTML; no proportions enforced in TypeScript — CSS-only, but the 3-column wrapper is correct at the HTML level |
| Metadata panel renders all fields including MCP tool access and knowledge scope badges | COMPLETE | All fields present, sub-components imported and rendered |
| Editor toolbar buttons insert correct markdown syntax at cursor | PARTIAL | Bold/italic/code/link are correct but heading and list logic have bugs (see Findings) |
| Tab switcher (Split/Editor/Preview) shows/hides panels correctly | COMPLETE | `isEditorVisible`/`isPreviewVisible` getters are correct, viewMode signal works |
| Preview panel renders live markdown to HTML with DOMPurify | COMPLETE | `marked` + `DOMPurify` used, try/catch present |
| Bottom action bar displays line/col status and save buttons | PARTIAL | Status bar renders but "Save as vN" always shows the CURRENT version number, not the NEXT version (see Critical Issue 1) |
| isDirty computed logic correctness | PARTIAL | Comparison logic is correct but has a silent inconsistency with array references (see Serious Issue 1) |
| Debounce timer cleanup on destroy | COMPLETE | `ngOnDestroy` clears `previewDebounceTimer` |
| Empty agent list edge case | PARTIAL | Constructor guards with `list.length > 0` but template still renders status bar with `null` agent (see Serious Issue 2) |
| Null selectedAgent edge case | PARTIAL | saveDraft/saveVersion guard with early return but UI never signals the no-op to the user |

### Implicit Requirements NOT Addressed

1. Agent switching while dirty: switching agents without saving silently discards unsaved changes — no confirmation dialog, no dirty check before `selectAgent()`.
2. The nav items in the sidebar (Skills, Commands, Prompts, Workflows) are hardcoded as inactive and do nothing on click. They appear interactive but are dead UI.
3. Version number shown in "Save as vN" should be `currentVersion + 1`, not `currentVersion`.
4. `totalLines` is initialized to 0 in the store (`cursorPosition` default `{ line: 1, col: 1, totalLines: 0 }`). The status bar renders "0 lines" until the user clicks inside the textarea.

---

## The 5 Paranoid Questions

### 1. How does this fail silently?

- `saveDraft()` and `saveVersion()` both reset the `originalContent` and `originalMetadata` signals but do NOT persist anything to any backend, IPC, or storage. This is a mock-only store with no actual save mechanism. The methods succeed silently regardless. This is acceptable in a mock-data context but must be called out: there is zero persistence path for the new metadata fields (`mcpTools`, `knowledgeScope`, `type`, `displayName`). The requirement doc says "persist via tags JSON or version content" but no such logic exists anywhere in the store.

- `selectAgent(id)` calls `this.mockData.getAgentEditorData(id)` which returns `undefined` if the id is not found, and the guard `if (!agent) return` returns silently. The `selectedAgent` signal is NOT cleared to `null`. This means if the store previously had a valid agent selected and then `selectAgent('invalid-id')` is called, the old agent's data remains visible in the UI while the sidebar shows nothing selected.

- `AgentEditorStore.agentList` is initialized as a plain readonly array from `this.mockData.getAgentEditorList()` at class field definition time. It is NOT a signal. If `MockDataService` is ever updated to return dynamic data, this store will not react. No signal or computed wraps it — this is technically fine for pure mock data but violates the reactive pattern established in the rest of the store.

### 2. What user action causes unexpected behavior?

- **Clicking "Save as v1"**: The button always shows the current version number (`store.selectedAgent()?.currentVersion ?? 1`). If the agent is at v3, the button reads "Save as v3" and the aria-label says "Save as version 3". The user expects to create v4. This is a significant UX inaccuracy — the label should show `currentVersion + 1`.

- **Switching agents with unsaved edits**: The user edits an agent's content extensively, then clicks a different agent in the sidebar. `selectAgent()` immediately overwrites `editorContent`, `metadata`, `originalContent`, `originalMetadata` with no warning. All edits are silently lost.

- **Clicking toolbar buttons when no agent is selected**: The `insertMarkdown()` method reads from `this.store.editorContent()`. If `selectedAgent` is null and `editorContent` is the default empty string `''`, the toolbar buttons operate on empty content. The result is still written back to the store via `updateContent()` and the preview re-renders. This is not destructive but produces phantom content in the store when no real agent is loaded.

- **Pressing Space on a sidebar list item**: The `(keydown.space)` handler calls `selectAgent(agent.id)` which triggers selection. However, browsers scroll the page on Space by default. `event.preventDefault()` is not called, so the page scrolls AND the agent is selected. On narrow viewports this causes jarring scroll behavior.

- **Clicking the "Agents" nav button in the sidebar**: The nav items only apply `nav-item--active` class but have no `(click)` handler. Clicking "Skills", "Commands", etc. does nothing. These look interactive and will confuse users.

### 3. What data makes this produce wrong results?

- **Heading insertion on a line that already starts with `#`**: In `markdown-insert.utils.ts` line 32, the condition `lineText.startsWith('#')` exits early and leaves the line as-is. This means a line that is `# Heading` will NOT be promoted to `## Heading` and a line that starts with `#!bash` (a shebang) will be treated as already-headed and skipped. The requirement says "insert `## ` at the beginning of the current line" — the early-exit logic contradicts this.

- **List insertion**: The `list` case at line 37 inserts `\n- ${selectedText || 'list item'}` — it prepends a newline regardless of cursor position. If the cursor is already at the start of a blank line, this produces a double blank line before the list item. The requirement says "insert `- ` at the beginning of the current line", but the implementation inserts at the cursor position with a preceding newline — it does NOT go to the line start.

- **Bold/italic cursor placement**: After wrapping selected text in `**...**`, `newCursorPos` is set to `start + wrapped.length`, which places the cursor AFTER the closing `**`. The requirement says "the cursor SHALL be placed inside the markers if no text was selected." When no text is selected, the placeholder `'bold text'` is inserted but the cursor lands AFTER `**bold text**`, not inside the markers. The user must manually reposition to replace the placeholder.

- **Code block for empty selection**: The condition `selectedText.includes('\n')` at line 41 — when `selectedText` is `''` (empty, no selection), `''.includes('\n')` is `false`, so inline backticks are produced: `` `code` ``. The requirement says "fenced code block for multi-line OR no selection." The implementation is wrong for the "no selection" case — it should produce a fenced block, not inline backticks.

- **isDirty with array fields**: The `isDirty` computed uses `JSON.stringify(currentMeta) !== JSON.stringify(origMeta)`. Array order matters in JSON serialization. If `tags` is `['a', 'b']` originally and the user removes 'a' then re-adds 'a', the array becomes `['b', 'a']`, which is a different JSON string — `isDirty` returns `true` even though the semantic content is the same. This is a minor accuracy issue but not critical given the mock context.

- **`totalLines: 0` on initial load**: The default `cursorPosition` signal has `totalLines: 0`. `selectAgent()` correctly sets `totalLines: agent.content.split('\n').length`. However, this assignment happens synchronously while `EditorPanelComponent` initializes the textarea asynchronously in `ngAfterViewInit`. There is a one-frame window at startup where the status bar shows "0 lines" even if an agent is pre-selected.

### 4. What happens when dependencies fail?

| Dependency | Failure Scenario | Current Handling | Assessment |
|---|---|---|---|
| `MockDataService.getAgentEditorList()` returns `[]` | Constructor `if (list.length > 0)` skips `selectAgent()` — `selectedAgent` remains `null` | No error surface | Status bar renders with `null` agent, buttons are shown with `?? 1` fallback. Save buttons are clickable and call `saveDraft()`/`saveVersion()` which early-return silently. UI looks functional but is not. |
| `MockDataService.getAgentEditorData(id)` returns `undefined` | `selectAgent()` returns early, old state is not cleared | Silent no-op | Previous agent's data remains displayed. No error. |
| `marked.parse()` throws on malformed content | `try/catch` in `renderMarkdown` falls back to raw content | Acceptable for preview | Fallback is the raw markdown string bound to `[innerHTML]`. If the raw content contains `<script>` tags, DOMPurify is bypassed (the catch returns raw `content`, not sanitized content). |
| `DOMPurify.sanitize()` unavailable | No import guard | Not handled | If DOMPurify fails to load, the catch block would return unsanitized HTML. Low probability but unguarded. |

### 5. What's missing that the requirements didn't mention?

1. **Dirty state warning on agent switch** — Users will lose work silently. The requirement covers `isDirty` display but not preventing data loss on navigation.
2. **Nav item interactivity** — The sidebar nav (Skills, Commands, Prompts, Workflows) has no click handler. This is incomplete UI.
3. **Keyboard shortcut for Save** — Professional editors always support Cmd+S / Ctrl+S. Not mentioned in requirements, not implemented.
4. **Version number increment in Save button** — The button label should say `v(N+1)`, not `vN`.
5. **No "new agent" flow** — The task requirements mention "new item (itemId = 'new')" behavior. The store has no concept of a "new" vs "existing" agent. The `selectedAgent` signal is always populated from mock data. The requirement's acceptance criteria for hiding sections for new items is not testable with this implementation.

---

## Failure Mode Analysis

### Failure Mode 1: Silent Data Loss on Agent Switch

- **Trigger**: User edits content, then clicks a different agent in the sidebar list.
- **Symptoms**: All edits disappear instantly. No warning, no confirmation, no undo.
- **Impact**: High — User loses work. Violates basic UX contract of any editor.
- **Current Handling**: `selectAgent()` unconditionally overwrites all store state.
- **Recommendation**: Before calling `selectAgent()`, check `store.isDirty()`. If true, show a confirmation dialog or navigate with a `canDeactivate`-style guard.

### Failure Mode 2: Wrong Version Number on Save Button

- **Trigger**: Any agent with `currentVersion > 0` displayed.
- **Symptoms**: Button reads "Save as v3" when user expects to create v4. aria-label confirms the wrong version.
- **Impact**: Medium — Confusing UX. Users may hesitate to save thinking they'll overwrite.
- **Current Handling**: `store.selectedAgent()?.currentVersion ?? 1` — uses current, not next.
- **Recommendation**: Compute `(store.selectedAgent()?.currentVersion ?? 0) + 1` for the save label.

### Failure Mode 3: Code Toolbar Produces Inline Instead of Fenced Block on No Selection

- **Trigger**: User clicks Code button with no text selected.
- **Symptoms**: Inserts `` `code` `` (inline) instead of a fenced code block. Requirement AC 5 says "fenced code block for no selection."
- **Impact**: Medium — Requirement not met. Editor behaves contrary to spec.
- **Current Handling**: `selectedText.includes('\n')` — empty string never has newlines.
- **Recommendation**: The condition should be `selectedText === '' || selectedText.includes('\n')` to produce a fenced block for no-selection case.

### Failure Mode 4: Bold/Italic Cursor Does Not Land Inside Markers

- **Trigger**: User clicks Bold with no text selected.
- **Symptoms**: `**bold text**` is inserted, cursor lands after the closing `**`. User must manually navigate inside to replace placeholder.
- **Impact**: Medium — Requirement AC 1 says cursor SHALL be placed inside markers if no text selected. Not met.
- **Current Handling**: `newCursorPos: start + wrapped.length` always goes to end.
- **Recommendation**: When `selectedText === ''`, set `newCursorPos` to `start + 2` (after opening `**`) so cursor lands inside for bold, `start + 1` for italic.

### Failure Mode 5: Heading Logic Skips Lines Starting With `#`

- **Trigger**: User places cursor on a line already starting with `#` (e.g., `# Title`) and clicks Heading.
- **Symptoms**: Nothing happens. The line is not changed. User sees no feedback.
- **Impact**: Low-Medium — Confusing behavior. Could also misfire on shebang lines or CSS color refs.
- **Current Handling**: Early return when `lineText.startsWith('#')`.
- **Recommendation**: Remove the early-return guard or cycle through heading levels (H1 -> H2 -> H3) to provide progressive behavior.

### Failure Mode 6: List Insertion Adds Newline Unconditionally

- **Trigger**: User places cursor at start of an empty line and clicks List.
- **Symptoms**: Produces an extra blank line before `- list item`. Requirement says insert `- ` at line start, not prepend `\n-`.
- **Impact**: Low — Minor formatting issue but deviates from spec.
- **Current Handling**: `\n- ${selectedText || 'list item'}` always prepends newline.
- **Recommendation**: Detect if cursor is at a line start and omit the leading `\n` if the preceding character is already a newline or cursor is at position 0.

### Failure Mode 7: `marked.parse()` Catch Block Returns Unsanitized Content

- **Trigger**: `marked.parse()` throws on malformed markdown input.
- **Symptoms**: `catch` block returns raw `content` string, bound via `[innerHTML]` without DOMPurify.
- **Impact**: Potentially Critical in production (XSS). Low probability in current mock context.
- **Current Handling**: `return content` in catch (line 129 of `editor-panel.component.ts`).
- **Recommendation**: Change catch to `return DOMPurify.sanitize(content)` to always sanitize before binding to `innerHTML`.

### Failure Mode 8: `totalLines: 0` Flash on Initial Load

- **Trigger**: Application startup with a pre-selected agent.
- **Symptoms**: Status bar briefly shows "0 lines" before the user interacts with the textarea.
- **Impact**: Low — Visual glitch. The status bar cursor section is inaccurate on load.
- **Current Handling**: `cursorPosition` default has `totalLines: 0`. `selectAgent()` sets correct value but `EditorPanelComponent.ngAfterViewInit` only calls `schedulePreviewUpdate`, not `updateCursorFromTextarea`.
- **Recommendation**: Call `store.setCursorPosition` from `ngAfterViewInit` after reading the textarea's initial line count.

### Failure Mode 9: Sidebar Space Key Causes Page Scroll

- **Trigger**: User navigates agent list by keyboard and presses Space to select.
- **Symptoms**: Agent is selected AND page scrolls down unexpectedly.
- **Impact**: Low — Accessibility regression. Keyboard users experience disorienting scroll.
- **Current Handling**: `(keydown.space)="selectAgent(agent.id)"` — no `$event.preventDefault()`.
- **Recommendation**: Pass `$event` to handler and call `event.preventDefault()` before selecting.

---

## Critical Issues

### Critical Issue 1: XSS Vector — Unsanitized Fallback in `renderMarkdown`

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.ts:129`
- **Scenario**: `marked.parse()` throws on pathological markdown input (deeply nested structures, very large files, certain Unicode edge cases).
- **Impact**: Raw user-controlled content bound directly to `[innerHTML]` without DOMPurify. In a dashboard context this is a stored XSS risk.
- **Evidence**:
  ```typescript
  // Line 124-131
  private renderMarkdown(content: string): string {
    try {
      const raw = marked.parse(content) as string;
      return DOMPurify.sanitize(raw);
    } catch {
      return content; // <-- Raw content, NOT sanitized
    }
  }
  ```
- **Fix**: Replace `return content` with `return DOMPurify.sanitize(content)`.

### Critical Issue 2: Silent Data Loss — No Dirty Guard on Agent Switch

- **File**: `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.ts:52`, `apps/dashboard/src/app/views/agent-editor/agent-editor.store.ts:96`
- **Scenario**: User spends 10 minutes editing an agent's content and metadata. Without saving, they click a different agent. All changes are destroyed without warning.
- **Impact**: User data loss. Violates the fundamental contract of any editor that tracks `isDirty`.
- **Evidence**: `store.isDirty` is computed and displayed in the status bar, but `selectAgent()` in the store overwrites all mutable state unconditionally. There is no checkpoint.
- **Fix**: Before calling `this.store.selectAgent(id)` in `AgentListSidebarComponent.selectAgent()`, check `this.store.isDirty()`. If true, either block the switch with a modal confirmation or auto-save the draft first.

---

## Serious Issues

### Serious Issue 1: Wrong Version Number on Save Button

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-status-bar/editor-status-bar.component.html:47-50`
- **Scenario**: Agent at version 3. Button reads "Save as v3". Should read "Save as v4".
- **Impact**: The aria-label and visible label both show the wrong number. User may double-click thinking nothing happened.
- **Fix**: Compute `nextVersion` as `(store.selectedAgent()?.currentVersion ?? 0) + 1` and bind to that.

### Serious Issue 2: Code Toolbar Produces Inline Code for No-Selection (Requirement Violation)

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-panel/markdown-insert.utils.ts:41-44`
- **Scenario**: User clicks Code button with nothing selected.
- **Impact**: Requirement AC 5 explicitly states "fenced code block for no selection". Implementation produces inline backticks instead.
- **Fix**: Change condition to `selectedText === '' || selectedText.includes('\n')`.

### Serious Issue 3: Bold/Italic Cursor Position Violates Requirement AC 1 and 2

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-panel/markdown-insert.utils.ts:20-26`
- **Scenario**: User clicks Bold with no text selected. Cursor ends up after `**bold text**` instead of inside `**...**`.
- **Impact**: Requirement AC 1 and 2 explicitly state cursor SHALL be inside markers. Acceptance criterion not met.
- **Fix**: When `selectedText === ''`, set `newCursorPos` to `start + marker.length` (e.g., `start + 2` for bold) to land inside the opening marker.

### Serious Issue 4: Sidebar Nav Items Have No Click Handler

- **File**: `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.html:6-15`
- **Scenario**: User clicks "Skills", "Commands", "Prompts", or "Workflows".
- **Impact**: No navigation occurs. Items appear interactive (cursor: pointer implied) but do nothing. Dead UI. Requirement scope doesn't mention these are intentionally inert — they should either navigate or be styled as non-interactive.
- **Fix**: Either add `(click)` handlers (even if they just show a "not yet implemented" toast) or remove pointer cursor styling and add `disabled` state.

---

## Moderate Issues

### Moderate Issue 1: `totalLines` Shows 0 Until First Textarea Interaction

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-panel/editor-panel.component.ts:34-36`
- **Scenario**: Page loads with a pre-selected agent. Status bar shows "0 lines".
- **Impact**: Minor visual inaccuracy. The `cursorPosition` default in the store has `totalLines: 0` and `ngAfterViewInit` doesn't read textarea to initialize it.
- **Fix**: In `ngAfterViewInit`, after `schedulePreviewUpdate`, read the textarea and call `updateCursorFromTextarea`.

### Moderate Issue 2: Space Key Scrolls Page on Agent List Keyboard Navigation

- **File**: `apps/dashboard/src/app/views/agent-editor/agent-list-sidebar/agent-list-sidebar.component.html:29`
- **Scenario**: Keyboard user navigates list, presses Space to select.
- **Impact**: Page scrolls and agent is selected simultaneously — disorienting.
- **Fix**: Pass `$event` and call `$event.preventDefault()` in the space keydown handler.

### Moderate Issue 3: Heading Toolbar Skips Lines Starting With `#`

- **File**: `apps/dashboard/src/app/views/agent-editor/editor-panel/markdown-insert.utils.ts:32`
- **Scenario**: User places cursor on `# Existing Heading` and clicks Heading button.
- **Impact**: Nothing happens. No feedback. Spec says "insert `## ` at the beginning of the current line" unconditionally.
- **Fix**: Remove the `lineText.startsWith('#')` early return, or cycle heading levels progressively.

---

## Edge Case Analysis

| Edge Case | Handled | How | Concern |
|---|---|---|---|
| Empty agent list | YES (partial) | Constructor guards with `length > 0` | Status bar still renders "0 lines", buttons present but no-op with no feedback |
| Null `selectedAgent` | YES (partial) | `?.` optional chaining in templates | Save buttons still render and are clickable |
| Agent not found by ID | YES (partial) | Early return in `selectAgent()` | Stale previous agent data remains displayed |
| No text selected on Bold | YES (partial) | Placeholder inserted | Cursor position does NOT land inside markers (requirement violation) |
| No text selected on Code | NO | Inline code inserted | Requirement specifies fenced code block |
| Cursor on line starting with `#` | NO | Nothing happens | Heading button has no effect, no feedback |
| Rapid agent switching | NO | No guard | Fast clicking switches agents, each triggering `selectAgent()` and full state replacement |
| Agent switch while dirty | NO | No guard | Silent data loss |
| Large content (>10k lines) | NO | Textarea renders all at once | No virtualization — potential performance issue at scale |
| Component destroyed with pending debounce | YES | `ngOnDestroy` clears timer | Correct |

---

## Data Flow Analysis

```
User clicks agent in sidebar
  -> AgentListSidebarComponent.selectAgent(id)
  -> AgentEditorStore.selectAgent(id)
  -> MockDataService.getAgentEditorData(id)   [returns undefined if not found: SILENT NO-OP]
  -> Signals updated: selectedAgent, editorContent, originalContent, metadata, originalMetadata, cursorPosition
  -> EditorPanelComponent reads store.editorContent() via [value] binding on textarea
     -> textarea DOM is NOT automatically synchronized (OnPush)
     -> ngAfterViewInit already ran: no re-sync hook fires
     -> ISSUE: textarea [value] binding in Angular does NOT re-sync DOM value for @if-toggled elements
        when the component is recreated on agent switch (if @if is used)
  -> schedulePreviewUpdate runs in ngAfterViewInit (one-time, not reactive to content signal changes)
     -> ISSUE: preview does NOT update when selectedAgent changes after initial load
        unless the textarea triggers an input event
  -> isDirty: computed from editorContent() and metadata() signals -> correct reactive update

User types in textarea
  -> (input) event -> onContentInput()
  -> store.updateContent(content)
  -> schedulePreviewUpdate(content) [300ms debounce]
  -> updateCursorFromTextarea() -> store.setCursorPosition()
  -> isDirty recomputes via computed() -> status bar updates

User clicks toolbar button (e.g., Bold)
  -> insertMarkdown('bold')
  -> reads textarea.selectionStart / selectionEnd
  -> buildInsertedContent() -> InsertResult
  -> store.updateContent(newContent)
  -> schedulePreviewUpdate()
  -> requestAnimationFrame: textarea.value = newContent, cursor set, focus(), updateCursorFromTextarea()
  -> ISSUE: textarea.value is set directly in rAF callback but store already has newContent
     If change detection runs before rAF, textarea may briefly show old content (OnPush + async)

Gap Points:
1. Preview is initialized once in ngAfterViewInit but NOT re-triggered when selectedAgent changes
2. Fallback in renderMarkdown() catch block returns unsanitized HTML
3. totalLines in status bar is 0 until first user interaction
4. No dirty-guard before agent switch
```

---

## Integration Risk Assessment

| Integration | Failure Probability | Impact | Current Mitigation |
|---|---|---|---|
| MockDataService.getAgentEditorList() returns [] | LOW | MED | Constructor guard, no UI feedback |
| MockDataService.getAgentEditorData() returns undefined | LOW | MED | Early return, stale state displayed |
| marked.parse() throws | LOW | HIGH (XSS) | Catch returns unsanitized content — UNMITIGATED |
| DOMPurify unavailable | VERY LOW | HIGH | No guard |
| textarea DOM desync after agent switch | MED | MED | Angular [value] binding handles re-render but @if teardown/recreate may reset scroll position |

---

## Verdict

**Recommendation**: NEEDS_FIXES

**Confidence**: HIGH

**Top Risk**: The `renderMarkdown` catch block returning raw unsanitized content bound to `[innerHTML]` is a real XSS vector even in the current dashboard context. It must be fixed before this code pattern propagates to production. All other issues are correctness/UX bugs.

**Fixes Required Before Approval**:
1. (Critical) Sanitize catch fallback in `renderMarkdown`
2. (Critical) Add dirty-state guard before agent switch
3. (Serious) Fix "Save as vN" to show `currentVersion + 1`
4. (Serious) Fix Code toolbar to produce fenced block on no-selection
5. (Serious) Fix Bold/Italic cursor to land inside markers on no-selection

**Deferred (Can Follow-up)**:
- Heading toolbar cycling behavior
- List toolbar line-start detection
- `totalLines` initialization
- Space key scroll prevention
- Sidebar nav item interactivity
