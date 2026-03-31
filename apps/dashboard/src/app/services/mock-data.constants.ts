import { AgentEditorData } from '../models/agent-editor.model';
import { Project } from '../models/project.model';
import { AnalyticsData } from '../models/analytics.model';
import { Task } from '../models/task.model';
import { Agent } from '../models/agent.model';
import { ActivityEntry } from '../models/session.model';
import { AnalyticsSummary } from '../models/analytics-summary.model';
import { StatusIndicator } from '../models/provider.model';
import { SidebarSection } from '../models/sidebar.model';
import { McpServer, McpToolAccessRow, McpIntegration } from '../models/mcp.model';
import {
  CommandCenterData,
  TaskStatusBreakdown,
  TokenCostSummary,
  ActiveSession,
  ActiveTask,
} from '../models/dashboard.model';

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
      { label: 'Orchestration', icon: '\u{1F517}', badge: 11, route: '/orchestration' },
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
      { label: 'Progress Center', icon: '\u{1F6F0}', route: '/progress' },
      { label: 'Sessions', icon: '\u{1F4C5}', route: '/sessions' },
      { label: 'Reports', icon: '\u{1F4C8}', route: '/reports' },
      { label: 'Logs', icon: '\u{1F4DC}', route: '/logs' },
      { label: 'Integrations', icon: '\u{1F517}', badge: 3, route: '/mcp' },
      { label: 'Activity Log', icon: '\u{1F4CB}', route: '/dashboard' },
    ],
  },
  {
    title: 'Telemetry',
    type: 'management',
    items: [
      { label: 'Model Performance', icon: '\u{1F4CA}', route: '/telemetry/model-performance' },
      { label: 'Phase Timing',      icon: '\u23F1',    route: '/telemetry/phase-timing' },
      { label: 'Session Comparison',icon: '\u21C4',    route: '/telemetry/session-comparison' },
      { label: 'Task Trace',        icon: '\u{1F50D}', route: '/telemetry/task-trace' },
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
      { label: 'Settings', icon: '\u2699', route: '/settings' },
    ],
  },
];

export const MOCK_MCP_SERVERS: readonly McpServer[] = [
  {
    name: 'Filesystem',
    icon: '\uD83D\uDCC1',
    iconClass: 'filesystem',
    status: 'active',
    badgeType: 'Built-in',
    transport: 'stdio',
    toolCount: '11 tools',
    teams: ['All teams'],
    tools: ['read_file', 'write_file', 'search_files', 'list_directory'],
    moreToolsCount: 7,
  },
  {
    name: 'GitHub',
    icon: '\u2691',
    iconClass: 'github',
    status: 'active',
    badgeType: 'Built-in',
    transport: 'stdio',
    toolCount: '80+ tools',
    teams: ['Engineering'],
    connectionInfo: 'Connected to owner/repo',
    connectionStatus: 'ok',
    tools: ['create_issue', 'create_pull_request', 'search_code'],
    moreToolsCount: 77,
  },
  {
    name: 'Context7',
    icon: 'C7',
    iconClass: 'context7',
    status: 'active',
    badgeType: 'Built-in',
    transport: 'stdio',
    toolCount: '2 tools',
    teams: ['Engineering'],
    tools: ['resolve-library-id', 'query-docs'],
  },
  {
    name: 'Playwright',
    icon: '\uD83C\uDFAD',
    iconClass: 'playwright',
    status: 'active',
    badgeType: 'Built-in',
    transport: 'stdio',
    toolCount: '12 tools',
    teams: ['Engineering', 'Design'],
    tools: ['navigate', 'screenshot', 'click', 'fill'],
    moreToolsCount: 8,
  },
  {
    name: 'Figma',
    icon: 'F',
    iconClass: 'figma',
    status: 'active',
    badgeType: 'User',
    transport: 'HTTP',
    toolCount: '8 tools',
    teams: ['Design'],
    connectionInfo: 'API connected',
    connectionStatus: 'ok',
    tools: ['get_file', 'get_components', 'export_assets'],
    moreToolsCount: 5,
  },
  {
    name: 'Sentry',
    icon: 'S',
    iconClass: 'sentry',
    status: 'inactive',
    badgeType: 'User',
    transport: 'HTTP',
    toolCount: '15 tools',
    teams: ['Engineering'],
    connectionInfo: 'Not configured',
    connectionStatus: 'warn',
    tools: ['list_issues', 'get_event', 'resolve_issue'],
    moreToolsCount: 12,
  },
];

export const MOCK_MCP_TOOL_ACCESS: readonly McpToolAccessRow[] = [
  {
    agent: 'project-manager',
    access: { Filesystem: true, GitHub: true, Context7: false, Playwright: false, Figma: false, Sentry: false },
  },
  {
    agent: 'software-architect',
    access: { Filesystem: true, GitHub: true, Context7: true, Playwright: false, Figma: false, Sentry: true },
  },
  {
    agent: 'team-leader',
    access: { Filesystem: true, GitHub: true, Context7: false, Playwright: false, Figma: false, Sentry: false },
  },
  {
    agent: 'backend-developer',
    access: { Filesystem: true, GitHub: true, Context7: true, Playwright: false, Figma: false, Sentry: true },
  },
  {
    agent: 'frontend-developer',
    access: { Filesystem: true, GitHub: true, Context7: true, Playwright: true, Figma: true, Sentry: false },
  },
  {
    agent: 'senior-tester',
    access: { Filesystem: true, GitHub: true, Context7: false, Playwright: true, Figma: false, Sentry: true },
  },
  {
    agent: 'code-style-reviewer',
    access: { Filesystem: true, GitHub: true, Context7: true, Playwright: false, Figma: false, Sentry: false },
  },
  {
    agent: 'ui-ux-designer',
    access: { Filesystem: true, GitHub: false, Context7: false, Playwright: true, Figma: true, Sentry: false },
  },
];

export const MOCK_ANALYTICS_PAGE_DATA: AnalyticsData = {
  statCards: [
    { label: 'Total Cost', value: '$847.32', trend: { direction: 'up', percent: 12 }, sub: 'Last 30 days', colorKey: 'warning' },
    { label: 'Tasks Completed', value: '48', trend: { direction: 'up', percent: 8 }, sub: 'Last 30 days', colorKey: 'success' },
    { label: 'Tokens Used', value: '2.4M', trend: { direction: 'down', percent: 5, goodWhenDown: true }, sub: 'Last 30 days', colorKey: 'accent' },
    { label: 'Avg Task Duration', value: '4.2', unit: 'min', trend: { direction: 'down', percent: 15, goodWhenDown: true }, sub: 'vs prior period', colorKey: 'text-secondary' },
    { label: 'Active Agents', value: '12', sub: 'Currently online', colorKey: 'accent' },
  ],
  providerCosts: [
    { name: 'Anthropic', percent: 62, amount: 523.40, colorClass: 'blue' },
    { name: 'OpenAI', percent: 23, amount: 198.50, colorClass: 'green' },
    { name: 'Google', percent: 11, amount: 89.42, colorClass: 'orange' },
    { name: 'Local/CLI', percent: 4, amount: 36.00, colorClass: 'gray' },
  ],
  clientCosts: [
    { name: 'Acme Corp', amount: 412.80, budget: 500, colorClass: 'fill-accent' },
    { name: 'TechStart', amount: 287.52, budget: 300, colorClass: 'fill-warning' },
    { name: 'Internal', amount: 147.00, budget: 300, colorClass: 'fill-success' },
  ],
  agentPerformance: [
    { name: 'team-leader', online: true, tasks: 48, avgDuration: '3.2 min', tokensPerTask: '18.4K', costPerTask: 6.82, successRate: 98 },
    { name: 'backend-developer', online: true, tasks: 36, avgDuration: '5.1 min', tokensPerTask: '28.6K', costPerTask: 8.21, successRate: 95 },
    { name: 'frontend-developer', online: true, tasks: 28, avgDuration: '4.8 min', tokensPerTask: '24.1K', costPerTask: 7.95, successRate: 92 },
    { name: 'software-architect', online: true, tasks: 22, avgDuration: '8.3 min', tokensPerTask: '42.8K', costPerTask: 12.40, successRate: 97 },
    { name: 'code-logic-reviewer', online: true, tasks: 41, avgDuration: '2.1 min', tokensPerTask: '12.4K', costPerTask: 4.20, successRate: 99 },
    { name: 'devops-engineer', online: false, tasks: 15, avgDuration: '6.2 min', tokensPerTask: '31.2K', costPerTask: 9.80, successRate: 88 },
    { name: 'tester', online: true, tasks: 38, avgDuration: '3.8 min', tokensPerTask: '19.7K', costPerTask: 6.40, successRate: 94 },
    { name: 'researcher', online: false, tasks: 8, avgDuration: '12.4 min', tokensPerTask: '58.3K', costPerTask: 18.20, successRate: 75 },
  ],
  dailyCosts: [
    { day: 1, amount: 22 }, { day: 2, amount: 18 }, { day: 3, amount: 31 }, { day: 4, amount: 28 },
    { day: 5, amount: 35 }, { day: 6, amount: 42 }, { day: 7, amount: 38 }, { day: 8, amount: 29 },
    { day: 9, amount: 33 }, { day: 10, amount: 27 }, { day: 11, amount: 41 }, { day: 12, amount: 45 },
    { day: 13, amount: 38 }, { day: 14, amount: 32 }, { day: 15, amount: 29 }, { day: 16, amount: 36 },
    { day: 17, amount: 44 }, { day: 18, amount: 39 }, { day: 19, amount: 28 }, { day: 20, amount: 35 },
    { day: 21, amount: 48 }, { day: 22, amount: 43 }, { day: 23, amount: 37 }, { day: 24, amount: 31 },
    { day: 25, amount: 42 }, { day: 26, amount: 38 }, { day: 27, amount: 44 }, { day: 28, amount: 29 },
    { day: 29, amount: 33 }, { day: 30, amount: 38 },
  ],
  dailyBudgetLimit: 35,
  teamBreakdowns: [
    { name: 'Engineering', cost: 520, tasks: 32, agents: 8, avgCost: 16.25, budgetUsed: 520, budgetTotal: 600 },
    { name: 'Design', cost: 210, tasks: 12, agents: 3, avgCost: 17.50, budgetUsed: 210, budgetTotal: 400 },
    { name: 'Marketing', cost: 117, tasks: 4, agents: 2, avgCost: 29.25, budgetUsed: 117, budgetTotal: 200 },
  ],
  filterOptions: {
    clients: ['All Clients', 'Acme Corp', 'TechStart', 'Internal'],
    teams: ['All Teams', 'Engineering', 'Design', 'Marketing'],
    projects: ['All Projects', 'e-commerce-api', 'my-react-app', 'go-microservice'],
  },
} as const;

export const MOCK_AGENT_EDITOR_LIST: readonly AgentEditorData[] = [
  {
    id: 'agent-team-leader',
    name: 'team-leader',
    displayName: 'Team Leader',
    category: 'Coordination',
    tags: ['universal', 'coordination', 'git'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: true },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 4,
    changelog: 'Added Mode 4: rollback capability — breaking change for v3 workflows',
    isBreakingChange: true,
    compatibility: [
      { label: 'workflow:feature', version: '>= v4' },
      { label: 'skill:orchestration', version: '>= v3' },
    ],
    content: `# nitro-team-leader

## Role

You are the **Team Leader** in the Nitro-Fueled orchestration pipeline. You operate between the Software Architect and the Build Workers. You decompose implementation plans into atomic, parallelisable tasks, assign batches to developer agents, verify their output, and commit accepted work.

## Capabilities

- Decompose an \`implementation-plan.md\` into a \`tasks.md\` with numbered batches
- Spawn and monitor Build Worker sessions via the Session Orchestrator MCP
- Verify each batch for completeness (no stubs, no TODOs, no placeholder code)
- Stage and commit accepted batches with conventional commit messages
- Escalate blockers to the Architect or Product Owner

## Tools

| Tool | Purpose |
|------|---------|
| Filesystem | Read and write task-tracking files |
| GitHub | Create PRs and review diffs |
| Context7 | Resolve library documentation |

## Instructions

### Mode 1 — Plan Decomposition
Read \`implementation-plan.md\`, create \`tasks.md\` with batches. Each task must have: file path, action (CREATE/MODIFY), spec reference, and quality requirements.

### Mode 2 — Worker Dispatch
Spawn one Build Worker per batch. Pass the batch number and task folder path. Monitor worker status via \`get_worker_activity\`.

### Mode 3 — Verification
When a worker reports IMPLEMENTED: read each modified file, verify no stubs or TODOs exist, run \`nx build\` to confirm compilation. Approve or return for rework.

### Mode 4 — Rollback (v4+)
When a batch fails verification after two rework cycles, revert staged changes via \`git checkout -- <files>\`, mark tasks FAILED, and escalate to the Architect with a summary of what was attempted.
`,
  },
  {
    id: 'agent-backend-developer',
    name: 'backend-developer',
    displayName: 'Backend Developer',
    category: 'Development',
    tags: ['backend', 'api', 'database'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: true },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 2,
    changelog: 'Added support for gRPC service generation patterns',
    isBreakingChange: false,
    compatibility: [{ label: 'skill:orchestration', version: '>= v2' }],
    content: `# nitro-backend-developer

## Role
You implement server-side features: REST endpoints, gRPC services, database migrations, and background jobs. You receive a batch of tasks from the Team Leader and return production-ready code with no stubs.

## Capabilities
- Implement REST and gRPC endpoints following existing route patterns
- Write database migrations with rollback support
- Add unit and integration tests for new services
`,
  },
  {
    id: 'agent-frontend-developer',
    name: 'frontend-developer',
    displayName: 'Frontend Developer',
    category: 'Development',
    tags: ['frontend', 'angular', 'ui'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: true },
      { name: 'Figma', enabled: true },
      { name: 'Playwright', enabled: true },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 3,
    changelog: 'Added WCAG accessibility checklist enforcement',
    isBreakingChange: false,
    compatibility: [{ label: 'skill:orchestration', version: '>= v2' }],
    content: `# nitro-frontend-developer

## Role
You implement UI components, views, and styles. You follow the project's design system and component patterns exactly. All components must be standalone, accessible, and responsive.

## Capabilities
- Create Angular standalone components with OnPush change detection
- Implement responsive layouts using project CSS custom properties
- Enforce WCAG 2.1 AA compliance on all interactive elements
`,
  },
  {
    id: 'agent-software-architect',
    name: 'software-architect',
    displayName: 'Software Architect',
    category: 'Planning',
    tags: ['architecture', 'planning', 'design'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: true },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 2,
    changelog: 'Improved codebase investigation checklist with risk assessment section',
    isBreakingChange: false,
    compatibility: [{ label: 'skill:orchestration', version: '>= v2' }],
    content: `# nitro-software-architect

## Role
You produce \`implementation-plan.md\` documents. You investigate the codebase, identify patterns, and design a component architecture that the Team Leader can decompose into tasks.

## Capabilities
- Investigate existing code patterns before specifying new ones
- Produce implementation plans with evidence-backed decisions
- Identify risks and document mitigation strategies
`,
  },
  {
    id: 'agent-code-logic-reviewer',
    name: 'code-logic-reviewer',
    displayName: 'Code Logic Reviewer',
    category: 'Quality',
    tags: ['review', 'logic', 'correctness'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-code-logic-reviewer

## Role
You review implementation correctness: business logic accuracy, edge case handling, data flow integrity, and API contract adherence.

## Capabilities
- Verify business logic against acceptance criteria
- Identify missing edge cases and null/error path handling
- Flag incorrect type usage and unsafe casts
`,
  },
  {
    id: 'agent-code-style-reviewer',
    name: 'code-style-reviewer',
    displayName: 'Code Style Reviewer',
    category: 'Quality',
    tags: ['review', 'style', 'lint'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: false },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-code-style-reviewer

## Role
You review code style, naming conventions, file size limits, and anti-pattern violations. You enforce the project's coding standards document.

## Capabilities
- Flag files exceeding line count limits
- Enforce naming conventions for components, services, and models
- Check for banned patterns (any types, inline styles, magic strings)
`,
  },
  {
    id: 'agent-code-security-reviewer',
    name: 'code-security-reviewer',
    displayName: 'Code Security Reviewer',
    category: 'Quality',
    tags: ['review', 'security', 'xss', 'injection'],
    type: 'base_template',
    usedIn: ['e-commerce-api'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: false },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-code-security-reviewer

## Role
You perform security-focused code review: XSS prevention, injection risks, authentication flaws, and insecure data exposure.

## Capabilities
- Detect unsanitized user input rendered as HTML
- Flag missing authentication guards on protected routes
- Identify secrets or tokens hardcoded in source files
`,
  },
  {
    id: 'agent-senior-tester',
    name: 'senior-tester',
    displayName: 'Senior Tester',
    category: 'Quality',
    tags: ['testing', 'e2e', 'unit'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: true },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [{ label: 'skill:orchestration', version: '>= v2' }],
    content: `# nitro-senior-tester

## Role
You write and execute unit tests, integration tests, and end-to-end tests. You ensure acceptance criteria are verifiable through automated test suites.

## Capabilities
- Write Jest unit tests for services and utilities
- Write Playwright e2e tests for critical user flows
- Generate test coverage reports and flag untested branches
`,
  },
  {
    id: 'agent-devops-engineer',
    name: 'devops-engineer',
    displayName: 'DevOps Engineer',
    category: 'Specialist',
    tags: ['devops', 'ci', 'docker', 'infrastructure'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-devops-engineer

## Role
You manage CI/CD pipelines, Docker configuration, infrastructure-as-code, and deployment automation.

## Capabilities
- Configure GitHub Actions workflows for build, test, and deploy
- Write Dockerfiles and docker-compose configurations
- Set up environment variable management and secret rotation
`,
  },
  {
    id: 'agent-researcher-expert',
    name: 'researcher-expert',
    displayName: 'Researcher Expert',
    category: 'Specialist',
    tags: ['research', 'analysis', 'documentation'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: false },
      { name: 'Context7', enabled: true },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-researcher-expert

## Role
You investigate technical topics, evaluate library options, and produce research summaries for the Architect to act on.

## Capabilities
- Evaluate library trade-offs with real benchmark data
- Summarise documentation into decision-ready recommendations
- Identify breaking changes in dependency upgrades
`,
  },
  {
    id: 'agent-project-manager',
    name: 'project-manager',
    displayName: 'Project Manager',
    category: 'Planning',
    tags: ['planning', 'roadmap', 'backlog'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-project-manager

## Role
You translate product requirements into task descriptions with clear acceptance criteria. You manage the backlog and communicate priorities to the Architect.

## Capabilities
- Write task-description.md files with acceptance criteria
- Prioritise backlog items by business impact
- Track task dependencies and flag scheduling conflicts
`,
  },
  {
    id: 'agent-systems-developer',
    name: 'systems-developer',
    displayName: 'Systems Developer',
    category: 'Specialist',
    tags: ['systems', 'cli', 'node', 'scripts'],
    type: 'base_template',
    usedIn: ['go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: true },
      { name: 'Context7', enabled: true },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-systems-developer

## Role
You implement CLI tooling, Node.js scripts, build system plugins, and low-level infrastructure code that supports the development pipeline.

## Capabilities
- Build CLI commands with argument parsing and help text
- Write Node.js scripts for automation and scaffolding
- Implement Nx plugins and workspace generators
`,
  },
  {
    id: 'agent-planner',
    name: 'planner',
    displayName: 'Planner',
    category: 'Planning',
    tags: ['strategy', 'roadmap', 'planning'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app', 'go-service'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: false },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: false },
      { name: 'Playwright', enabled: false },
    ],
    knowledgeScope: ['global'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-planner

## Role
You sit between the Product Owner and the Supervisor. You translate high-level goals into an ordered task backlog with dependency annotations and wave assignments.

## Capabilities
- Produce phased roadmaps from product vision documents
- Break epics into independently deployable tasks
- Annotate tasks with parallelism constraints and dependencies
`,
  },
  {
    id: 'agent-visual-reviewer',
    name: 'visual-reviewer',
    displayName: 'Visual Reviewer',
    category: 'Quality',
    tags: ['review', 'ui', 'design', 'accessibility'],
    type: 'base_template',
    usedIn: ['e-commerce-api', 'my-react-app'],
    mcpTools: [
      { name: 'Filesystem', enabled: true },
      { name: 'GitHub', enabled: false },
      { name: 'Context7', enabled: false },
      { name: 'Figma', enabled: true },
      { name: 'Playwright', enabled: true },
    ],
    knowledgeScope: ['global', 'project'],
    currentVersion: 1,
    changelog: 'Initial release',
    isBreakingChange: false,
    compatibility: [],
    content: `# nitro-visual-reviewer

## Role
You compare implemented UI components against the visual design specification. You capture screenshots, identify discrepancies, and report them with pixel-level detail.

## Capabilities
- Take Playwright screenshots at multiple viewport sizes
- Compare rendered output to Figma design specs
- Flag accessibility violations: missing ARIA, insufficient colour contrast, keyboard traps
`,
  },
];

export const MOCK_MCP_INTEGRATIONS: readonly McpIntegration[] = [
  {
    name: 'GitHub',
    icon: '\u2691',
    iconClass: 'gh',
    connected: true,
    details: [
      { label: 'Account', value: 'owner/repo' },
      { label: 'Scope', value: 'repo, issues, pull_requests' },
    ],
    toggleLabel: 'Auto-PR creation',
    toggleOn: true,
  },
  {
    name: 'Slack',
    icon: '\u23CE',
    iconClass: 'slack',
    connected: true,
    details: [
      { label: 'Channel', value: '#engineering' },
      { label: 'Notify', value: 'Task completions, errors' },
    ],
    toggleLabel: 'Auto-notifications',
    toggleOn: true,
  },
  {
    name: 'Jira',
    icon: 'J',
    iconClass: 'jira',
    connected: false,
    details: [],
    description: 'Sync tasks and issues with Jira boards',
    toggleLabel: 'Auto-sync tasks',
    toggleOn: false,
  },
  {
    name: 'Figma',
    icon: 'F',
    iconClass: 'figma-int',
    connected: true,
    details: [
      { label: 'Via', value: 'MCP Server (Figma)' },
      { label: 'Status', value: 'Active' },
    ],
    toggleLabel: 'Auto-export assets',
    toggleOn: false,
  },
  {
    name: 'Notion',
    icon: 'N',
    iconClass: 'notion',
    connected: false,
    details: [],
    description: 'Sync documentation and knowledge base',
    toggleLabel: 'Auto-sync docs',
    toggleOn: false,
  },
];

// ── Command Center Mock Data ────────────────────────────────────────────────────────

export const MOCK_TASK_STATUS_BREAKDOWN: TaskStatusBreakdown = {
  CREATED: 8,
  IN_PROGRESS: 5,
  IMPLEMENTED: 12,
  IN_REVIEW: 3,
  FIXING: 2,
  COMPLETE: 47,
  FAILED: 2,
  BLOCKED: 1,
  CANCELLED: 0,
};

export const MOCK_TOKEN_COST_SUMMARY: TokenCostSummary = {
  totalTokens: 2400000,
  totalCost: 847.32,
  recentSessions: [
    { sessionId: 'SESSION_2026-03-30_03-40-31', date: '2026-03-30', tokens: 125000, cost: 42.50 },
    { sessionId: 'SESSION_2026-03-30_02-52-25', date: '2026-03-30', tokens: 89000, cost: 31.20 },
    { sessionId: 'SESSION_2026-03-29_18-15-42', date: '2026-03-29', tokens: 156000, cost: 54.80 },
    { sessionId: 'SESSION_2026-03-29_14-32-18', date: '2026-03-29', tokens: 210000, cost: 73.40 },
    { sessionId: 'SESSION_2026-03-28_22-10-05', date: '2026-03-28', tokens: 95000, cost: 33.10 },
  ],
};

export const MOCK_ACTIVE_SESSIONS: readonly ActiveSession[] = [
  { sessionId: 'SESSION_2026-03-30_03-40-31', taskId: 'TASK_2026_147', taskTitle: 'Dashboard Home — Live Command Center Redesign', status: 'running' },
  { sessionId: 'SESSION_2026-03-30_02-52-25', taskId: 'TASK_2026_130', taskTitle: 'CLI Error Handling and Reporting', status: 'running' },
  { sessionId: 'SESSION_2026-03-30_01-18-33', taskId: 'TASK_2026_128', taskTitle: 'Agent Editor Analytics Integration', status: 'paused' },
];

export const MOCK_ACTIVE_COMMAND_CENTER_TASKS: readonly ActiveTask[] = [
  { taskId: 'TASK_2026_147', title: 'Dashboard Home — Live Command Center Redesign', status: 'IN_PROGRESS', type: 'FEATURE', priority: 'P1-High' },
  { taskId: 'TASK_2026_130', title: 'CLI Error Handling and Reporting', status: 'IN_PROGRESS', type: 'REFACTORING', priority: 'P1-High' },
  { taskId: 'TASK_2026_128', title: 'Agent Editor Analytics Integration', status: 'IN_PROGRESS', type: 'FEATURE', priority: 'P2-Medium' },
  { taskId: 'TASK_2026_122', title: 'Telemetry Model Performance View', status: 'IN_PROGRESS', type: 'FEATURE', priority: 'P2-Medium' },
  { taskId: 'TASK_2026_115', title: 'MCP Tool Access Management', status: 'IN_PROGRESS', type: 'FEATURE', priority: 'P2-Medium' },
];

export const MOCK_COMMAND_CENTER_DATA: CommandCenterData = {
  taskBreakdown: MOCK_TASK_STATUS_BREAKDOWN,
  tokenCost: MOCK_TOKEN_COST_SUMMARY,
  activeSessions: MOCK_ACTIVE_SESSIONS,
  activeTasks: MOCK_ACTIVE_COMMAND_CENTER_TASKS,
};
