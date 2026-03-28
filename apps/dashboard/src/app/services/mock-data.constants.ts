import { Project } from '../models/project.model';
import { Task } from '../models/task.model';
import { Agent } from '../models/agent.model';
import { ActivityEntry } from '../models/session.model';
import { AnalyticsSummary } from '../models/analytics-summary.model';
import { StatusIndicator } from '../models/provider.model';
import { SidebarSection } from '../models/sidebar.model';

export const MOCK_PROJECTS: readonly Project[] = [
  {
    id: 'proj-001',
    name: 'e-commerce-api',
    status: 'active',
    taskCount: 2,
    client: 'Acme Corp',
    stackTags: ['Angular 19', 'NestJS 10', 'PostgreSQL', 'Nx'],
    teams: ['Engineering', 'Design'],
  },
  {
    id: 'proj-002',
    name: 'my-react-app',
    status: 'has-updates',
    taskCount: 3,
    client: 'Beta Inc',
    stackTags: ['React 18', 'Node.js', 'MongoDB'],
    teams: ['Engineering'],
  },
  {
    id: 'proj-003',
    name: 'go-microservice',
    status: 'inactive',
    taskCount: 0,
    client: 'Gamma LLC',
    stackTags: ['Go 1.22', 'gRPC', 'Redis'],
    teams: ['Engineering'],
  },
];

export const MOCK_ACTIVE_TASKS: readonly Task[] = [
  {
    id: 'TASK_048',
    title: 'Add real-time notifications system',
    status: 'running',
    type: 'FEATURE',
    priority: 'high',
    autoRun: true,
    agentLabel: 'team-leader (batch 2/3)',
    elapsedMinutes: 12,
    cost: 1.80,
    progressPercent: 60,
    tokensUsed: '32K',
    completedAgo: '',
    pipeline: [
      { stage: 'PM', status: 'done' },
      { stage: 'Arch', status: 'done' },
      { stage: 'TL', status: 'active' },
      { stage: 'Dev', status: 'pending' },
      { stage: 'QA', status: 'pending' },
    ],
  },
  {
    id: 'TASK_047',
    title: 'Fix authentication token refresh logic',
    status: 'paused',
    type: 'BUGFIX',
    priority: 'medium',
    autoRun: false,
    agentLabel: 'Paused at Checkpoint 2',
    elapsedMinutes: 5,
    cost: 0.60,
    progressPercent: 35,
    tokensUsed: '8K',
    completedAgo: '',
    pipeline: [],
  },
];

export const MOCK_COMPLETED_TASKS: readonly Task[] = [
  {
    id: 'TASK_046',
    title: 'Refactor user service to use CQRS pattern',
    status: 'completed',
    type: 'REFACTOR',
    priority: 'medium',
    autoRun: false,
    agentLabel: '',
    elapsedMinutes: 0,
    cost: 2.40,
    progressPercent: 100,
    tokensUsed: '45K',
    completedAgo: '15 min ago',
    pipeline: [],
  },
  {
    id: 'TASK_045',
    title: 'Add property search with filters',
    status: 'completed',
    type: 'FEATURE',
    priority: 'high',
    autoRun: false,
    agentLabel: '',
    elapsedMinutes: 0,
    cost: 4.10,
    progressPercent: 100,
    tokensUsed: '80K',
    completedAgo: '2 hours ago',
    pipeline: [],
  },
  {
    id: 'TASK_044',
    title: 'Generate API documentation',
    status: 'completed',
    type: 'DOCS',
    priority: 'low',
    autoRun: false,
    agentLabel: '',
    elapsedMinutes: 0,
    cost: 0.60,
    progressPercent: 100,
    tokensUsed: '12K',
    completedAgo: 'yesterday',
    pipeline: [],
  },
];

export const MOCK_AGENTS: readonly Agent[] = [
  { name: 'Team Lead', model: 'opus', team: 'Engineering', installed: true },
  { name: 'Architect', model: 'opus', team: 'Engineering', installed: true },
  { name: 'FE Dev', model: 'sonnet', team: 'Engineering', installed: true },
  { name: 'BE Dev', model: 'codex', team: 'Engineering', installed: true },
  { name: 'Tester', model: 'sonnet', team: 'Engineering', installed: true },
  { name: 'DevOps', model: 'sonnet', team: 'Engineering', installed: true },
  { name: 'UI/UX', model: 'sonnet', team: 'Design', installed: true },
  { name: 'Researcher', model: 'opus', team: 'Design', installed: true },
];

export const MOCK_ACTIVITY: readonly ActivityEntry[] = [
  { timeAgo: '2m', actorBold: 'team-leader', text: 'committed batch 2/3 for TASK_048' },
  { timeAgo: '5m', actorBold: 'code-logic-reviewer', text: 'approved batch 2' },
  { timeAgo: '8m', actorBold: 'backend-developer', text: 'completed auth middleware' },
  { timeAgo: '15m', actorBold: 'TASK_046', text: 'completed successfully' },
  { timeAgo: '1h', actorBold: 'team-leader.md', text: 'External change detected:' },
];

export const MOCK_ANALYTICS: AnalyticsSummary = {
  activeTasks: 2,
  activeBreakdown: '1 running, 1 paused',
  completedTasks: 47,
  completedPeriod: 'Last 30 days',
  budgetUsed: 47,
  budgetTotal: 100,
  budgetAlertPercent: 80,
  tokensUsed: '1.2M',
  tokensPeriod: 'This month',
  totalCost: 47.30,
  clientCost: 38.20,
  internalCost: 9.10,
};

export const MOCK_STATUS_INDICATORS: readonly StatusIndicator[] = [
  { label: 'Claude API', status: 'ok' },
  { label: 'OpenAI API', status: 'ok' },
  { label: 'Indexing', status: 'busy', progressPercent: 47 },
  { label: 'File watcher', status: 'ok' },
];

export const MOCK_SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    title: 'Projects',
    type: 'project',
    showAddButton: true,
    items: [
      { label: 'e-commerce-api', dotStatus: 'active', badge: 2, isActive: true, route: '/dashboard' },
      { label: 'my-react-app', dotStatus: 'has-updates', badge: 3, route: '/dashboard' },
      { label: 'go-microservice', dotStatus: 'inactive', route: '/dashboard' },
    ],
  },
  {
    title: 'Library',
    type: 'library',
    items: [
      { label: 'Agents', icon: '\u{1F9D1}', badge: 14, route: '/agents' },
      { label: 'Skills', icon: '\u26A1', badge: 13, route: '/agents' },
      { label: 'Commands', icon: '\u25B6', badge: 8, route: '/agents' },
      { label: 'Prompts', icon: '\u{1F4DD}', badge: 5, route: '/agents' },
      { label: 'Workflows', icon: '\u{1F504}', badge: 7, route: '/agents' },
    ],
  },
  {
    title: 'Management',
    type: 'management',
    items: [
      { label: 'Clients', icon: '\u{1F4BC}', badge: 4, route: '/dashboard' },
      { label: 'Teams', icon: '\u{1F465}', badge: 3, route: '/dashboard' },
      { label: 'Knowledge Base', icon: '\u{1F4DA}', route: '/dashboard' },
      { label: 'Analytics', icon: '\u{1F4CA}', route: '/analytics' },
      { label: 'Integrations', icon: '\u{1F517}', badge: 3, route: '/mcp' },
      { label: 'Activity Log', icon: '\u{1F4CB}', route: '/dashboard' },
    ],
  },
  {
    title: 'Providers',
    type: 'provider',
    items: [
      { label: 'Provider Hub', icon: '\u{1F916}', route: '/providers' },
    ],
  },
  {
    title: '',
    type: 'settings',
    items: [
      { label: 'Settings', icon: '\u2699', route: '/dashboard' },
    ],
  },
];
