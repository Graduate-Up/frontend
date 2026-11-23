import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { CoursesPage } from '@/pages/CoursesPage'
import { HiddenCreditsPage } from '@/pages/HiddenCreditsPage'
import { RecommendPage } from '@/pages/RecommendPage'
import { ChatPage } from '@/pages/ChatPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { NoticesPage } from '@/pages/NoticesPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { RequirementDetailPage } from '@/pages/RequirementDetailPage'
import { RequirementsPage } from '@/pages/RequirementsPage'
import { TranscriptReceiverPage } from '@/pages/TranscriptReceiverPage'
import { StudentProvider } from '@/state/StudentProvider'

export default function App() {
  return (
    <StudentProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        {/* 통합정보시스템 즐겨찾기(북마클릿)가 성적을 넘겨주는 창 — 주소는 백엔드 스크립트가 정한다 */}
        <Route path="/account" element={<TranscriptReceiverPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="requirements" element={<RequirementsPage />} />
          <Route path="requirements/:id" element={<RequirementDetailPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="hidden-credits" element={<HiddenCreditsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="recommend" element={<RecommendPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="notices" element={<NoticesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </BrowserRouter>
    </StudentProvider>
  )
}
