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
import { useInitialData, useWebSocket } from './hooks/index.js';

function AppContent(): React.JSX.Element {
  useInitialData();
  useWebSocket();

  return (
    <Routes>
      <Route path="/" element={<Layout><TaskBoard /></Layout>} />
      <Route path="/roadmap" element={<Layout><Roadmap /></Layout>} />
      <Route path="/workers" element={<Layout><Workers /></Layout>} />
      <Route path="/queue" element={<Layout><Queue /></Layout>} />
      <Route path="/log" element={<Layout><SessionLog /></Layout>} />
      <Route path="/reviews" element={<Layout><Reviews /></Layout>} />
      <Route path="/cost" element={<Layout><CostDashboard /></Layout>} />
      <Route path="/patterns" element={<Layout><AntiPatterns /></Layout>} />
      <Route path="/lessons" element={<Layout><ReviewLessons /></Layout>} />
      <Route path="/task/:id" element={<Layout><TaskDetail /></Layout>} />
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
