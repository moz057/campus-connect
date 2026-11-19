export type Role = "student" | "admin";
export type DemoRole = Role | "leader";
export type StudentSummary = Pick<Profile, "id" | "full_name" | "student_id">;
export interface Organization {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  faculty_adviser: string;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
}
export interface LeadershipTerm {
  organization_id: string;
  student_id: string;
  position: string;
  term_start: string;
  term_end: string;
}
export interface Membership extends Omit<
  LeadershipTerm,
  "position" | "term_start" | "term_end"
> {
  id: string;
  role: "member" | "leader";
  position: string | null;
  term_start: string | null;
  term_end: string | null;
  revoked_at: string | null;
}
export interface OrganizationJoinRequest {
  id: string;
  organization_id: string;
  applicant_id: string;
  applicant_name: string;
  applicant_student_id: string | null;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
}
export interface Nomination extends Omit<LeadershipTerm, "student_id"> {
  id: string;
  nominee_id: string;
  nominated_by: string | null;
  status: "pending" | "approved" | "rejected";
  explanation: string;
  reason: string | null;
  created_at: string;
}
export interface LeadershipHistory {
  id: string;
  organization_id: string;
  student_id: string | null;
  actor_id: string | null;
  nomination_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}
export interface CampusNotification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  organization_id?: string | null;
  event_id?: string | null;
  nomination_id?: string | null;
  destination: string;
  created_at: string;
  read_at: string | null;
}
export interface AnnouncementRead {
  recipient_id: string;
  announcement_id: string;
  read_at: string;
}
export interface Profile {
  id: string;
  full_name: string;
  student_id: string;
  course: string;
  year_level: number | null;
  organization: string;
  avatar_url: string;
  role: Role;
  email?: string;
}
export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  organization: string;
  venue: string;
  organization_id?: string | null;
  cancelled_at?: string | null;
  start_time: string;
  end_time: string;
  banner_url: string;
  capacity: number;
  registration_deadline: string;
  registration_form_url?: string | null;
  registration_form_required?: boolean;
  created_by: string | null;
  created_at: string;
  filled?: number;
  waitlisted?: number;
}
export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  status: "registered" | "waitlisted" | "cancelled";
  qr_token: string;
  created_at: string;
}
export interface Attendance {
  id: string;
  registration_id: string;
  checked_in_at: string;
  checked_in_by: string;
}
export interface Announcement {
  id: string;
  event_id: string | null;
  organization_id?: string | null;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
}
export const categories = [
  "Academic",
  "Technology",
  "Arts & Culture",
  "Sports",
  "Community",
  "Leadership",
];
