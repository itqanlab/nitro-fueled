# Implementation Plan — TASK_2026_167

## Architecture Overview

This document outlines the technical implementation plan for the Orchestration Flow Visualization feature. The solution will be built as a new page in the existing dashboard application, with supporting backend API endpoints.

### System Architecture

```
Frontend (Angular Dashboard)
├── Orchestration Page Component
├── Flow Diagram Visualization (D3.js)
├── Flow List Component
├── Flow Details Panel
└── Shared Services

Backend (NestJS Dashboard API)
├── Orchestration Controller
├── Flow Parsing Service
├── Flow Metadata Service
└── Database Integration
```

## Component Architecture

### Frontend Components

#### 1. Orchestration Page (`OrchestrationComponent`)
- **Purpose**: Main container page for orchestration flows
- **Responsibilities**:
  - Layout management (sidebar + main content)
  - State coordination between child components
  - API data fetching and caching
- **Dependencies**: `ApiService`, `FlowService`

#### 2. Flow List Component (`FlowListComponent`)
- **Purpose**: Display list of all orchestration flows
- **Responsibilities**:
  - Render flow cards in a scrollable list
  - Handle flow selection
  - Show basic flow metadata
- **Data Structure**: `FlowListItem[]`
- **Events**: `flowSelected`, `cloneFlow`

#### 3. Flow Diagram Component (`FlowDiagramComponent`)
- **Purpose**: Visualize selected flow as pipeline diagram
- **Responsibilities**:
  - Render agent sequence with D3.js
  - Draw connecting arrows between phases
  - Handle phase node interactions
- **Dependencies**: `D3.js` for SVG rendering
- **Events**: `phaseClicked`, `flowHovered`

#### 4. Flow Details Component (`FlowDetailsComponent`)
- **Purpose**: Show detailed information about clicked phase
- **Responsibilities**:
  - Display agent name, description, and outputs
  - Show phase-specific metadata
  - Provide navigation to related flows
- **Data Structure**: `FlowPhaseDetails`

#### 5. Shared Components
- **`PhaseNodeComponent`**: Reusable phase node for diagrams
- **`FlowMetadataComponent`**: Display flow usage statistics
- **`CloneFlowDialogComponent`**: Modal for cloning flows

### Backend Architecture

#### 1. Orchestration Controller (`OrchestrationController`)
- **Purpose**: HTTP API endpoints for orchestration data
- **Endpoints**:
  - `GET /api/dashboard/orchestration/flows` - Get all flows
  - `GET /api/dashboard/orchestration/flows/:id` - Get specific flow
  - `POST /api/dashboard/orchestration/flows/clone` - Clone flow
- **Dependencies**: `OrchestrationService`, `FlowMetadataService`

#### 2. Flow Parsing Service (`FlowParsingService`)
- **Purpose**: Parse flow definitions from orchestration SKILL.md
- **Responsibilities**:
  - Read and parse markdown workflow tables
  - Convert to structured `FlowDefinition` objects
  - Cache parsed definitions
- **Data Source**: `.claude/skills/orchestration/SKILL.md`

#### 3. Flow Metadata Service (`FlowMetadataService`)
- **Purpose**: Provide usage statistics and execution history
- **Responsibilities**:
  - Query task tracking database for flow usage
  - Calculate success rates and execution counts
  - Aggregate data for dashboard display
- **Data Source**: Task tracking database

## Data Models

### Core Types

```typescript
// Flow Definition
interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  agents: FlowAgent[];
  taskTypes: TaskType[];
  strategy: string;
  isRequired?: boolean;
  isConditional?: boolean;
}

// Flow Agent/Phase
interface FlowAgent {
  id: string;
  name: string;
  description: string;
  outputs: string[];
  isRequired: boolean;
  conditionalBranch?: string;
}

// Flow with Metadata
interface FlowWithMetadata extends FlowDefinition {
  lastUsed?: Date;
  executionCount: number;
  successRate: number;
  averageDuration?: number;
}

// API Response
interface OrchestrationFlowsResponse {
  flows: FlowWithMetadata[];
  totalExecutions: number;
  lastUpdated: Date;
}
```

## Technical Implementation Strategy

### Phase 1: Backend Foundation

#### 1.1 Flow Parsing Service
```typescript
@Service()
export class FlowParsingService {
  private readonly SKILL_FILE_PATH = '.claude/skills/orchestration/SKILL.md';
  private cache: FlowDefinition[] | null = null;
  private lastModified: Date | null = null;

  async parseFlows(): Promise<FlowDefinition[]> {
    // Check cache first
    if (this.cache && this.isCacheValid()) {
      return this.cache;
    }

    // Read SKILL.md file
    const skillContent = await fs.readFile(this.SKILL_FILE_PATH, 'utf-8');
    
    // Extract Workflow Selection Matrix table
    const tableData = this.extractWorkflowTable(skillContent);
    
    // Parse into FlowDefinition objects
    const flows = this.parseTableToFlows(tableData);
    
    // Update cache
    this.cache = flows;
    this.lastModified = await fs.stat(this.SKILL_FILE_PATH).then(stat => stat.mtime);
    
    return flows;
  }

  private extractWorkflowTable(content: string): string[][] {
    // Parse markdown table using regex or markdown parser
    // Implementation details for table extraction
  }
}
```

#### 1.2 Orchestration Controller
```typescript
@Controller('api/dashboard/orchestration')
export class OrchestrationController {
  constructor(
    private readonly flowService: FlowParsingService,
    private readonly metadataService: FlowMetadataService,
  ) {}

  @Get('flows')
  async getFlows(): Promise<OrchestrationFlowsResponse> {
    const flows = await this.flowService.parseFlows();
    const flowsWithMetadata = await this.metadataService.enrichWithMetadata(flows);
    
    return {
      flows: flowsWithMetadata,
      totalExecutions: flowsWithMetadata.reduce((sum, flow) => sum + flow.executionCount, 0),
      lastUpdated: new Date(),
    };
  }

  @Post('flows/clone')
  @UseGuards(AuthGuard)
  async cloneFlow(@Body() request: CloneFlowRequest): Promise<CloneFlowResponse> {
    // Create custom flow stub
    const customFlow = await this.metadataService.createCustomFlowStub(request);
    
    return {
      success: true,
      customFlowId: customFlow.id,
      message: 'Flow cloned successfully',
    };
  }
}
```

### Phase 2: Frontend Implementation

#### 2.1 Flow Diagram Visualization
```typescript
@Component({
  selector: 'app-flow-diagram',
  standalone: true,
  template: `
    <svg #svgElement [attr.width]="width" [attr.height]="height">
      <!-- Render connections first (behind nodes) -->
      <g *ngFor="let connection of connections">
        <path [attr.d]="connection.path" 
              class="flow-connection"
              [class.conditional]="connection.isConditional" />
      </g>
      
      <!-- Render agent nodes -->
      <g *ngFor="let agent of flow.agents; index as i">
        <g [attr.transform]="getNodePosition(i)" 
           (click)="onAgentClick(agent)"
           (mouseenter)="onAgentHover(agent, true)"
           (mouseleave)="onAgentHover(agent, false)">
          <rect [attr.width]="nodeWidth" 
                [attr.height]="nodeHeight" 
                [attr.rx]="4"
                [class]="getNodeClass(agent)" />
          <text [attr.x]="nodeWidth / 2" 
                [attr.y]="nodeHeight / 2"
                text-anchor="middle"
                dominant-baseline="middle">
            {{ agent.name }}
          </text>
        </g>
      </g>
    </svg>
  `,
})
export class FlowDiagramComponent {
  @Input() flow: FlowDefinition;
  @Output() phaseClicked = new EventEmitter<FlowAgent>();
  
  private readonly svgElement = viewChild<ElementRef<HTMLSVGElement>>('svgElement');
  
  // D3.js rendering logic for positioning and connections
  private renderDiagram() {
    // Implementation using D3 for layout and connections
  }
}
```

#### 2.2 State Management
```typescript
@Injectable({ providedIn: 'root' })
export class OrchestrationStore {
  private readonly api = inject(ApiService);
  
  // Signals for reactive state
  readonly flows = signal<FlowWithMetadata[]>([]);
  readonly selectedFlow = signal<FlowWithMetadata | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  
  // Computed values
  readonly flowList = computed(() => this.flows());
  readonly filteredFlows = computed(() => {
    // Filter flows based on selected criteria
  });
  
  async loadFlows() {
    this.loading.set(true);
    try {
      const response = await this.api.get<OrchestrationFlowsResponse>('/api/dashboard/orchestration/flows');
      this.flows.set(response.flows);
      this.selectedFlow.set(response.flows[0] || null);
    } catch (err) {
      this.error.set('Failed to load flows');
    } finally {
      this.loading.set(false);
    }
  }
  
  async cloneFlow(sourceFlowId: string, customName: string) {
    const response = await this.api.post<CloneFlowResponse>(
      '/api/dashboard/orchestration/flows/clone',
      { sourceFlowId, customName }
    );
    
    // Refresh flows after cloning
    await this.loadFlows();
    return response;
  }
}
```

### Phase 3: Integration and Polish

#### 3.1 Routing Integration
```typescript
// app.routes.ts
const routes: Routes = [
  {
    path: 'orchestration',
    loadChildren: () => import('./orchestration/orchestration-routing.module')
      .then(m => m.OrchestrationRoutingModule),
  },
  // ... existing routes
];

// orchestration-routing.module.ts
const routes: Routes = [
  {
    path: '',
    component: OrchestrationComponent,
    title: 'Orchestration Flows',
  },
];
```

#### 3.2 Responsive Design
- **Mobile (375px)**: Stack layout, simplified diagram, horizontal scroll
- **Tablet (768px)**: Side-by-side layout, compact diagram
- **Desktop (1920px)**: Full layout with detailed diagram

#### 3.3 Accessibility
- **Keyboard Navigation**: Tab through interactive elements
- **Screen Reader**: ARIA labels and descriptions
- **Color Contrast**: Meet WCAG 2.1 AA standards
- **Focus Management**: Visible focus indicators

## Implementation Phases

### Phase 1: Backend (3 days)
1. **Flow Parsing Service**: Parse SKILL.md workflow tables
2. **Metadata Service**: Integrate with task tracking database
3. **Orchestration Controller**: Implement REST endpoints
4. **Unit Tests**: Cover all service methods

### Phase 2: Frontend Core (5 days)
1. **Data Models**: Define TypeScript interfaces
2. **Flow List Component**: Display flows in sidebar
3. **Flow Diagram Component**: D3.js visualization
4. **State Management**: NgRx Signal Store integration
5. **Unit Tests**: Component and service tests

### Phase 3: Frontend Features (4 days)
1. **Flow Details Panel**: Phase information display
2. **Clone Functionality**: Modal dialog and API integration
3. **Responsive Design**: Mobile/tablet layouts
4. **Integration Testing**: End-to-end workflows

### Phase 4: Polish (2 days)
1. **Performance Optimization**: Caching and lazy loading
2. **Accessibility**: ARIA labels and keyboard navigation
3. **Visual Design**: Theme integration and polish
4. **Documentation**: Component and API documentation

## Technology Decisions

### D3.js for Diagrams
- **Why**: Complex, interactive SVG diagrams with custom layouts
- **Alternative**: Angular-specific chart library (less flexible)
- **Risk**: Learning curve for team unfamiliar with D3.js

### NgRx Signal Store for State
- **Why**: Lightweight, reactive state management for Angular 17+
- **Alternative**: Full NgRx (overkill for this feature scope)
- **Benefit**: Simplified state without boilerplate

### Parse SKILL.md Directly
- **Why**: Single source of truth for flow definitions
- **Alternative**: Separate flow definition file (duplication risk)
- **Benefit**: Always in sync with orchestration system

## Risk Mitigation

### Risk 1: Complex Diagram Layout
- **Mitigation**: Use D3.js force-directed layout or simple horizontal/vertical grid
- **Fallback**: Simplified list-based view if diagrams are too complex

### Risk 2: SKILL.md Parsing Fragility
- **Mitigation**: Robust parsing with validation and fallback
- **Monitoring**: Log parsing errors and alert on failures

### Risk 3: Performance with Large Diagrams
- **Mitigation**: Virtualization for large agent sequences
- **Optimization**: Lazy render non-visible portions

## Success Criteria

1. **Functional**: All acceptance criteria from task description met
2. **Performance**: Page loads in <2s, interactions <300ms
3. **Quality**: 90%+ test coverage, no critical accessibility issues
4. **Maintainability**: Clean component architecture, clear separation of concerns

## Open Questions

1. **Diagram Layout**: Force-directed or structured grid layout?
2. **Database Integration**: Real-time or cached metadata?
3. **Error Display**: How to handle malformed flow definitions gracefully?
4. **Mobile Support**: Simplified diagram or alternative representation?

---
**Generated by**: nitro-software-architect
**Session**: SESSION_2026-03-30T10-04-17
**Phase**: Architecture complete