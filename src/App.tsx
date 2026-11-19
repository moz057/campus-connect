import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import { ToastProvider } from "./contexts/ToastContext";
import Layout, { OrganizerInfo } from "./components/Layout";
import { Loading, Empty } from "./components/Common";
import Discover from "./pages/Discover";
const EventDetails = lazy(() => import("./pages/EventDetails"));
const Auth = lazy(() => import("./pages/Auth"));
const Registrations = lazy(() => import("./pages/Registrations"));
const Profile = lazy(() => import("./pages/Profile"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EventForm = lazy(() => import("./pages/EventForm"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Reports = lazy(() => import("./pages/Reports"));
function Protected({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!profile)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (admin && profile.role !== "admin")
    return (
      <Empty
        title="An organizer space"
        body="This page is available to authorized university organizers."
        action={
          <Link className="button primary" to="/events">
            Back to events
          </Link>
        }
      />
    );
  return children;
}
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DataProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/login" element={<Auth />} />
                <Route path="/auth/callback" element={<Auth />} />
                <Route path="/register" element={<Auth />} />
                <Route element={<Layout />}>
                  <Route index element={<Discover />} />
                  <Route path="events" element={<Discover />} />
                  <Route path="events/:id" element={<EventDetails />} />
                  <Route path="calendar" element={<Calendar />} />
                  <Route path="organizers" element={<OrganizerInfo />} />
                  <Route
                    path="registrations"
                    element={
                      <Protected>
                        <Registrations />
                      </Protected>
                    }
                  />
                  <Route
                    path="profile"
                    element={
                      <Protected>
                        <Profile />
                      </Protected>
                    }
                  />
                  <Route
                    path="notifications"
                    element={
                      <Protected>
                        <Notifications />
                      </Protected>
                    }
                  />
                  <Route
                    path="admin"
                    element={
                      <Protected admin>
                        <Dashboard />
                      </Protected>
                    }
                  />
                  <Route
                    path="admin/events/new"
                    element={
                      <Protected admin>
                        <EventForm />
                      </Protected>
                    }
                  />
                  <Route
                    path="admin/events/:id/edit"
                    element={
                      <Protected admin>
                        <EventForm key={window.location.pathname} />
                      </Protected>
                    }
                  />
                  <Route
                    path="admin/attendance"
                    element={
                      <Protected admin>
                        <Attendance />
                      </Protected>
                    }
                  />
                  <Route
                    path="admin/reports"
                    element={
                      <Protected admin>
                        <Reports />
                      </Protected>
                    }
                  />
                  <Route
                    path="*"
                    element={
                      <Empty
                        title="A little off campus?"
                        body="We couldn’t find that page. Let’s get you back to the community."
                        action={
                          <Link className="button primary" to="/events">
                            Back to campus
                          </Link>
                        }
                      />
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </DataProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
