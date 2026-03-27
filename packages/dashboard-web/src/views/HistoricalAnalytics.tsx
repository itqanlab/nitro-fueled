import React from 'react';
import { tokens } from '../theme/tokens.js';
import { api } from '../api/client.js';
import type {
  AnalyticsCostData,
  AnalyticsModelsData,
  AnalyticsSessionsData,
} from '../types/index.js';
import { AnalyticsCostChart } from './AnalyticsCostChart.js';
import { AnalyticsSessionsTable } from './AnalyticsSessionsTable.js';
import { AnalyticsModelsChart } from './AnalyticsModelsChart.js';
import { StatCard, SectionCard } from './AnalyticsCards.js';

export function HistoricalAnalytics(): React.JSX.Element {
  const [costData, setCostData] = React.useState<AnalyticsCostData | null>(null);
  const [modelsData, setModelsData] = React.useState<AnalyticsModelsData | null>(null);
  const [sessionsData, setSessionsData] = React.useState<AnalyticsSessionsData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    Promise.all([
      api.getAnalyticsCost(),
      api.getAnalyticsModels(),
      api.getAnalyticsSessions(),
    ])
      .then(([cost, models, sessions]) => {
        if (cancelled) return;
        setCostData(cost);
        setModelsData(models);
        setSessionsData(sessions);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <div style={{ color: tokens.colors.textDim, padding: '24px' }}>Loading analytics...</div>;
  }

  if (error !== null) {
    return (
      <div style={{ color: tokens.colors.red, padding: '24px', fontSize: '14px' }}>
        Error loading analytics: {error}
      </div>
    );
  }

  const sessionCount = costData?.sessions.length ?? 0;
  const cumulativeCost = costData?.cumulativeCost ?? 0;
  const savings = modelsData?.actualSavings ?? 0;

  return (
    <div>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: tokens.colors.textBright,
          marginBottom: '24px',
        }}
      >
        Historical Analytics
      </h1>

      {/* Section 1: Summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <StatCard label="Sessions Analyzed" value={String(sessionCount)} color={tokens.colors.blue} />
        <StatCard label="Cumulative Cost" value={`$${cumulativeCost.toFixed(2)}`} color={tokens.colors.accent} />
        <StatCard label="Estimated Savings vs All-Opus" value={`$${savings.toFixed(2)}`} color={tokens.colors.green} />
      </div>

      {/* Section 2: Cost per session bar chart */}
      <SectionCard title="Cost Per Session">
        <AnalyticsCostChart sessions={costData?.sessions ?? []} />
      </SectionCard>

      {/* Section 3: Session comparison table */}
      <SectionCard title="Session Comparison">
        <AnalyticsSessionsTable sessions={sessionsData?.sessions ?? []} />
      </SectionCard>

      {/* Section 4: Model usage breakdown */}
      <SectionCard title="Model Usage Breakdown">
        <AnalyticsModelsChart
          data={modelsData ?? { models: [], totalCost: 0, hypotheticalOpusCost: 0, actualSavings: 0 }}
        />
      </SectionCard>
    </div>
  );
}
