import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth, RequireRole } from './components/RouteGuards';
import { LoginPage } from './pages/LoginPage';
import { NotAuthorizedPage } from './pages/NotAuthorizedPage';
import { HomeRedirect } from './pages/HomeRedirect';
import { TodayPage } from './pages/TodayPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { NewEncounterPage } from './pages/NewEncounterPage';
import { NewCarePlanPage } from './pages/NewCarePlanPage';
import { CarePlanPage } from './pages/CarePlanPage';
import { FollowUpPage } from './pages/FollowUpPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/not-authorized" element={<NotAuthorizedPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<RequireRole allowed={['DOCTOR']} />}>
            <Route path="/today" element={<TodayPage />} />
            <Route path="/follow-up" element={<FollowUpPage />} />
            <Route path="/patients/:patientId/encounters/new" element={<NewEncounterPage />} />
            <Route path="/patients/:patientId/care-plan/new" element={<NewCarePlanPage />} />
            <Route path="/care-plans/:carePlanId" element={<CarePlanPage />} />
          </Route>

          <Route element={<RequireRole allowed={['DOCTOR', 'RECEPTIONIST']} />}>
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/:patientId" element={<PatientDetailPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
