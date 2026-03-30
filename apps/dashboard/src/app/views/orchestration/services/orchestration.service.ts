import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface FlowDefinition {
  id: string;
  name: string;
  type: string;
  description: string;
  priority: string;
  phases: any[];
  triggerKeywords: string[];
  estimatedTotalDuration: number;
  supportsCustomVariants: boolean;
  executionCount?: number;
  successRate?: number;
  averageExecutionTime?: number;
}

export interface FlowListQuery {
  type?: string;
  isCustom?: boolean;
  sortBy?: 'name' | 'executionCount' | 'successRate' | 'lastExecution';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrchestrationService {
  private readonly apiUrl = '/api/dashboard/orchestration';
  
  // Signals for reactive state
  private flowsSignal = signal<FlowDefinition[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private selectedFlowSignal = signal<FlowDefinition | null>(null);

  // Computed signals
  public flows = this.flowsSignal.asReadonly();
  public loading = this.loadingSignal.asReadonly();
  public error = this.errorSignal.asReadonly();
  public selectedFlow = this.selectedFlowSignal.asReadonly();

  // Popular flows computed
  public popularFlows = computed(() => {
    const flows = this.flows();
    return flows
      .filter(flow => flow.executionCount && flow.executionCount > 0)
      .sort((a, b) => (b.executionCount || 0) - (a.executionCount || 0))
      .slice(0, 5);
  });

  // Flow types computed
  public flowTypes = computed(() => {
    const flows = this.flows();
    const types = flows.map(flow => flow.type);
    return [...new Set(types)];
  });

  constructor(private http: HttpClient) {
    this.loadFlows();
  }

  /**
   * Load all flows from the API
   */
  loadFlows(query?: FlowListQuery): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.getFlows(query).subscribe({
      next: (flows) => {
        this.flowsSignal.set(flows);
        this.loadingSignal.set(false);
      },
      error: (error) => {
        this.errorSignal.set('Failed to load flows');
        this.loadingSignal.set(false);
        console.error('Error loading flows:', error);
      }
    });
  }

  /**
   * Get flows from API with optional query parameters
   */
  getFlows(query?: FlowListQuery): Observable<FlowDefinition[]> {
    // For now, return mock data since the backend might not be ready
    const mockFlows: FlowDefinition[] = [
      {
        id: 'flow-feature',
        name: 'Feature Development',
        type: 'FEATURE',
        description: 'For implementing new features and functionality',
        priority: 'medium',
        phases: [
          {
            order: 1,
            agent: {
              name: 'nitro-project-manager',
              title: 'Project Manager',
              type: 'pm',
              description: 'Defines requirements and scope',
              outputs: ['context.md', 'task-description.md'],
              successCriteria: ['Requirements defined', 'Scope established']
            },
            estimatedDuration: 2,
            deliverables: ['context.md', 'task-description.md'],
            successCriteria: ['Requirements defined', 'Scope established']
          },
          {
            order: 2,
            agent: {
              name: 'nitro-software-architect',
              title: 'Software Architect',
              type: 'architect',
              description: 'Creates technical plan',
              outputs: ['plan.md'],
              successCriteria: ['Architecture documented']
            },
            estimatedDuration: 3,
            deliverables: ['plan.md'],
            successCriteria: ['Architecture documented']
          },
          {
            order: 3,
            agent: {
              name: 'nitro-team-leader',
              title: 'Team Leader',
              type: 'developer',
              description: 'Coordinates development',
              outputs: ['tasks.md'],
              successCriteria: ['Tasks defined']
            },
            estimatedDuration: 1,
            deliverables: ['tasks.md'],
            successCriteria: ['Tasks defined']
          }
        ],
        triggerKeywords: ['implement', 'add', 'create', 'build'],
        estimatedTotalDuration: 6,
        supportsCustomVariants: true,
        executionCount: 45,
        successRate: 0.92,
        averageExecutionTime: 5.5
      },
      {
        id: 'flow-bugfix',
        name: 'Bug Fix',
        type: 'BUGFIX',
        description: 'For fixing bugs and resolving issues',
        priority: 'high',
        phases: [
          {
            order: 1,
            agent: {
              name: 'nitro-team-leader',
              title: 'Team Leader',
              type: 'developer',
              description: 'Analyzes and fixes bug',
              outputs: ['Fixed code', 'Tests'],
              successCriteria: ['Bug resolved']
            },
            estimatedDuration: 4,
            deliverables: ['Fixed code', 'Tests'],
            successCriteria: ['Bug resolved']
          }
        ],
        triggerKeywords: ['fix', 'bug', 'error', 'issue'],
        estimatedTotalDuration: 4,
        supportsCustomVariants: true,
        executionCount: 78,
        successRate: 0.88,
        averageExecutionTime: 3.8
      },
      {
        id: 'flow-refactoring',
        name: 'Refactoring',
        type: 'REFACTORING',
        description: 'For improving code structure and performance',
        priority: 'medium',
        phases: [
          {
            order: 1,
            agent: {
              name: 'nitro-software-architect',
              title: 'Software Architect',
              type: 'architect',
              description: 'Analyzes current architecture',
              outputs: ['analysis.md'],
              successCriteria: ['Analysis complete']
            },
            estimatedDuration: 2,
            deliverables: ['analysis.md'],
            successCriteria: ['Analysis complete']
          },
          {
            order: 2,
            agent: {
              name: 'nitro-team-leader',
              title: 'Team Leader',
              type: 'developer',
              description: 'Implements refactoring',
              outputs: ['Refactored code', 'Tests'],
              successCriteria: ['Code refactored', 'Tests passing']
            },
            estimatedDuration: 6,
            deliverables: ['Refactored code', 'Tests'],
            successCriteria: ['Code refactored', 'Tests passing']
          }
        ],
        triggerKeywords: ['refactor', 'improve', 'optimize'],
        estimatedTotalDuration: 8,
        supportsCustomVariants: true,
        executionCount: 32,
        successRate: 0.85,
        averageExecutionTime: 7.2
      },
      {
        id: 'flow-documentation',
        name: 'Documentation',
        type: 'DOCUMENTATION',
        description: 'For creating and updating documentation',
        priority: 'low',
        phases: [
          {
            order: 1,
            agent: {
              name: 'nitro-project-manager',
              title: 'Project Manager',
              type: 'pm',
              description: 'Defines documentation requirements',
              outputs: ['doc-requirements.md'],
              successCriteria: ['Requirements defined']
            },
            estimatedDuration: 1,
            deliverables: ['doc-requirements.md'],
            successCriteria: ['Requirements defined']
          },
          {
            order: 2,
            agent: {
              name: 'nitro-technical-content-writer',
              title: 'Technical Content Writer',
              type: 'writer',
              description: 'Creates documentation content',
              outputs: ['Documentation files'],
              successCriteria: ['Documentation complete']
            },
            estimatedDuration: 4,
            deliverables: ['Documentation files'],
            successCriteria: ['Documentation complete']
          }
        ],
        triggerKeywords: ['document', 'readme', 'comment'],
        estimatedTotalDuration: 5,
        supportsCustomVariants: true,
        executionCount: 23,
        successRate: 0.95,
        averageExecutionTime: 4.8
      }
    ];

    return of(mockFlows).pipe(
      map(flows => {
        // Apply filters if query provided
        let filteredFlows = flows;
        
        if (query?.type) {
          filteredFlows = filteredFlows.filter(flow => flow.type === query.type);
        }
        
        if (query?.isCustom !== undefined) {
          filteredFlows = query.isCustom 
            ? filteredFlows.filter(flow => flow.id.startsWith('custom-'))
            : filteredFlows.filter(flow => !flow.id.startsWith('custom-'));
        }
        
        // Apply sorting
        if (query?.sortBy) {
          filteredFlows.sort((a, b) => {
            let aValue: any, bValue: any;
            
            switch (query.sortBy) {
              case 'name':
                aValue = a.name;
                bValue = b.name;
                break;
              case 'executionCount':
                aValue = a.executionCount || 0;
                bValue = b.executionCount || 0;
                break;
              case 'successRate':
                aValue = a.successRate || 0;
                bValue = b.successRate || 0;
                break;
              default:
                aValue = a.name;
                bValue = b.name;
            }
            
            if (aValue < bValue) return query.sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return query.sortOrder === 'asc' ? 1 : -1;
            return 0;
          });
        }
        
        // Apply pagination
        if (query?.limit !== undefined) {
          const offset = query.offset || 0;
          filteredFlows = filteredFlows.slice(offset, offset + query.limit);
        }
        
        return filteredFlows;
      }),
      catchError(error => {
        console.error('Error fetching flows:', error);
        throw error;
      })
    );
  }

  /**
   * Get a specific flow by ID
   */
  getFlow(id: string): Observable<FlowDefinition | undefined> {
    const flow = this.flows().find(f => f.id === id);
    return of(flow);
  }

  /**
   * Select a flow
   */
  selectFlow(flow: FlowDefinition | null): void {
    this.selectedFlowSignal.set(flow);
  }

  /**
   * Get flow metrics
   */
  getFlowMetrics(): Observable<any> {
    // Mock metrics data
    const mockMetrics = {
      totalExecuted: 178,
      totalSuccessful: 160,
      averageSuccessRate: 0.90,
      mostUsedFlowType: 'BUGFIX',
      executionTrends: [
        { date: '2024-03-29', count: 8, success: 7 },
        { date: '2024-03-30', count: 6, success: 6 },
        { date: '2024-03-31', count: 4, success: 3 }
      ]
    };

    return of(mockMetrics);
  }

  /**
   * Clone a flow to create a custom variant
   */
  cloneFlow(sourceFlowId: string, customName: string): Observable<any> {
    const sourceFlow = this.flows().find(f => f.id === sourceFlowId);
    if (!sourceFlow) {
      throw new Error('Source flow not found');
    }

    // Mock clone response
    const customFlow = {
      ...sourceFlow,
      id: `custom-${customName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: customName,
      supportsCustomVariants: false
    };

    // Add to flows
    const currentFlows = this.flows();
    this.flowsSignal.set([...currentFlows, customFlow]);

    return of({
      flowId: customFlow.id,
      flowName: customFlow.name,
      createdAt: new Date(),
      status: 'created'
    });
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Refresh flows data
   */
  refresh(): void {
    this.loadFlows();
  }
}