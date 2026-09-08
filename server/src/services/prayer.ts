/**
 * Prayer times calculator — ported from the Hasanat live demo's solar position
 * algorithm (Johannesburg: lat -26.2041, lon 28.0473, UTC+2, Fajr/Isha 18°).
 *
 * This is a real astronomical calculation, not a static table. The city is
 * configurable via env (HASANAT_CITY_LAT/LON/TZ). Default: Johannesburg.
 *
 * Calculation method and madhab are configurable via getSchedule() params.
 */

export type CalcMethod = 'MWL' | 'ISNA' | 'UMM_QURA' | 'EGYPTIAN' | 'KARACHI'
export type Madhab = 'standard' | 'hanafi'

export interface PrayerTime {
  name: 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'
  /** "HH:MM" in the city's local time */
  time: string
  /** Hanafi Asr time, shown alongside standard Asr */
  asrHanafi?: string
}

export interface PrayerSchedule {
  date: string // ISO Gregorian
  hijri: string // "DD MonthName YYYY AH"
  city: string
  times: PrayerTime[]
  /** index of the next upcoming prayer in `times` (0-based), or 0 if past Isha */
  nextIndex: number
  /** seconds until the next prayer */
  secondsUntilNext: number
  nextName: string
  /** Calculation method used */
  method: CalcMethod
  /** Madhab used for primary Asr time */
  madhab: Madhab
}

interface MethodConfig {
  fajrAngle: number
  ishaAngle: number | null // null = use fixed minutes after Maghrib
  ishaMinutesAfterMaghrib: number | null
}

const METHODS: Record<CalcMethod, MethodConfig> = {
  MWL: { fajrAngle: 18, ishaAngle: 17, ishaMinutesAfterMaghrib: null },
  ISNA: { fajrAngle: 15, ishaAngle: 15, ishaMinutesAfterMaghrib: null },
  UMM_QURA: { fajrAngle: 18.5, ishaAngle: null, ishaMinutesAfterMaghrib: 90 },
  EGYPTIAN: { fajrAngle: 19.5, ishaAngle: 17.5, ishaMinutesAfterMaghrib: null },
  KARACHI: { fajrAngle: 18, ishaAngle: 18, ishaMinutesAfterMaghrib: null },
}

const LAT = Number(process.env.HASANAT_CITY_LAT ?? -26.2041)
const LON = Number(process.env.HASANAT_CITY_LON ?? 28.0473)
const TZ = Number(process.env.HASANAT_CITY_TZ ?? 2)
const CITY = process.env.HASANAT_CITY_NAME ?? 'Johannesburg'

const RAD = Math.PI / 180

function fix(a: number, b: number): number {
  a = a - b * Math.floor(a / b)
  return a < 0 ? a + b : a
}

function sunPos(jd: number): { decl: number; eqt: number } {
  const D = jd - 2451545.0
  const g = fix(357.529 + 0.98560028 * D, 360)
  const q = fix(280.459 + 0.98564736 * D, 360)
  const L = fix(q + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD), 360)
  const e = 23.439 - 0.00000036 * D
  const RA = fix(Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) / RAD / 15, 24)
  return { decl: Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) / RAD, eqt: q / 15 - RA }
}

function jdate(y: number, m: number, d: number): number {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

function cityNow(): Date {
  const d = new Date()
  return new Date(d.getTime() + (d.getTimezoneOffset() + TZ * 60) * 60000)
}

function calcTimes(dt: Date, method: CalcMethod, madhab: Madhab): PrayerTime[] {
  const y = dt.getFullYear()
  const m = dt.getMonth() + 1
  const d = dt.getDate()
  const sp = sunPos(jdate(y, m, d))
  const decl = sp.decl
  const lat = LAT
  const dh = 12 - LON / 15 - sp.eqt + TZ
  const cfg = METHODS[method]

  function T(ang: number): number {
    const v = (-Math.sin(ang * RAD) - Math.sin(lat * RAD) * Math.sin(decl * RAD)) /
      (Math.cos(lat * RAD) * Math.cos(decl * RAD))
    return Math.acos(Math.max(-1, Math.min(1, v))) / RAD / 15
  }
  function A(f: number): number {
    return T(-Math.atan(1 / (f + Math.tan(Math.abs(lat - decl) * RAD))) / RAD)
  }
  function hm(h: number): string {
    h = fix(h, 24)
    let H = Math.floor(h)
    let M = Math.round((h - H) * 60)
    if (M === 60) { H++; M = 0 }
    return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`
  }
  function hmParts(h: number): [number, number] {
    h = fix(h, 24)
    let H = Math.floor(h)
    let M = Math.round((h - H) * 60)
    if (M === 60) { H++; M = 0 }
    return [H, M]
  }
  function addMin(h: number, mins: number): string {
    return hm(h + mins / 60)
  }

  const asrStandard = hmParts(dh + A(1))
  const asrHanafi = hmParts(dh + A(2))
  const maghribTime = hm(dh + T(0.833))

  // Isha: angle-based or fixed minutes after Maghrib
  let ishaTime: string
  if (cfg.ishaAngle !== null) {
    ishaTime = hm(dh + T(cfg.ishaAngle))
  } else {
    // Fixed minutes after Maghrib (e.g. Umm al-Qura: 90 min)
    const [mh, mm] = maghribTime.split(':').map(Number)
    ishaTime = addMin(mh + mm / 60, cfg.ishaMinutesAfterMaghrib ?? 90)
  }

  // Asr: primary time depends on madhab; the other is shown as secondary
  const asrPrimary = madhab === 'hanafi' ? hm(dh + A(2)) : hm(dh + A(1))
  const asrSecondary = madhab === 'hanafi' ? hm(dh + A(1)) : hm(dh + A(2))

  return [
    { name: 'Fajr', time: hm(dh - T(cfg.fajrAngle)) },
    { name: 'Sunrise', time: hm(dh - T(0.833)) },
    { name: 'Dhuhr', time: hm(dh) },
    { name: 'Asr', time: asrPrimary, asrHanafi: asrSecondary },
    { name: 'Maghrib', time: maghribTime },
    { name: 'Isha', time: ishaTime },
  ]
}

// Hijri date via the built-in ICU Islamic calendar (Umm al-Qura aligned).
const HIJRI_MONTHS = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah']
function toHijri(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric',
    }).formatToParts(date)
    const day = parts.find((p) => p.type === 'day')?.value ?? '1'
    const monthNum = Number(parts.find((p) => p.type === 'month')?.value ?? '1') - 1
    const year = parts.find((p) => p.type === 'year')?.value ?? '1448'
    return `${day} ${HIJRI_MONTHS[monthNum] ?? 'Muharram'} ${year} AH`
  } catch {
    // Fallback: simple approximation if Intl lacks the islamic-umalqura calendar.
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    const a = Math.floor((14 - m) / 12)
    const yy = y + 4800 - a
    const mm = m + 12 * a - 3
    const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
    const year = Math.floor((jdn - 1948440) / 354.367) + 1
    const dayOfYear = jdn - 1948440 - Math.floor((year - 1) * 354.367)
    let month = 0
    let rem = dayOfYear
    for (let i = 0; i < 12; i++) {
      const ml = i % 2 === 0 ? 30 : 29
      if (rem < ml) break
      rem -= ml
      month++
    }
    return `${rem + 1} ${HIJRI_MONTHS[month]} ${year} AH`
  }
}

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 3600 + m * 60
}

export function getSchedule(method: CalcMethod = 'MWL', madhab: Madhab = 'standard'): PrayerSchedule {
  const now = cityNow()
  const times = calcTimes(now, method, madhab)
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()

  let nextIndex = 0
  let secondsUntilNext = 0
  let found = false
  for (let i = 0; i < times.length; i++) {
    const t = parseHHMM(times[i].time)
    if (t > nowSec) {
      nextIndex = i
      secondsUntilNext = t - nowSec
      found = true
      break
    }
  }
  if (!found) {
    // Past Isha — next is tomorrow's Fajr
    nextIndex = 0
    secondsUntilNext = 86400 - nowSec + parseHHMM(times[0].time)
  }

  return {
    date: now.toISOString().slice(0, 10),
    hijri: toHijri(now),
    city: CITY,
    times,
    nextIndex,
    secondsUntilNext,
    nextName: times[nextIndex].name,
    method,
    madhab,
  }
}
