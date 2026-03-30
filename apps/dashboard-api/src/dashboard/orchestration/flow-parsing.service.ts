import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  FlowDefinition, 
  FlowAgent, 
  FlowPhase, 
  FlowValidationError,
  FlowValidationResult 
} from './types';

/**
 * Service for parsing orchestration flow definitions from SKILL.md files
 */
@Injectable()
export class FlowParsingService {
  private readonly logger = new Logger(FlowParsingService.name);
  private readonly skillFilePath: string;
  private lastModified: number = 0;
  private cachedFlows: FlowDefinition[] = [];

  constructor() {
    this.skillFilePath = path.join(process.cwd(), '.claude/skills/orchestration/SKILL.md');
  }

  /**
   * Parse orchestration flows from SKILL.md file
   */
  async parseFlows(): Promise<FlowDefinition[]> {
    try {
      // Check if file has been modified since last parse
      const stats = await fs.stat(this.skillFilePath);
      
      if (stats.mtimeMs === this.lastModified && this.cachedFlows.length > 0) {
        this.logger.debug('Returning cached flows (file unchanged)');
        return this.cachedFlows;
      }

      this.logger.log('Parsing orchestration flows from SKILL.md');
      const content = await fs.readFile(this.skillFilePath, 'utf-8');
      const flows = this.parseFlowDefinitions(content);
      
      // Update cache
      this.lastModified = stats.mtimeMs;
      this.cachedFlows = flows;
      
      this.logger.log(`Successfully parsed ${flows.length} flow definitions`);
      return flows;
    } catch (error) {
      this.logger.error('Failed to parse flow definitions', error);
      throw new Error(`Failed to parse flow definitions: ${error.message}`);
    }
  }

  /**
   * Parse flow definitions from markdown content
   */
  private parseFlowDefinitions(content: string): FlowDefinition[] {
    const flows: FlowDefinition[] = [];
    
    // Extract workflow selection matrix
    const workflowMatrix = this.extractWorkflowMatrix(content);
    
    // Extract strategy quick reference
    const strategyMatrix = this.extractStrategyMatrix(content);
    
    // Map strategies to flow definitions
    for (const strategy of strategyMatrix) {
      const flow = this.createFlowDefinition(strategy, workflowMatrix);
      if (flow) {
        flows.push(flow);
      }
    }
    
    return flows;
  }

  /**
   * Extract workflow selection matrix from content
   */
  private extractWorkflowMatrix(content: string): Record<string, string[]> {
    const workflowMatrix: Record<string, string[]> = {};
    
    // Find the Workflow Selection Matrix section
    const matrixSection = content.match(/## Workflow Selection Matrix[\s\S]*?(?=##|$)/);
    if (!matrixSection) {
      throw new Error('Workflow Selection Matrix section not found in SKILL.md');
    }

    // Extract task type detection table
    const taskTypeTable = matrixSection[0].match(/\|[\s\S]*?\|[\s\S]*?\n/g);
    if (!taskTypeTable) {
      throw new Error('Task type detection table not found');
    }

    for (const row of taskTypeTable) {
      const columns = row.split('|').map(col => col.trim());
      if (columns.length >= 3 && columns[1].includes('Task Type')) {
        continue; // Skip header
      }
      
      if (columns.length >= 3) {
        const taskType = columns[1];
        const keywords = columns[2];
        
        if (taskType && keywords) {
          workflowMatrix[taskType] = keywords.split(',').map(k => k.trim());
        }
      }
    }

    return workflowMatrix;
  }

  /**
   * Extract strategy quick reference from content
   */
  private extractStrategyMatrix(content: string): any[] {
    const strategies: any[] = [];
    
    // Find the Strategy Quick Reference section
    const strategySection = content.match(/\| Task Type\s*\|\s*Strategy Flow\s*\|[\s\S]*?(?=\n\n|\n##|$)/);
    if (!strategySection) {
      throw new Error('Strategy Quick Reference section not found in SKILL.md');
    }

    const rows = strategySection[0].split('\n').filter(line => line.trim().startsWith('|'));
    
    for (const row of rows) {
      const columns = row.split('|').map(col => col.trim());
      if (columns.length >= 3 && !columns[1].includes('Task Type')) {
        const taskType = columns[1];
        const strategyFlow = columns[2];
        
        if (taskType && strategyFlow) {
          strategies.push({
            type: taskType,
            flow: strategyFlow
          });
        }
      }
    }

    return strategies;
  }

  /**
   * Create flow definition from strategy
   */
  private createFlowDefinition(strategy: any, workflowMatrix: Record<string, string[]>): FlowDefinition | null {
    const flowTypes = ['FEATURE', 'BUGFIX', 'REFACTORING', 'DOCUMENTATION', 'RESEARCH', 
                      'DEVOPS', 'OPS', 'CREATIVE', 'CONTENT', 'SOCIAL', 'DESIGN'];
    
    if (!flowTypes.includes(strategy.type)) {
      this.logger.warn(`Unknown flow type: ${strategy.type}`);
      return null;
    }

    const phases = this.parseAgentPhases(strategy.flow);
    const triggerKeywords = workflowMatrix[strategy.type] || [];

    return {
      id: `flow-${strategy.type.toLowerCase()}`,
      name: this.getFlowName(strategy.type),
      type: strategy.type as any,
      description: this.getFlowDescription(strategy.type),
      priority: this.getFlowPriority(strategy.type),
      phases,
      triggerKeywords,
      estimatedTotalDuration: phases.reduce((sum, phase) => sum + phase.estimatedDuration, 0),
      supportsCustomVariants: true,
      tags: [strategy.type.toLowerCase()]
    };
  }

  /**
   * Parse agent phases from strategy flow string
   */
  private parseAgentPhases(flowString: string): FlowPhase[] {
    const phases: FlowPhase[] = [];
    const agentSequence = flowString.split('->').map(agent => agent.trim());
    
    const agentDefinitions: Record<string, FlowAgent> = {
      'PM': {
        name: 'nitro-project-manager',
        title: 'Project Manager',
        type: 'pm',
        description: 'Defines requirements and scope for the task',
        outputs: ['context.md', 'task-description.md'],
        successCriteria: ['Requirements clearly defined', 'Scope boundaries established']
      },
      'Architect': {
        name: 'nitro-software-architect',
        title: 'Software Architect',
        type: 'architect',
        description: 'Creates technical plan and architecture decisions',
        outputs: ['plan.md'],
        successCriteria: ['Architecture decisions documented', 'Implementation plan approved']
      },
      'Team-Leader': {
        name: 'nitro-team-leader',
        title: 'Team Leader',
        type: 'developer',
        description: 'Coordinates development tasks and manages execution',
        outputs: ['tasks.md'],
        successCriteria: ['Development tasks defined', 'Implementation complete']
      },
      'Developer': {
        name: 'nitro-frontend-developer',
        title: 'Developer',
        type: 'developer',
        description: 'Implements the solution',
        outputs: ['Source code', 'Tests'],
        successCriteria: ['Code implemented', 'Tests passing']
      },
      'Style Reviewer': {
        name: 'nitro-code-style-reviewer',
        title: 'Style Reviewer',
        type: 'reviewer',
        description: 'Reviews code style and formatting',
        outputs: ['review-style.md'],
        successCriteria: ['Code style compliant', 'Formatting consistent']
      },
      'Test Lead': {
        name: 'nitro-senior-tester',
        title: 'Test Lead',
        type: 'tester',
        description: 'Leads testing and quality assurance',
        outputs: ['test-report.md'],
        successCriteria: ['Tests completed', 'Quality verified']
      },
      'Researcher': {
        name: 'nitro-researcher-expert',
        title: 'Researcher',
        type: 'researcher',
        description: 'Conducts research and analysis',
        outputs: ['research-report.md'],
        successCriteria: ['Research complete', 'Analysis documented']
      },
      'DevOps Engineer': {
        name: 'nitro-devops-engineer',
        title: 'DevOps Engineer',
        type: 'devops',
        description: 'Implements infrastructure and deployment',
        outputs: ['Infrastructure code', 'Deployment scripts'],
        successCriteria: ['Infrastructure deployed', 'CI/CD pipeline working']
      },
      'UI/UX Designer': {
        name: 'nitro-ui-ux-designer',
        title: 'UI/UX Designer',
        type: 'designer',
        description: 'Creates user interface and experience designs',
        outputs: ['Design mockups', 'Style guides'],
        successCriteria: ['Designs complete', 'User experience validated']
      },
      'Technical Content Writer': {
        name: 'nitro-technical-content-writer',
        title: 'Technical Content Writer',
        type: 'writer',
        description: 'Creates technical documentation and content',
        outputs: ['Documentation', 'Content'],
        successCriteria: ['Content complete', 'Documentation accurate']
      }
    };

    let order = 1;
    for (const agentName of agentSequence) {
      const agent = agentDefinitions[agentName];
      if (agent) {
        phases.push({
          order: order++,
          agent,
          estimatedDuration: this.getEstimatedDuration(agent.type),
          deliverables: [...agent.outputs],
          successCriteria: [...agent.successCriteria]
        });
      }
    }

    return phases;
  }

  /**
   * Get human-readable flow name
   */
  private getFlowName(type: string): string {
    const names: Record<string, string> = {
      'FEATURE': 'Feature Development',
      'BUGFIX': 'Bug Fix',
      'REFACTORING': 'Refactoring',
      'DOCUMENTATION': 'Documentation',
      'RESEARCH': 'Research',
      'DEVOPS': 'DevOps Infrastructure',
      'OPS': 'Operations',
      'CREATIVE': 'Creative Content',
      'CONTENT': 'Content Creation',
      'SOCIAL': 'Social Media',
      'DESIGN': 'Design'
    };
    return names[type] || type;
  }

  /**
   * Get flow description
   */
  private getFlowDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'FEATURE': 'For implementing new features and functionality',
      'BUGFIX': 'For fixing bugs and resolving issues',
      'REFACTORING': 'For improving code structure and performance',
      'DOCUMENTATION': 'For creating and updating documentation',
      'RESEARCH': 'For conducting research and analysis',
      'DEVOPS': 'For infrastructure and DevOps implementation',
      'OPS': 'For operational tasks and deployment',
      'CREATIVE': 'For creative content and design work',
      'CONTENT': 'For content creation and writing',
      'SOCIAL': 'For social media and communication',
      'DESIGN': 'For UI/UX design and visual work'
    };
    return descriptions[type] || `Flow for ${type.toLowerCase()} tasks`;
  }

  /**
   * Get flow priority
   */
  private getFlowPriority(type: string): 'low' | 'medium' | 'high' | 'critical' {
    const priorities: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'FEATURE': 'medium',
      'BUGFIX': 'high',
      'REFACTORING': 'medium',
      'DOCUMENTATION': 'low',
      'RESEARCH': 'medium',
      'DEVOPS': 'high',
      'OPS': 'critical',
      'CREATIVE': 'low',
      'CONTENT': 'low',
      'SOCIAL': 'low',
      'DESIGN': 'medium'
    };
    return priorities[type] || 'medium';
  }

  /**
   * Get estimated duration for agent type
   */
  private getEstimatedDuration(agentType: string): number {
    const durations: Record<string, number> = {
      'pm': 2,
      'architect': 3,
      'developer': 8,
      'reviewer': 1,
      'tester': 2,
      'designer': 4,
      'writer': 3,
      'researcher': 4,
      'devops': 4
    };
    return durations[agentType] || 2;
  }

  /**
   * Validate flow definition
   */
  validateFlow(flow: FlowDefinition): FlowValidationResult {
    const errors: FlowValidationError[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!flow.id || flow.id.trim() === '') {
      errors.push({
        field: 'id',
        message: 'Flow ID is required',
        rule: 'required'
      });
    }

    if (!flow.name || flow.name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Flow name is required',
        rule: 'required'
      });
    }

    if (!flow.type || !['FEATURE', 'BUGFIX', 'REFACTORING', 'DOCUMENTATION', 'RESEARCH', 
                       'DEVOPS', 'OPS', 'CREATIVE', 'CONTENT', 'SOCIAL', 'DESIGN'].includes(flow.type)) {
      errors.push({
        field: 'type',
        message: 'Valid flow type is required',
        rule: 'enum'
      });
    }

    if (!flow.phases || flow.phases.length === 0) {
      errors.push({
        field: 'phases',
        message: 'At least one phase is required',
        rule: 'minItems'
      });
    }

    // Validate phases
    if (flow.phases) {
      let order = 1;
      for (const phase of flow.phases) {
        if (phase.order !== order++) {
          warnings.push(`Phase order should be sequential (expected ${order - 1}, got ${phase.order})`);
        }

        if (!phase.agent || !phase.agent.name) {
          errors.push({
            field: `phases[${phase.order}].agent.name`,
            message: 'Agent name is required',
            rule: 'required'
          });
        }

        if (phase.estimatedDuration <= 0) {
          errors.push({
            field: `phases[${phase.order}].estimatedDuration`,
            message: 'Estimated duration must be positive',
            rule: 'positive'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}