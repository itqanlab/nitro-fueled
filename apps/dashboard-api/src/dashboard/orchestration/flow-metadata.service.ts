import { Injectable, Logger } from '@nestjs/common';
import { FlowWithMetadata, FlowMetrics } from './types';

/**
 * Service for querying flow metadata from the task tracking database
 */
@Injectable()
export class FlowMetadataService {
  private readonly logger = new Logger(FlowMetadataService.name);

  constructor() {}

  /**
   * Get flow metadata including execution statistics
   */
  async getFlowWithMetadata(flowId: string): Promise<FlowWithMetadata | null> {
    try {
      // TODO: Implement actual database query when task tracking DB is available
      // For now, return mock data
      const mockMetadata: FlowWithMetadata = {
        id: flowId,
        name: this.getFlowNameFromId(flowId),
        type: this.getFlowTypeFromId(flowId),
        description: `Flow for ${this.getFlowTypeFromId(flowId).toLowerCase()} tasks`,
        priority: 'medium',
        phases: [],
        triggerKeywords: [],
        estimatedTotalDuration: 0,
        supportsCustomVariants: true,
        executionCount: Math.floor(Math.random() * 100) + 1,
        successRate: Math.random() * 0.4 + 0.6, // 60-100% success rate
        averageExecutionTime: Math.random() * 20 + 5, // 5-25 hours
        lastExecution: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last week
        activeInstances: Math.floor(Math.random() * 5)
      };

      this.logger.debug(`Retrieved metadata for flow ${flowId}`);
      return mockMetadata;
    } catch (error) {
      this.logger.error(`Failed to get flow metadata for ${flowId}`, error);
      throw new Error(`Failed to get flow metadata: ${error.message}`);
    }
  }

  /**
   * Get metadata for multiple flows
   */
  async getFlowsWithMetadata(flowIds: string[]): Promise<FlowWithMetadata[]> {
    try {
      const metadataPromises = flowIds.map(id => this.getFlowWithMetadata(id));
      const flows = await Promise.all(metadataPromises);
      
      // Filter out null results
      const validFlows = flows.filter(flow => flow !== null) as FlowWithMetadata[];
      
      this.logger.debug(`Retrieved metadata for ${validFlows.length} flows`);
      return validFlows;
    } catch (error) {
      this.logger.error('Failed to get flows metadata', error);
      throw new Error(`Failed to get flows metadata: ${error.message}`);
    }
  }

  /**
   * Get overall flow metrics
   */
  async getFlowMetrics(): Promise<FlowMetrics> {
    try {
      // TODO: Implement actual database query when task tracking DB is available
      // For now, return mock data
      const mockMetrics: FlowMetrics = {
        totalExecuted: 1247,
        totalSuccessful: 1123,
        averageSuccessRate: 0.901,
        mostUsedFlowType: 'FEATURE',
        executionTrends: this.generateMockTrends()
      };

      this.logger.debug('Retrieved flow metrics');
      return mockMetrics;
    } catch (error) {
      this.logger.error('Failed to get flow metrics', error);
      throw new Error(`Failed to get flow metrics: ${error.message}`);
    }
  }

  /**
   * Update flow execution statistics
   */
  async updateFlowStats(flowId: string, execution: {
    success: boolean;
    duration: number;
    timestamp: Date;
  }): Promise<void> {
    try {
      // TODO: Implement actual database update when task tracking DB is available
      this.logger.log(`Updating stats for flow ${flowId}: ${execution.success ? 'SUCCESS' : 'FAILED'} (${execution.duration}h)`);
      
      // Mock implementation - in reality this would update database records
      this.logger.debug(`[MOCK] Updated flow ${flowId} stats: ${JSON.stringify(execution)}`);
    } catch (error) {
      this.logger.error(`Failed to update flow stats for ${flowId}`, error);
      throw new Error(`Failed to update flow stats: ${error.message}`);
    }
  }

  /**
   * Get most popular flows by execution count
   */
  async getPopularFlows(limit: number = 10): Promise<FlowWithMetadata[]> {
    try {
      // TODO: Implement actual database query when task tracking DB is available
      // For now, return mock popular flows
      const flowTypes = ['FEATURE', 'BUGFIX', 'REFACTORING', 'DOCUMENTATION', 'RESEARCH'];
      const popularFlows: FlowWithMetadata[] = flowTypes.map((type, index) => ({
        id: `flow-${type.toLowerCase()}`,
        name: this.getFlowNameFromId(`flow-${type.toLowerCase()}`),
        type: type as any,
        description: `Flow for ${type.toLowerCase()} tasks`,
        priority: this.getFlowPriority(type),
        phases: [],
        triggerKeywords: [],
        estimatedTotalDuration: 0,
        supportsCustomVariants: true,
        executionCount: 100 - (index * 15), // Decreasing popularity
        successRate: 0.85 + (Math.random() * 0.1),
        averageExecutionTime: 8 + (Math.random() * 12),
        lastExecution: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000),
        activeInstances: Math.floor(Math.random() * 3) + 1
      }));

      this.logger.debug(`Retrieved ${popularFlows.length} popular flows`);
      return popularFlows.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get popular flows', error);
      throw new Error(`Failed to get popular flows: ${error.message}`);
    }
  }

  /**
   * Get flow performance trends
   */
  async getFlowPerformanceTrends(flowId: string, days: number = 30): Promise<{
    date: string;
    executionCount: number;
    successRate: number;
    averageDuration: number;
  }[]> {
    try {
      // TODO: Implement actual database query when task tracking DB is available
      // For now, return mock trend data
      const trends = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        trends.push({
          date: date.toISOString().split('T')[0],
          executionCount: Math.floor(Math.random() * 10) + 1,
          successRate: Math.random() * 0.3 + 0.7,
          averageDuration: Math.random() * 10 + 5
        });
      }

      this.logger.debug(`Retrieved performance trends for flow ${flowId} (${days} days)`);
      return trends;
    } catch (error) {
      this.logger.error(`Failed to get flow performance trends for ${flowId}`, error);
      throw new Error(`Failed to get flow performance trends: ${error.message}`);
    }
  }

  /**
   * Get flow health summary
   */
  async getFlowHealthSummary(): Promise<{
    totalFlows: number;
    activeFlows: number;
    healthyFlows: number; // success rate > 80%
    warningFlows: number; // success rate 60-80%
    criticalFlows: number; // success rate < 60%
    averageSuccessRate: number;
  }> {
    try {
      // TODO: Implement actual database query when task tracking DB is available
      // For now, return mock health summary
      const healthSummary = {
        totalFlows: 11, // Built-in flows
        activeFlows: 8,
        healthyFlows: 7,
        warningFlows: 3,
        criticalFlows: 1,
        averageSuccessRate: 0.85
      };

      this.logger.debug('Retrieved flow health summary');
      return healthSummary;
    } catch (error) {
      this.logger.error('Failed to get flow health summary', error);
      throw new Error(`Failed to get flow health summary: ${error.message}`);
    }
  }

  /**
   * Helper method to get flow name from ID
   */
  private getFlowNameFromId(flowId: string): string {
    const type = flowId.replace('flow-', '').toUpperCase();
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
    return names[type] || 'Unknown Flow';
  }

  /**
   * Helper method to get flow type from ID
   */
  private getFlowTypeFromId(flowId: string): any {
    const type = flowId.replace('flow-', '').toUpperCase();
    const validTypes = ['FEATURE', 'BUGFIX', 'REFACTORING', 'DOCUMENTATION', 'RESEARCH', 
                       'DEVOPS', 'OPS', 'CREATIVE', 'CONTENT', 'SOCIAL', 'DESIGN'];
    return validTypes.includes(type) ? type : 'FEATURE';
  }

  /**
   * Helper method to get flow priority
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
   * Generate mock trend data
   */
  private generateMockTrends(): { date: string; count: number; success: number }[] {
    const trends = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      trends.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50) + 10,
        success: Math.floor(Math.random() * 45) + 5
      });
    }
    
    return trends;
  }
}