import type {
  CampusEvent,
  Profile,
  Announcement,
  Registration,
  Attendance,
} from "../lib/types";
const future = (day: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
export const demoProfile: Profile = {
  id: "demo-student",
  full_name: "Alex Rivera",
  student_id: "23104567",
  course: "BS Computer Science",
  year_level: 3,
  organization: "Computer and Information Sciences Council",
  avatar_url: "",
  role: "student",
  email: "alex.rivera@usc.edu.ph",
};
const names = [
  "Sofia Tan",
  "Miguel Santos",
  "Isabella Cruz",
  "Gabriel Lim",
  "Chloe Garcia",
  "Ethan Reyes",
  "Amara Flores",
];
const firstNames = [
  "Andrea",
  "Daniel",
  "Sophia",
  "Lucas",
  "Camila",
  "Joshua",
  "Mika",
  "Nathan",
  "Ella",
  "Rafael",
  "Hannah",
  "Adrian",
  "Bea",
  "Paolo",
  "Nicole",
  "Carlo",
  "Julia",
  "Marco",
  "Kate",
  "Luis",
];
const lastNames = [
  "Santos",
  "Cruz",
  "Reyes",
  "Garcia",
  "Lim",
  "Tan",
  "Flores",
  "Ramos",
  "Dela Peña",
  "Torres",
  "Bautista",
  "Aquino",
  "Navarro",
  "Villanueva",
  "Castillo",
];
export const demoPeople: Profile[] = [
  demoProfile,
  ...Array.from({ length: 299 }, (_, i) => ({
    ...demoProfile,
    id: "person-" + i,
    full_name:
      names[i] || firstNames[i % 20] + " " + lastNames[Math.floor(i / 20) % 15],
    student_id: String(23104570 + i),
    course:
      i % 3 === 0
        ? "BS Information Technology"
        : i % 3 === 1
          ? "BS Computer Science"
          : "BS Business Administration",
    email: "",
  })),
];
const definitions = [
  [
    "Innovation starts here: USC Tech Summit",
    "Technology",
    "Computer and Information Sciences Council",
    "SAFAD Theater, Talamban Campus",
    "tech.jpg",
    2,
    9,
    300,
    218,
    "A day of bold ideas, new connections, and what’s next in technology. Join student innovators and industry speakers for talks on AI, hands-on workshops, and a showcase of projects built by Carolinians. Bring your curiosity and your laptop.",
  ],
  [
    "Pasundayag: A celebration of Carolinian talent",
    "Arts & Culture",
    "USC Cultural Council",
    "Anselmo Bustos Sports Complex",
    "culture.jpg",
    3,
    17,
    250,
    186,
    "Experience an evening of music, movement, and stories from the Carolinian community. Celebrate student creativity through live performances, visual arts, and cultural showcases. All courses and year levels are welcome.",
  ],
  [
    "On the court: Inter-org basketball cup",
    "Sports",
    "USC Sports Council",
    "USC Talamban Gymnasium",
    "sports.jpg",
    4,
    8,
    120,
    104,
    "Bring your school spirit to the court. Cheer for your organization and connect with fellow Carolinians at our inter-organization basketball tournament. Expect friendly competition, team challenges, and a full day of campus energy.",
  ],
  [
    "Small acts, lasting impact: Community day",
    "Community",
    "USC Community Extension Services",
    "Talamban Community Center",
    "community.jpg",
    5,
    8,
    80,
    80,
    "Make a meaningful difference alongside fellow Carolinians. Our community day brings together student volunteers for local learning activities and outreach. Orientation, materials, and a volunteer certificate are included.",
  ],
  [
    "Beyond the classroom: Career conversations",
    "Academic",
    "USC Supreme Student Council",
    "Rigney Hall, Downtown Campus",
    "campus.jpg",
    7,
    13,
    200,
    142,
    "Find your next step with advice from alumni, practical resume reviews, and conversations with industry mentors. Meet people working in your field and leave with a clearer picture of what comes after graduation.",
  ],
  [
    "Lead with purpose: Student leaders forum",
    "Leadership",
    "USC Supreme Student Council",
    "Fr. Theodore Buttenbruch Hall",
    "culture.jpg",
    9,
    10,
    150,
    89,
    "Connect with student leaders across campus. Share experiences, build your leadership skills, and collaborate on ideas that make university life more inclusive and engaging. Includes a workshop and networking session.",
  ],
] as const;
export const demoEvents: CampusEvent[] = definitions.map(
  (
    [
      title,
      category,
      organization,
      venue,
      img,
      day,
      hour,
      capacity,
      filled,
      description,
    ],
    i,
  ) => ({
    id: "event-" + (i + 1),
    title,
    category,
    organization,
    venue,
    banner_url: "/images/" + img,
    start_time: future(day, hour),
    end_time: future(day, hour + 4),
    registration_deadline: future(day, Math.max(hour - 1, 0)),
    capacity,
    filled,
    description,
    created_by: null,
    created_at: future(-7),
    waitlisted: i === 3 ? 6 : 0,
  }),
);
demoEvents.push(
  ...[
    {
      ...demoEvents[4],
      id: "event-past-1",
      title: "Carolinian Career Launchpad",
      start_time: future(-3, 9),
      end_time: future(-3, 13),
      registration_deadline: future(-4, 18),
      capacity: 150,
      filled: 110,
      waitlisted: 0,
    },
    {
      ...demoEvents[5],
      id: "event-past-2",
      title: "Ideas into action: Leadership workshop",
      start_time: future(-7, 10),
      end_time: future(-7, 14),
      registration_deadline: future(-8, 18),
      capacity: 120,
      filled: 95,
      waitlisted: 0,
    },
  ],
);
export const demoRegistrations: Registration[] = demoEvents.flatMap((e, j) =>
  demoPeople.slice(1, (e.filled || 0) + 1).map((p, i) => ({
    id: "reg-" + j + "-" + i,
    event_id: e.id,
    user_id: p.id,
    status: "registered" as const,
    qr_token: crypto.randomUUID(),
    created_at: future(
      j === 6 ? -5 - (i % 3) : j === 7 ? -9 - (i % 3) : -1 - (i % 7),
      9 + (i % 6),
    ),
  })),
);
export const demoAttendance: Attendance[] = demoRegistrations
  .filter((r) => r.event_id === "event-past-1")
  .slice(0, 90)
  .concat(
    demoRegistrations.filter((r) => r.event_id === "event-past-2").slice(0, 78),
  )
  .map((r, i) => ({
    id: "attendance-" + i,
    registration_id: r.id,
    checked_in_at:
      r.event_id === "event-past-1" ? future(-3, 9) : future(-7, 10),
    checked_in_by: "demo-admin",
  }));
export const demoAnnouncements: Announcement[] = [
  {
    id: "ann-1",
    event_id: null,
    title: "Your next great campus memory starts here",
    body: "Welcome to CampusConnect! Discover what’s happening, find your people, and keep all your event tickets in one place.",
    created_by: "demo-admin",
    created_at: future(0, 8),
  },
  {
    id: "ann-2",
    event_id: null,
    title: "Calling all student organizations",
    body: "Have an event coming up? Your organization can coordinate with the Student Affairs Office to get organizer access and share it with the Carolinian community.",
    created_by: "demo-admin",
    created_at: future(-1, 10),
  },
  {
    id: "ann-3",
    event_id: "event-1",
    title: "Tech Summit: Bring your laptop",
    body: "Workshop participants should bring a charged laptop. Check-in opens at the theater entrance one hour before the program.",
    created_by: "demo-admin",
    created_at: future(-1, 14),
  },
];

// Existing waitlisted demo students have the same records used by attendance/reports.
demoRegistrations.push(
  ...demoPeople
    .slice(81, 87)
    .map((p, i) => ({
      id: "waitlist-" + i,
      event_id: "event-4",
      user_id: p.id,
      status: "waitlisted" as const,
      qr_token: crypto.randomUUID(),
      created_at: future(-1, 10 + i),
    })),
);
