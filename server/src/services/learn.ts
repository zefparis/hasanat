/** Learn data — pilot mock. Quran progress, courses, badges. */

export interface Course {
  id: string
  title: string
  progress: number // 0..1
  lessons: number
  completedLessons: number
}

export interface Badge {
  id: string
  title: string
  earned: boolean
  icon: string
}

export interface LearnState {
  quran: {
    juzRead: number
    juzTotal: number
    streak: number
    pointsThisMonth: number
  }
  courses: Course[]
  badges: Badge[]
}

const learnState: LearnState = {
  quran: { juzRead: 18, juzTotal: 30, streak: 12, pointsThisMonth: 240 },
  courses: [
    { id: 'c1', title: 'Arabic Level 2', progress: 1.0, lessons: 24, completedLessons: 24 },
    { id: 'c2', title: 'Fiqh of Zakat', progress: 0.65, lessons: 12, completedLessons: 8 },
    { id: 'c3', title: 'Juz Amma Memorisation', progress: 0.40, lessons: 20, completedLessons: 8 },
    { id: 'c4', title: 'Hajj and Umrah Essentials', progress: 0.15, lessons: 16, completedLessons: 2 },
  ],
  badges: [
    { id: 'bg1', title: 'First Sadaqah', earned: true, icon: '☆' },
    { id: 'bg2', title: 'Quran Streak — 7 days', earned: true, icon: '📖' },
    { id: 'bg3', title: 'Arabic Level 2 Complete', earned: true, icon: 'أ' },
    { id: 'bg4', title: 'Zakat Payer', earned: true, icon: '◈' },
    { id: 'bg5', title: 'Hajj Course Graduate', earned: false, icon: '🕋' },
    { id: 'bg6', title: '30 Juz Complete', earned: false, icon: '✦' },
  ],
}

export function getLearnState(): LearnState {
  return {
    quran: { ...learnState.quran },
    courses: learnState.courses.map((c) => ({ ...c })),
    badges: learnState.badges.map((b) => ({ ...b })),
  }
}
