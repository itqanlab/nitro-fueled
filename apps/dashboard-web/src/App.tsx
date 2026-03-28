import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { TaskBoard } from './views/TaskBoard.js';
import { Roadmap } from './views/Roadmap.js';
import { Workers } from './views/Workers.js';
import { Queue } from './views/Queue.js';
import { SessionLog } from './views/SessionLog.js';
import { Reviews } from './views/Reviews.js';
import { CostDashboard } from './views/CostDashboard.js';
import { AntiPatterns } from './views/AntiPatterns.js';
import { ReviewLessons } from './views/ReviewLessons.js';
import { TaskDetail } from './views/TaskDetail.js';
import { Sessions } from './views/Sessions.js';
import { DependencyGraph } from './views/DependencyGraph.js';
import { Pipeline } from './views/Pipeline.js';
import { Squad } from './views/Squad.js';
import { HistoricalAnalytics } from './views/HistoricalAnalytics.js';
import { useInitialData, useWebSocket } from './hooks/index.js';
import { tokens } from './theme/tokens.js';

interface ErrorBoundaryState {
  error: Error | null;
}

class RouteErrorBoundary extends React.Component<
  React.PropsWithChildren<{ route: string }>,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            color: tokens.colors.red,
            fontFamily: tokens.font.mono,
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
            View error — {this.props.route}
          </div>
          <div style={{ fontSize: '13px', color: tokens.colors.textDim }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '24px',
              padding: '8px 20px',
              borderRadius: '8px',
              border: `1px solid ${tokens.colors.border}`,
              backgroundColor: tokens.colors.bgCard,
              color: tokens.colors.text,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function wrap(route: string, el: React.ReactElement): React.ReactElement {
  return (
    <Layout>
      <RouteErrorBoundary route={route}>{el}</RouteErrorBoundary>
    </Layout>
  );
}

function AppContent(): React.JSX.Element {
  useInitialData();
  useWebSocket();

  return (
    <Routes>
      <Route path="/" element={wrap('Task Board', <TaskBoard />)} />
      <Route path="/roadmap" element={wrap('Roadmap', <Roadmap />)} />
      <Route path="/workers" element={wrap('Workers', <Workers />)} />
      <Route path="/queue" element={wrap('Queue', <Queue />)} />
      <Route path="/log" element={wrap('Session Log', <SessionLog />)} />
      <Route path="/reviews" element={wrap('Reviews', <Reviews />)} />
      <Route path="/cost" element={wrap('Cost & Stats', <CostDashboard />)} />
      <Route path="/patterns" element={wrap('Anti-Patterns', <AntiPatterns />)} />
      <Route path="/lessons" element={wrap('Review Lessons', <ReviewLessons />)} />
      <Route path="/task/:id" element={wrap('Task Detail', <TaskDetail />)} />
      <Route path="/sessions" element={wrap('Sessions', <Sessions />)} />
      <Route path="/graph" element={wrap('Dependency Graph', <DependencyGraph />)} />
      <Route path="/pipeline" element={wrap('Pipeline', <Pipeline />)} />
      <Route path="/squad" element={wrap('Squad', <Squad />)} />
      <Route path="/analytics" element={wrap('Historical Analytics', <HistoricalAnalytics />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
