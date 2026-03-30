# TASK_2026_168: Enhanced Project Tasks List with Search and Filtering - Development Tasks

## Overview
This document outlines the detailed implementation tasks for enhancing the project tasks list page with comprehensive search and filtering capabilities. The tasks are organized by phase, with clear descriptions, file locations, acceptance criteria, and dependencies.

---

## Phase 1: Data Model Extensions

### Task 1.1: Add Filter-Related Type Definitions
**Description**: Extend the project queue model with filter-specific types and interfaces to support the new filtering capabilities.
**File Location**: `apps/dashboard/src/app/models/project-queue.model.ts`
**Acceptance Criteria**:
- ✅ `QueueTaskExtended` interface added with optional `description`, `created`, and `model` fields
- ✅ `SortField` enum defined with all required sorting options
- ✅ `SortConfig` interface created for sort configuration
- ✅ `FilterChips` interface defined for active filter chips
- ✅ `DateRange` interface created for date range filtering
- ✅ All types maintain backward compatibility with existing `QueueTask`
**Estimated Effort**: 0.5 days
**Dependencies**: None

---

## Phase 2: Component State and Logic

### Task 2.1: Add Filter Signals and State Management
**Description**: Implement reactive signals for all filter states and computed signals for derived states.
**File Location**: `apps/dashboard/src/app/views/project/project.component.ts`
**Acceptance Criteria**:
- ✅ `searchQuery` signal for search input
- ✅ `selectedStatuses`, `selectedTypes`, `selectedPriorities`, `selectedModels` signals for multi-select filters
- ✅ `dateRange` signal for date range filtering
- ✅ `sortConfig` signal for sorting options
- ✅ `filteredTasks` computed signal with filter and sort logic
- ✅ `resultCount` computed signal showing filtered vs total tasks
- ✅ `activeFilterChips` computed signal for active filter display
**Estimated Effort**: 1 day
**Dependencies**: Task 1.1

### Task 2.2: Implement Filter Logic Methods
**Description**: Add methods to apply filters, sort tasks, and compare task properties.
**File Location**: `apps/dashboard/src/app/views/project/project.component.ts`
**Acceptance Criteria**:
- ✅ `applyFiltersAndSort` method implementing all filter logic (search, status, type, priority, model, date range)
- ✅ `compareTasks` method for sorting by different fields
- ✅ Proper handling of optional fields (description, created, model)
- ✅ Efficient filtering operations (<100ms for 500 tasks)
- ✅ OR logic for multi-select filters
- ✅ AND logic for combined filters
**Estimated Effort**: 1 day
**Dependencies**: Task 2.1

### Task 2.3: Add Search Debounce and Input Handling
**Description**: Implement 300ms debounced search input handling.
**File Location**: `apps/dashboard/src/app/views/project/project.component.ts`
**Acceptance Criteria**:
- ✅ 300ms debounce on search input
- ✅ `searchSubject` with `debounceTime` and `distinctUntilChanged`
- ✅ `onSearchInput` method handling input events
- ✅ Proper subscription management
- ✅ Search updates reflected in URL
**Estimated Effort**: 0.5 days
**Dependencies**: Task 2.2

### Task 2.4: Implement Filter State Management Methods
**Description**: Add methods to toggle filters, clear filters, and update filter state.
**File Location**: `apps/dashboard/src/app/views/project/project.component.ts`
**Acceptance Criteria**:
- ✅ `toggleStatus`, `toggleType`, `togglePriority` methods for multi-select filters
- ✅ `setDateRange` method for date range filtering
- ✅ `setSort` method for sorting
- ✅ `clearAllFilters` method to reset all filters
- ✅ `clearSearch` and individual clear methods
- ✅ All filter changes update URL query parameters
**Estimated Effort**: 1 day
**Dependencies**: Task 2.3

### Task 2.5: Add URL Persistence Logic
**Description**: Implement URL query parameter synchronization for filter state.
**File Location**: `apps/dashboard/src/app/views/project/project.component.ts`
**Acceptance Criteria**:
- ✅ `initializeFromURL` method to restore state from URL
- ✅ `updateURL` method to sync state to URL
- ✅ Proper handling of array parameters (status, type, priority, model)
- ✅ URL persistence across navigation
- ✅ Clean URL structure with query parameters
- ✅ `replaceUrl: true` to prevent history pollution
**Estimated Effort**: 1 day
**Dependencies**: Task 2.4

---

## Phase 3: UI Implementation

### Task 3.1: Add Result Count Display
**Description**: Implement result count display showing filtered vs total tasks.
**File Location**: `apps/dashboard/src/app/views/project/project.component.html`
**Acceptance Criteria**:
- ✅ Shows "No tasks match your filters" when filtered count is 0
- ✅ Shows "Showing all X tasks" when no filters applied
- ✅ Shows "Showing X tasks matching '{query}'" with search
- ✅ Shows "Showing X of Y tasks" with filters
- ✅ Includes "Clear all filters" button when no results
- ✅ ARIA attributes for screen reader accessibility
**Estimated Effort**: 0.5 days
**Dependencies**: Task 2.5

### Task 3.2: Add Active Filter Chips UI
**Description**: Implement active filter chips display with removal functionality.
**File Location**: `apps/dashboard/src/app/views/project/project.component.html`
**Acceptance Criteria**:
- ✅ Filter chips appear for each active filter
- ✅ Clicking chip removes that specific filter
- ✅ "Clear all" button resets all filters
- ✅ No chips displayed when no filters active
- ✅ Chips show filter type and value
- ✅ ARIA attributes for accessibility
**Estimated Effort**: 0.5 days
**Dependencies**: Task 3.1

### Task 3.3: Enhance Toolbar with Search and Filters
**Description**: Replace existing toolbar with enhanced search and filter controls.
**File Location**: `apps/dashboard/src/app/views/project/project.component.html`
**Acceptance Criteria**:
- ✅ Search input with debounce and placeholder
- ✅ Status filter dropdown with multi-select
- ✅ Type filter dropdown with multi-select
- ✅ Priority filter dropdown with multi-select
- ✅ Date range filter with calendar inputs
- ✅ Sort dropdown with all sorting options
- ✅ Filter badges showing selected count
- ✅ Responsive design for mobile
**Estimated Effort**: 1 day
**Dependencies**: Task 3.2

### Task 3.4: Add Filter Styles
**Description**: Implement CSS styles for filter UI components.
**File Location**: `apps/dashboard/src/app/views/project/project.component.scss`
**Acceptance Criteria**:
- ✅ Result count display styling
- ✅ Active filter chips styling
- ✅ Filter dropdowns with hover states
- ✅ Date range input styling
- ✅ Sort dropdown styling
- ✅ Responsive design for 768px breakpoint
- ✅ Accessibility color contrast compliance
**Estimated Effort**: 1 day
**Dependencies**: Task 3.3

### Task 3.5: Add Sort Change Handler
**Description**: Implement sort change handling in component.
**File Location**: `apps/dashboard/src/app/views/project/project.component.ts`
**Acceptance Criteria**:
- ✅ `onSortChange` method handling sort dropdown changes
- ✅ Proper parsing of sort field and direction
- ✅ Sort state updates reflected in URL
- ✅ Sort configuration applied to filtered tasks
**Estimated Effort**: 0.5 days
**Dependencies**: Task 3.4

---

## Phase 4: Data Preparation

### Task 4.1: Update Mock Data with Optional Fields
**Description**: Add optional fields (description, created, model) to mock task data.
**File Location**: `apps/dashboard/src/app/services/project.constants.ts`
**Acceptance Criteria**:
- ✅ All mock tasks include `description` field
- ✅ All mock tasks include `created` date field (ISO 8601 format)
- ✅ Some tasks include `model` field for model filtering
- ✅ Data maintains existing structure and values
- ✅ No breaking changes to existing mock data
**Estimated Effort**: 0.5 days
**Dependencies**: Task 3.5

---

## Phase 5: Testing and Polish

### Task 5.1: Implement Manual Testing Checklist
**Description**: Create comprehensive manual testing checklist for all filter capabilities.
**File Location**: `apps/dashboard/src/app/views/project/project.component.ts` (test methods) and documentation
**Acceptance Criteria**:
- ✅ Full-text search testing (ID, title, description)
- ✅ Multi-select status filter testing (OR logic)
- ✅ Multi-select type filter testing (OR logic)
- ✅ Priority filter testing
- ✅ Date range filter testing
- ✅ Model filter testing (if available)
- ✅ Sort options testing
- ✅ Active filter chips testing
- ✅ URL persistence testing
- ✅ Result count display testing
- ✅ Performance testing (filter operations <100ms)
- ✅ Accessibility testing (keyboard, screen readers)
- ✅ Responsive testing (768px breakpoint)
**Estimated Effort**: 1 day
**Dependencies**: Task 4.1

### Task 5.2: Optimize Performance and Accessibility
**Description**: Refine implementation for performance and accessibility compliance.
**File Location**: Multiple files (component, HTML, SCSS)
**Acceptance Criteria**:
- ✅ Filter operations complete under 100ms for 500 tasks
- ✅ Search debounces properly (300ms)
- ✅ No visible delay on URL updates
- ✅ All controls keyboard accessible (Tab, Enter, Space, Escape)
- ✅ ARIA attributes present and correct
- ✅ Filter changes announced to screen readers
- ✅ Color independence in filter state indicators
- ✅ Responsive design works on mobile
**Estimated Effort**: 0.5 days
**Dependencies**: Task 5.1

---

## Phase 6: Backend Enhancement (Optional)

### Task 6.1: Enhance Backend API Endpoint
**Description**: Update dashboard API endpoint to support server-side filtering.
**File Location**: `apps/dashboard-api/src/dashboard/dashboard.controller.ts`
**Acceptance Criteria**:
- ✅ Add query parameters for all filter types (status, type, priority, model, date range, sort)
- ✅ Implement server-side filtering logic
- ✅ Handle array parameters for multi-select filters
- ✅ Maintain existing API contract
- ✅ Add proper Swagger/OpenAPI documentation
**Estimated Effort**: 1-2 days
**Dependencies**: Task 5.2

### Task 6.2: Update Frontend API Service
**Description**: Update API service to pass filter parameters to backend.
**File Location**: `apps/dashboard/src/app/services/api.service.ts`
**Acceptance Criteria**:
- ✅ `getCortexTasks` method accepts new filter parameters
- ✅ Proper parameter serialization for array values
- ✅ Validation of filter parameters
- ✅ Maintain existing API service structure
**Estimated Effort**: 0.5 days
**Dependencies**: Task 6.1

---

## Total Estimated Effort
- **Phase 1**: 0.5 days
- **Phase 2**: 4 days  
- **Phase 3**: 3.5 days
- **Phase 4**: 0.5 days
- **Phase 5**: 1.5 days
- **Phase 6 (Optional)**: 1.5-2.5 days

**Total**: 10-12 days (excluding optional backend)

---

## Dependencies Summary
1. Task 1.1 → Task 2.1
2. Task 2.1 → Task 2.2
3. Task 2.2 → Task 2.3
4. Task 2.3 → Task 2.4
5. Task 2.4 → Task 2.5
6. Task 2.5 → Task 3.1
7. Task 3.1 → Task 3.2
8. Task 3.2 → Task 3.3
9. Task 3.3 → Task 3.4
10. Task 3.4 → Task 3.5
11. Task 3.5 → Task 4.1
12. Task 4.1 → Task 5.1
13. Task 5.1 → Task 5.2
14. Task 5.2 → Task 6.1 (optional)
15. Task 6.1 → Task 6.2 (optional)

---

## Success Criteria
- All 10 filtering capabilities implemented as specified
- Comprehensive search functionality with 300ms debounce
- Multi-select filters with OR logic
- URL persistence for all filter states
- Result count display with clear messaging
- Performance optimized for 500+ tasks
- Accessibility compliant (WCAG 2.1 AA)
- Responsive design for mobile devices
- Optional backend filtering support (if implemented)