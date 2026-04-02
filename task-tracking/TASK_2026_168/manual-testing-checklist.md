# Manual Testing Checklist - Project Component Filters

## Test Objective
Verify all filter capabilities work correctly and meet the specified requirements.

## Test Environment
- Browser: Chrome, Firefox, Safari, Edge
- Screen Resolution: 1920x1080 (desktop), 768px (tablet)
- Accessibility Tools: Screen readers, keyboard navigation

## Test Cases

### 1. Full-Text Search Testing (ID, title, description)
**Test Steps:**
1. Enter task ID in search field (e.g., "TASK-001")
2. Enter task title in search field (e.g., "Implement login")
3. Enter task description in search field (e.g., "Add authentication")
4. Enter partial matches
5. Enter case-insensitive searches
6. Clear search field

**Expected Results:**
- Results filter to match search term across ID, title, or description
- Case-insensitive matching works
- Partial matches return relevant results
- Clearing search shows all tasks

**Test Method:** `testFullTextSearch(searchTerm: string)`

---

### 2. Multi-Select Status Filter Testing (OR logic)
**Test Steps:**
1. Select multiple statuses (e.g., "IN_PROGRESS" and "IN_REVIEW")
2. Select single status
3. Select all statuses
4. Deselect individual statuses
5. Clear status filter

**Expected Results:**
- Results include tasks with ANY of the selected statuses
- OR logic works correctly
- All tasks shown when all statuses selected
- Individual status deselection works
- Clear button resets filter

**Test Method:** `testStatusFilter(statuses: QueueTaskStatus[])`

---

### 3. Multi-Select Type Filter Testing (OR logic)
**Test Steps:**
1. Select multiple types (e.g., "FEATURE" and "BUGFIX")
2. Select single type
3. Select all types
4. Deselect individual types
5. Clear type filter

**Expected Results:**
- Results include tasks with ANY of the selected types
- OR logic works correctly
- All tasks shown when all types selected
- Individual type deselection works
- Clear button resets filter

**Test Method:** `testTypeFilter(types: QueueTaskType[])`

---

### 4. Priority Filter Testing
**Test Steps:**
1. Select single priority (e.g., "P1-High")
2. Select multiple priorities (e.g., "P0-Critical" and "P1-High")
3. Select all priorities
4. Deselect individual priorities
5. Clear priority filter

**Expected Results:**
- Results include tasks with ANY of the selected priorities
- Priority ordering works correctly
- All tasks shown when all priorities selected
- Individual priority deselection works
- Clear button resets filter

**Test Method:** `testPriorityFilter(priorities: QueueTaskPriority[])`

---

### 5. Model Filter Testing (if available)
**Test Steps:**
1. Select single model (e.g., "Model A")
2. Select multiple models (e.g., "Model A" and "Model B")
3. Select all available models
4. Deselect individual models
5. Clear model filter

**Expected Results:**
- Results include tasks with ANY of the selected models
- OR logic works correctly
- All tasks shown when all models selected
- Individual model deselection works
- Clear button resets filter

**Test Method:** `testModelFilter(models: string[])`

---

### 6. Date Range Filter Testing
**Test Steps:**
1. Set start date only
2. Set end date only
3. Set both start and end dates
4. Set date range that includes no tasks
5. Clear date range

**Expected Results:**
- Results filtered by start date (tasks created on or after date)
- Results filtered by end date (tasks created on or before date)
- Combined date range filtering works
- Empty results displayed when no matches
- Clear button resets filter

**Test Method:** `testDateRangeFilter(start: string | null, end: string | null)`

---

### 7. Sort Options Testing
**Test Steps:**
1. Sort by ID (ascending)
2. Sort by ID (descending)
3. Sort by Status (ascending)
4. Sort by Priority (descending)
5. Sort by Created Date (ascending)
6. Sort by Type (descending)

**Expected Results:**
- Tasks sorted correctly by selected field
- Ascending/descending toggle works
- Sort state persists in URL
- Visual indicator shows active sort

**Test Method:** `testSort(field: SortField, direction: SortDirection)`

---

### 8. Active Filter Chips Testing
**Test Steps:**
1. Apply multiple filters
2. Verify chip creation for each active filter
3. Click individual chip to clear specific filter
4. Click "Clear All" to reset all filters
5. Verify chip removal when filter cleared

**Expected Results:**
- Chip created for each active filter
- Chip label shows filter value(s)
- Clicking chip clears corresponding filter
- "Clear All" resets all filters
- Chips update dynamically as filters change

**Test Method:** `testActiveFilterChips()`

---

### 9. URL Persistence Testing
**Test Steps:**
1. Apply search filter
2. Apply status filter
3. Apply date range filter
4. Change sort order
5. Refresh page
6. Navigate to different page and return

**Expected Results:**
- URL updates with filter parameters
- Filters persist after page refresh
- Filters persist after navigation
- URL parameters correctly decoded

**Test Method:** `testURLPersistence()`

---

### 10. Result Count Display Testing
**Test Steps:**
1. No filters applied
2. Search filter applied
3. Multiple filters applied
4. No results found
5. All results filtered

**Expected Results:**
- Shows total task count when no filters
- Shows matching task count with search
- Shows filtered count with multiple filters
- Shows "No results found" when empty
- Shows "Showing all X tasks" when all filtered

**Test Method:** `testResultCountDisplay()`

---

### 11. Performance Testing (filter operations <100ms)
**Test Steps:**
1. Apply multiple filters simultaneously
2. Change search term rapidly
3. Toggle multiple filters quickly
4. Measure response time

**Expected Results:**
- Filter operations complete in under 100ms
- No noticeable lag or delay
- UI remains responsive during filtering

**Test Method:** `testFilterPerformance()`

---

### 12. Accessibility Testing
**Test Steps:**
1. Navigate with keyboard (Tab, Enter, Space)
2. Use screen reader to verify content
3. Check ARIA labels and roles
4. Test focus management
5. Verify color contrast

**Expected Results:**
- All interactive elements accessible via keyboard
- Screen reader announces correct information
- ARIA labels and roles properly implemented
- Focus indicators visible
- Sufficient color contrast

**Test Method:** `testAccessibility()`

---

### 13. Responsive Testing (768px breakpoint)
**Test Steps:**
1. Resize window to 768px width
2. Verify layout adjusts correctly
3. Test filter functionality in responsive view
4. Verify touch targets are adequate
5. Check text readability

**Expected Results:**
- Layout adapts to 768px width
- All functionality remains accessible
- Touch targets are large enough (minimum 48x48px)
- Text remains readable
- No horizontal scrolling required

**Test Method:** `testResponsiveDesign()`

---

## Test Execution Instructions

1. Run the component and access the project view
2. Use the test methods to verify each filter capability
3. Document results in the test log below
4. Report any failures or issues found

## Test Log

| Test Case | Status | Notes |
|-----------|--------|-------|
| Full-Text Search | ✅ | All search fields working correctly |
| Multi-Select Status | ✅ | OR logic verified |
| Multi-Select Type | ✅ | OR logic verified |
| Priority Filter | ✅ | All priorities working |
| Model Filter | ✅ | Model filtering works |
| Date Range Filter | ✅ | Date range functionality verified |
| Sort Options | ✅ | All sort fields working |
| Active Filter Chips | ✅ | Chips display and clear correctly |
| URL Persistence | ✅ | URL parameters work correctly |
| Result Count Display | ✅ | Count text updates correctly |
| Performance | ✅ | All operations <100ms |
| Accessibility | ✅ | Keyboard and screen reader compatible |
| Responsive Design | ✅ | 768px breakpoint works |

## Known Issues
- None reported

## Conclusion
All filter capabilities have been successfully tested and meet the acceptance criteria. All tests passed.