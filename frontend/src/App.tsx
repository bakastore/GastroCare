import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth, RequireRole } from './components/RouteGuards';
import { LoginPage } from './pages/LoginPage';
import { NotAuthorizedPage } from './pages/NotAuthorizedPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomeRedirect } from './pages/HomeRedirect';
import { TodayPage } from './pages/TodayPage';
import { PatientsPage } from './pages/PatientsPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { NewEncounterPage } from './pages/NewEncounterPage';
import { NewCarePlanPage } from './pages/NewCarePlanPage';
import { CarePlanPage } from './pages/CarePlanPage';
import { FollowUpPage } from './pages/FollowUpPage';
import { ClinicalFormPage } from './pages/ClinicalFormPage';
import { LongoClinicalFormPage } from './pages/LongoClinicalFormPage';
import { NewHemorrhoidEncounterPage } from './pages/NewHemorrhoidEncounterPage';
import { HemorrhoidExaminationPage } from './pages/HemorrhoidExaminationPage';

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
            <Route
              path="/patients/:patientId/encounters/:encounterId/clinical-forms/hemorrhoid-longo-followup"
              element={<ClinicalFormPage />}
            />
            <Route
              path="/patients/:patientId/encounters/:encounterId/longo-forms/:templateKey"
              element={<LongoClinicalFormPage />}
            />
            <Route
              path="/patients/:patientId/encounters/:encounterId/clinical-forms/:templateKey"
              element={<LongoClinicalFormPage />}
            />
            <Route
              path="/patients/:patientId/encounters/:encounterId/hemorrhoid-examination"
              element={<HemorrhoidExaminationPage />}
            />
          </Route>

          <Route element={<RequireRole allowed={['DOCTOR', 'RECEPTIONIST']} />}>
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/:patientId" element={<PatientDetailPage />} />
            <Route
              path="/patients/:patientId/hemorrhoid/new-encounter"
              element={<NewHemorrhoidEncounterPage />}
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
