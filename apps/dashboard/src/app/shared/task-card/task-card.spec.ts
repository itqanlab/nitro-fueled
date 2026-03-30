import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskCardComponent } from './task-card.component';
import { NgClass } from '@angular/common';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';

describe('TaskCardComponent', () => {
  let component: TaskCardComponent;
  let fixture: ComponentFixture<TaskCardComponent>;

  const mockTask = {
    id: 'TASK-001',
    title: 'Implement user authentication',
    status: 'running' as const,
    type: 'FEATURE' as const,
    priority: 'high' as const,
    autoRun: true,
    agentLabel: 'Frontend Agent',
    elapsedMinutes: 15,
    cost: 2.50,
    progressPercent: 65,
    tokensUsed: '1250',
    completedAgo: '2 hours ago',
    pipeline: [
      { stage: 'PM' as const, status: 'done' as const },
      { stage: 'Arch' as const, status: 'active' as const },
      { stage: 'TL' as const, status: 'pending' as const },
      { stage: 'Dev' as const, status: 'pending' as const }
    ]
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskCardComponent, NgClass, ProgressBarComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCardComponent);
    component = fixture.componentInstance;
  });

  describe('ProgressBar Integration', () => {
    it('should display progress bar for running tasks', () => {
      component.task = { ...mockTask, status: 'running' };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar).toBeTruthy();
      expect(progressBar.getAttribute('value')).toBe('65');
      expect(progressBar.getAttribute('variant')).toBe('running');
    });

    it('should display progress bar for paused tasks', () => {
      component.task = { ...mockTask, status: 'paused' };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar).toBeTruthy();
      expect(progressBar.getAttribute('value')).toBe('65');
      expect(progressBar.getAttribute('variant')).toBe('paused');
    });

    it('should not display progress bar for completed tasks', () => {
      component.task = { ...mockTask, status: 'completed' };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar).toBeNull();
    });

    it('should show progress label for non-completed tasks', () => {
      component.task = { ...mockTask, status: 'running' };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar.getAttribute('showLabel')).toBe('true');
    });
  });

  describe('Task Status Mapping', () => {
    it('should show running status with correct styling', () => {
      component.task = { ...mockTask, status: 'running' };
      fixture.detectChanges();
      
      const statusIndicator = fixture.nativeElement.querySelector('.task-status-indicator.running');
      expect(statusIndicator).toBeTruthy();
      
      const statusIcon = statusIndicator.textContent;
      expect(statusIcon).toContain('▶'); // Play icon
    });

    it('should show paused status with correct styling', () => {
      component.task = { ...mockTask, status: 'paused' };
      fixture.detectChanges();
      
      const statusIndicator = fixture.nativeElement.querySelector('.task-status-indicator.paused');
      expect(statusIndicator).toBeTruthy();
      
      const statusIcon = statusIndicator.textContent;
      expect(statusIcon).toContain('⏸'); // Pause icon
    });

    it('should show completed status with correct styling', () => {
      component.task = { ...mockTask, status: 'completed' };
      fixture.detectChanges();
      
      const statusIndicator = fixture.nativeElement.querySelector('.task-status-indicator.completed');
      expect(statusIndicator).toBeTruthy();
      
      const statusIcon = statusIndicator.textContent;
      expect(statusIcon).toContain('✓'); // Check icon
    });

    it('should display correct priority indicators', () => {
      component.task = { ...mockTask, priority: 'high' };
      fixture.detectChanges();
      
      const priorityDot = fixture.nativeElement.querySelector('.priority-dot.high');
      expect(priorityDot).toBeTruthy();
    });

    it('should display strategy type badges', () => {
      component.task = { ...mockTask, type: 'FEATURE' };
      fixture.detectChanges();
      
      const strategyBadge = fixture.nativeElement.querySelector('.task-strategy-badge.feature');
      expect(strategyBadge).toBeTruthy();
      expect(strategyBadge.textContent).toContain('feature');
    });

    it('should show auto-run badge for running tasks with autoRun enabled', () => {
      component.task = { ...mockTask, autoRun: true };
      fixture.detectChanges();
      
      const autorunBadge = fixture.nativeElement.querySelector('.autorun-badge.on');
      expect(autorunBadge).toBeTruthy();
    });

    it('should show auto-run badge as off for running tasks with autoRun disabled', () => {
      component.task = { ...mockTask, autoRun: false };
      fixture.detectChanges();
      
      const autorunBadge = fixture.nativeElement.querySelector('.autorun-badge.off');
      expect(autorunBadge).toBeTruthy();
    });

    it('should not show auto-run badge for completed tasks', () => {
      component.task = { ...mockTask, status: 'completed', autoRun: true };
      fixture.detectChanges();
      
      const autorunBadge = fixture.nativeElement.querySelector('.autorun-badge');
      expect(autorunBadge).toBeNull();
    });

    it('should show agent label when provided', () => {
      component.task = { ...mockTask, agentLabel: 'Frontend Agent' };
      fixture.detectChanges();
      
      const agentBadge = fixture.nativeElement.querySelector('.task-agent-badge');
      expect(agentBadge).toBeTruthy();
      expect(agentBadge.textContent).toContain('Frontend Agent');
    });

    it('should not show agent label when not provided', () => {
      const taskWithoutAgent = { ...mockTask };
      (taskWithoutAgent as any).agentLabel = undefined;
      component.task = taskWithoutAgent;
      fixture.detectChanges();
      
      const agentBadge = fixture.nativeElement.querySelector('.task-agent-badge');
      expect(agentBadge).toBeNull();
    });
  });

  describe('Progress Percentage Calculation', () => {
    it('should display progress percentage correctly', () => {
      component.task = { ...mockTask, progressPercent: 75 };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar.getAttribute('value')).toBe('75');
    });

    it('should handle edge case: 0% progress', () => {
      component.task = { ...mockTask, progressPercent: 0 };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar.getAttribute('value')).toBe('0');
    });

    it('should handle edge case: 100% progress', () => {
      component.task = { ...mockTask, progressPercent: 100 };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar.getAttribute('value')).toBe('100');
    });

    it('should clamp progress percentage above 100', () => {
      component.task = { ...mockTask, progressPercent: 150 };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar.getAttribute('value')).toBe('100');
    });

    it('should clamp progress percentage below 0', () => {
      component.task = { ...mockTask, progressPercent: -10 };
      fixture.detectChanges();
      
      const progressBar = fixture.nativeElement.querySelector('app-progress-bar');
      expect(progressBar.getAttribute('value')).toBe('0');
    });
  });

  describe('Pipeline Display', () => {
    it('should show pipeline when it has stages', () => {
      component.task = { ...mockTask, pipeline: [{ stage: 'PM', status: 'done' }] };
      fixture.detectChanges();
      
      const pipeline = fixture.nativeElement.querySelector('.pipeline');
      expect(pipeline).toBeTruthy();
      expect(pipeline.textContent).toContain('PM');
    });

    it('should not show pipeline when empty', () => {
      component.task = { ...mockTask, pipeline: [] };
      fixture.detectChanges();
      
      const pipeline = fixture.nativeElement.querySelector('.pipeline');
      expect(pipeline).toBeNull();
    });

    it('should display pipeline stages with correct status styling', () => {
      component.task = mockTask;
      fixture.detectChanges();
      
      const pipelineSteps = fixture.nativeElement.querySelectorAll('.pipeline-step');
      expect(pipelineSteps.length).toBe(4);
      
      expect(pipelineSteps[0].classList.contains('done')).toBe(true);
      expect(pipelineSteps[1].classList.contains('active')).toBe(true);
      expect(pipelineSteps[2].classList.contains('pending')).toBe(true);
    });

    it('should show arrows between pipeline stages', () => {
      component.task = mockTask;
      fixture.detectChanges();
      
      const arrows = fixture.nativeElement.querySelectorAll('.pipeline-arrow');
      expect(arrows.length).toBe(3); // 4 stages = 3 arrows
    });
  });

  describe('Task Actions', () => {
    it('should show action buttons for running tasks', () => {
      component.task = { ...mockTask, status: 'running' };
      fixture.detectChanges();
      
      const pauseButton = fixture.nativeElement.querySelector('button[title="Pause"]');
      const viewButton = fixture.nativeElement.querySelector('button[title="View"]');
      
      expect(pauseButton).toBeTruthy();
      expect(viewButton).toBeTruthy();
    });

    it('should show resume button for paused tasks', () => {
      component.task = { ...mockTask, status: 'paused' };
      fixture.detectChanges();
      
      const resumeButton = fixture.nativeElement.querySelector('button[title="Resume"]');
      const viewButton = fixture.nativeElement.querySelector('button[title="View"]');
      
      expect(resumeButton).toBeTruthy();
      expect(viewButton).toBeTruthy();
    });

    it('should show only view button for completed tasks', () => {
      component.task = { ...mockTask, status: 'completed' };
      fixture.detectChanges();
      
      const viewButton = fixture.nativeElement.querySelector('button');
      expect(viewButton.textContent).toContain('View');
      
      const pauseButton = fixture.nativeElement.querySelector('button[title="Pause"]');
      expect(pauseButton).toBeNull();
    });

    it('should show correct icons for task actions', () => {
      component.task = { ...mockTask, status: 'running' };
      fixture.detectChanges();
      
      const pauseButton = fixture.nativeElement.querySelector('button[title="Pause"]');
      expect(pauseButton.textContent).toContain('⏸');
    });
  });

  describe('Task Metadata', () => {
    it('should show elapsed time for running tasks', () => {
      component.task = { ...mockTask, elapsedMinutes: 15 };
      fixture.detectChanges();
      
      const metaItem = fixture.nativeElement.querySelector('.task-meta-item');
      expect(metaItem.textContent).toContain('15 min');
    });

    it('should show tokens used for completed tasks', () => {
      component.task = { ...mockTask, status: 'completed', tokensUsed: '1250' };
      fixture.detectChanges();
      
      const metaItem = fixture.nativeElement.querySelector('.task-meta-item');
      expect(metaItem.textContent).toContain('1250 tokens');
    });

    it('should show cost information', () => {
      component.task = { ...mockTask, cost: 2.50 };
      fixture.detectChanges();
      
      const costText = fixture.nativeElement.querySelector('.cost-text');
      expect(costText.textContent).toContain('$2.50');
    });

    it('should show completion time for completed tasks', () => {
      component.task = { ...mockTask, status: 'completed', completedAgo: '2 hours ago' };
      fixture.detectChanges();
      
      const metaItem = fixture.nativeElement.querySelector('.task-meta-item');
      expect(metaItem.textContent).toContain('2 hours ago');
    });
  });

  describe('Styling and Interactions', () => {
    it('should have hover effects for task cards', () => {
      component.task = mockTask;
      fixture.detectChanges();
      
      const taskItem = fixture.nativeElement.querySelector('.task-item');
      expect(taskItem).toBeTruthy();
      
      // Test that hover styles are applied via CSS
      expect(getComputedStyle(taskItem).cursor).toBe('pointer');
    });

    it('should show correct border colors on hover', () => {
      component.task = mockTask;
      fixture.detectChanges();
      
      const taskItem = fixture.nativeElement.querySelector('.task-item');
      const originalBorderColor = getComputedStyle(taskItem).borderColor;
      
      // Simulate hover
      taskItem.dispatchEvent(new Event('mouseenter'));
      const hoverBorderColor = getComputedStyle(taskItem).borderColor;
      
      expect(hoverBorderColor).not.toBe(originalBorderColor);
    });

    it('should have proper spacing and layout', () => {
      component.task = mockTask;
      fixture.detectChanges();
      
      const taskItem = fixture.nativeElement.querySelector('.task-item');
      expect(taskItem.style.display).toBe('flex');
      expect(taskItem.style.gap).toBe('12px');
    });

    it('should truncate long titles with ellipsis', () => {
      component.task = { ...mockTask, title: 'This is a very long title that should be truncated in the UI' };
      fixture.detectChanges();
      
      const titleElement = fixture.nativeElement.querySelector('.task-title');
      expect(getComputedStyle(titleElement).whiteSpace).toBe('nowrap');
      expect(getComputedStyle(titleElement).overflow).toBe('hidden');
      expect(getComputedStyle(titleElement).textOverflow).toBe('ellipsis');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined task input safely', () => {
      // This would normally throw an error due to @Input requirement
      expect(() => {
        component.task = undefined as any;
        fixture.detectChanges();
      }).toThrow();
    });

    it('should handle task with null values gracefully', () => {
      const taskWithNulls = { ...mockTask };
      (taskWithNulls as any).agentLabel = null;
      (taskWithNulls as any).elapsedMinutes = null;
      (taskWithNulls as any).completedAgo = null;
      component.task = taskWithNulls;
      fixture.detectChanges();
      
      expect(component.task).toBeTruthy();
      const agentBadge = fixture.nativeElement.querySelector('.task-agent-badge');
      expect(agentBadge).toBeNull();
    });

    it('should handle task with missing optional properties', () => {
      const minimalTask = {
        id: 'TASK-002',
        title: 'Simple task',
        status: 'running' as const,
        type: 'FEATURE' as const,
        priority: 'medium' as const,
        autoRun: false,
        agentLabel: '',
        elapsedMinutes: 0,
        cost: 0,
        progressPercent: 25,
        tokensUsed: '0',
        completedAgo: '',
        pipeline: []
      };
      
      component.task = minimalTask;
      fixture.detectChanges();
      
      expect(component.task).toBeTruthy();
      const taskItem = fixture.nativeElement.querySelector('.task-item');
      expect(taskItem).toBeTruthy();
    });
  });
});