# Code Logic Review — TASK_2026_084

**Reviewer**: nitro-code-logic-reviewer
**Date**: 2026-03-28
**Task**: Project Onboarding view
**Verdict**: PASS

---

## Summary

The business logic implementation is complete and correct. All acceptance criteria are met. The wizard navigation, step state management, client selection, chat messaging, and folder tree rendering work as specified. No critical logic bugs found.

---

## Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| onboarding.model.ts | 52 | OK |
| onboarding.component.ts | 149 | OK |
| onboarding.component.html | 170 | OK |
| onboarding.component.scss | 477 | OK (no logic) |
| wizard/wizard-step.component.ts | 104 | OK |
| chat-panel/chat-panel.component.ts | 33 | OK |
| chat-panel/chat-panel.component.html | 43 | OK |
| chat-panel/chat-panel.component.scss | 200 | OK (no logic) |
| folder-tree/folder-tree.component.ts | 62 | OK |
| styles.scss | 70 | OK (no logic) |

---

## Acceptance Criteria Verification

| Criterion | Status | Location |
|-----------|--------|----------|
| Step indicator renders 7 steps with correct done/active/pending states | PASS | wizard-step.component.ts:95-103 |
| Step 1 renders client selector with budget progress | PASS | onboarding.component.html:17-44 |
| Step 4 renders recommendation cards with CSS spinner | PASS | onboarding.component.html:101-118, scss:364-376 |
| Step 6 renders before/after folder tree with color-coded nodes | PASS | onboarding.component.html:132-138, folder-tree.component.ts:12-27 |
| Next/Back buttons advance/retreat with correct disabled states | PASS | onboarding.component.ts:122-135 |
| Chat panel renders alternating AI/user message bubbles | PASS | chat-panel.component.html:14-27 |

---

## Issues Found

### Medium Severity

#### 1. XSS Risk with [innerHTML] Bindings (Design Concern)

**Location**:
- `chat-panel.component.html:23` — `[innerHTML]="msg.text"`
- `onboarding.component.html:115` — `[innerHTML]="rec.description"`

**Description**: Raw HTML is rendered via `[innerHTML]`. Currently safe because all data is hardcoded mock data. When integrated with API responses, this becomes an XSS vector if server responses are not sanitized.

**Current Risk**: None (mock data is controlled)
**Future Risk**: High (API integration)

**Recommendation**: When API integration is implemented, either:
- Sanitize HTML server-side before sending
- Use Angular's `DomSanitizer` to validate trusted HTML
- Replace with plain text and use template-based formatting

**Action Required**: No fix needed now. Document for API integration phase.

---

### Low Severity

#### 2. recommendationViews Not Reactive

**Location**: `onboarding.component.ts:72-78`

```typescript
public readonly recommendationViews = this.recommendations.map((r) => ({
  ...r,
  icon: r.status === 'complete' ? '...',
  ...
}));
```

**Description**: `recommendationViews` is a static `.map()` transformation, not a `computed()` signal. If `recommendations` were ever made reactive (e.g., fetched from API), the derived view would not update.

**Current Impact**: None — `recommendations` is a `readonly` constant.
**Future Impact**: When switching to API data, this must become `computed()`.

**Action Required**: None. Acceptable for current mock implementation.

---

#### 3. Chat Messages Tracked by $index

**Location**: `chat-panel.component.html:14`

```html
@for (msg of messages(); track $index)
```

**Description**: Using `$index` for tracking is fragile if messages are reordered or inserted mid-list. For an append-only chat log, this works correctly.

**Current Impact**: None — messages are only appended via `onChatMessage()`.
**Recommendation**: Consider adding a unique `id` field to `ChatMessage` interface for production.

**Action Required**: None.

---

#### 4. FolderNode Tracked by Name

**Location**: `folder-tree.component.ts:10`

```html
@for (node of nodes(); track node.name)
```

**Description**: Tracking by `node.name` assumes names are unique within the tree. In the mock data, all names are unique. For production with user-generated folder names, duplicates could cause rendering issues.

**Recommendation**: Add an `id` field to `FolderNode` for production.

**Action Required**: None for current scope.

---

#### 5. No AI Response Handling

**Location**: `onboarding.component.ts:143-148`

```typescript
public onChatMessage(text: string): void {
  this.chatMessages.update((msgs) => [
    ...msgs,
    { sender: 'user' as const, text, time: ... },
  ]);
}
```

**Description**: Only user messages are added. There's no mechanism for AI responses. This is expected for a UI-only presentation layer per task constraints.

**Current Impact**: None — this is a UI mockup.
**Future Impact**: API integration will need to handle AI responses.

**Action Required**: None.

---

### Observations (No Action Required)

1. **Step 7 labeled "Setup" vs task description "Summary"**
   Location: `onboarding.model.ts:51`
   Minor label discrepancy. Both are valid names for a final step.

2. **Client selection not persisted**
   Selection resets on page refresh. Expected for a presentation-only component.

3. **Steps 5 and 7 show placeholder content**
   Task explicitly specified "placeholder" for these steps. Implementation is correct.

---

## Logic Flow Verification

### Wizard Navigation
```
currentStep = signal(4)           // Initial state: step 4 active
isFirstStep = computed(() => ...)  // Correctly returns true when step === 1
isLastStep = computed(() => ...)   // Correctly returns true when step === 7
goNext() → updates if !isLastStep  // Correct guard
goBack() → updates if !isFirstStep // Correct guard
nextStepLabel → finds next step or "Finish" // Correct fallback
```

### Step State Computation (wizard-step.component.ts)
```
index < currentStep → state: 'done'
index === currentStep → state: 'current'
index > currentStep → state: '' (pending)
```
Logic is correct.

### Client Selection
```
onClientChange() → finds client by name → sets selectedClient signal
```
Logic is correct. Uses event.target with proper type assertion.

### Chat Message Handling
```
send() → trims input, emits if non-empty, clears input
onKeydown() → sends on Enter (not Shift+Enter)
```
Logic is correct.

---

## Verdict

**PASS** — All business logic is implemented correctly. The identified issues are design considerations for future API integration, not bugs in the current implementation.

---

## Checklist

- [x] All acceptance criteria verified
- [x] No stubs or placeholder logic in functional code
- [x] Navigation guards work correctly
- [x] Signal reactivity is correct for current use case
- [x] Component communication (input/output) is wired correctly
- [x] No dead code or unreachable branches
- [x] Error handling appropriate for presentation layer (minimal, as expected)
