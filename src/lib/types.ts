export type Role = "student" | "admin";
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
  start_time: string;
  end_time: string;
  banner_url: string;
  capacity: number;
  registration_deadline: string;
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
