/**
 * References:
 * Jean Meeus, Astronomical Algorithms, Willmann-Bell, 2nd edition, 1998
 * U.S. Naval Observatory: Explanatory Supplement to the Astronomical Almanac
 * NASA's lunar phase algorithm notes, sometimes used in calendars and software
 * Original Khmer Lunar Date by Danh Hong https://github.com/danhhong/khmer_lunar_date.git
 * Author: Mam Piseth (seth.razeth@gmail.com)
 * Date: 7/17/2025
 * Ported to TypeScript Class
 */

interface KhmerLunarDate {
  lunar_symbol: string;
  lunar_day: string;
  lunar_month: string;
  lunar_year: string;
  zodiac_year: string;
  stem: string;
}

class KhmerLunarCalendar {
  private readonly khmerDayString: Record<string, string> = {
    '1': '១កើត',
    '2': '២កើត',
    '3': '៣កើត',
    '4': '៤កើត',
    '5': '៥កើត',
    '6': '៦កើត',
    '7': '៧កើត',
    '8': '៨កើត',
    '9': '៩កើត',
    '10': '១០កើត',
    '11': '១១កើត',
    '12': '១២កើត',
    '13': '១៣កើត',
    '14': '១៤កើត',
    '15': '១៥កើត',
    '16': '១រោច',
    '17': '២រោច',
    '18': '៣រោច',
    '19': '៤រោច',
    '20': '៥រោច',
    '21': '៦រោច',
    '22': '៧រោច',
    '23': '៨រោច',
    '24': '៩រោច',
    '25': '១០រោច',
    '26': '១១រោច',
    '27': '១២រោច',
    '28': '១៣រោច',
    '29': '១៤រោច',
    '30': '១៥រោច',
  };

  private readonly khmerSymbols: Record<string, string> = {
    '0': '᧠',
    '1': '᧡',
    '2': '᧢',
    '3': '᧣',
    '4': '᧤',
    '5': '᧥',
    '6': '᧦',
    '7': '᧧',
    '8': '᧨',
    '9': '᧩',
    '10': '᧪',
    '11': '᧫',
    '12': '᧬',
    '13': '᧭',
    '14': '᧮',
    '15': '᧯',
    '00': '᧰',
    '16': '᧱',
    '17': '᧲',
    '18': '᧳',
    '19': '᧴',
    '20': '᧵',
    '21': '᧶',
    '22': '᧷',
    '23': '᧸',
    '24': '᧹',
    '25': '᧺',
    '26': '᧻',
    '27': '᧼',
    '28': '᧽',
    '29': '᧾',
    '30': '᧿',
  };

  private readonly khmerDayOfWeek: Record<string, string> = {
    Monday: 'ចន្ទ',
    Tuesday: 'អង្គារ',
    Wednesday: 'ពុធ',
    Thursday: 'ព្រហស្បតិ៍',
    Friday: 'សុក្រ',
    Saturday: 'សៅរ៍',
    Sunday: 'អាទិត្យ',
  };

  private readonly khmerDigits: Record<string, string> = {
    '0': '០',
    '1': '១',
    '2': '២',
    '3': '៣',
    '4': '៤',
    '5': '៥',
    '6': '៦',
    '7': '៧',
    '8': '៨',
    '9': '៩',
  };

  // Khmer month names (1-based index, 1=ចេត្រ, 2=ពិសាខ, etc.)
  private readonly KHMER_MONTHS: string[] = [
    'ចេត្រ',
    'ពិសាខ',
    'ជេស្ឋ',
    'អាសាឍ',
    'ស្រាពណ៍',
    'ភទ្របទ',
    'អស្សុជ',
    'កត្តិក',
    'មិគសិរ',
    'បុស្ស',
    'មាឃ',
    'ផល្គុន',
  ];

  // Khmer zodiac animals (12-year cycle, 0=ជូត, 1=ឆ្លូវ, etc.)
  private readonly KHMER_ZODIAC: string[] = [
    'ជូត',
    'ឆ្លូវ',
    'ខាល',
    'ថោះ',
    'រោង',
    'ម្សាញ់',
    'មមី',
    'មមែ',
    'វក',
    'រកា',
    'ច',
    'កុរ',
  ];

  // Khmer heavenly stems (10-year cycle, 0=ឯកស័ក, 1=ទោស័ក, etc.)
  private readonly KHMER_STEMS: string[] = [
    'ឯកស័ក',
    'ទោស័ក',
    'ត្រីស័ក',
    'ចត្វាស័ក',
    'បញ្ចស័ក',
    'ឆស័ក',
    'សប្តស័ក',
    'អដ្ឋស័ក',
    'នព្វស័ក',
    'សំរឹទ្ធិស័ក',
  ];

  private readonly timezone: number;

  constructor(timezone: number = 7.0) {
    this.timezone = timezone;
  }

  private replaceAll(text: string, dic: Record<string, string>): string {
    for (const [i, j] of Object.entries(dic)) {
      text = text.replace(new RegExp(i, 'g'), j);
    }
    return text;
  }

  // Validate Gregorian date
  public isValidDate(day: number, month: number, year: number): boolean {
    if (!(1 <= month && month <= 12)) {
      return false;
    }
    if (year < 1) {
      return false;
    }
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
      daysInMonth[1] = 29;
    }
    if (!(1 <= day && day <= daysInMonth[month - 1])) {
      return false;
    }
    return true;
  }

  // Convert Gregorian date to Julian Day Number (JDN)
  public gregorianToJd(day: number, month: number, year: number): number {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    const jd =
      day +
      Math.floor((153 * m + 2) / 5) +
      365 * y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400) -
      32045;
    return jd;
  }

  // Calculate the mean lunar month (synodic month, ~29.530588853 days)
  public getNewMoonDay(k: number): number {
    const T = k / 1236.85;
    let JDE =
      2451550.09766 +
      29.530588861 * k +
      0.00015437 * T ** 2 -
      0.00000015 * T ** 3 +
      0.00000000073 * T ** 4;
    JDE += this.timezone / 24.0;
    return Math.floor(JDE + 0.5);
  }

  // Calculate solar longitude for a given JDN
  public getSunLongitude(jd: number): number {
    const T = (jd - 2451545.0) / 36525.0;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T ** 2;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T ** 2;
    const MRad = (M * Math.PI) / 180;
    const C =
      (1.914602 - 0.004817 * T - 0.000014 * T ** 2) * Math.sin(MRad) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * MRad) +
      0.000289 * Math.sin(3 * MRad);
    const solarLong = (L0 + C) % 360;
    return solarLong;
  }

  // Determine if a lunar month is a leap month
  public isLeapMonth(jdStart: number, jdEnd: number): boolean {
    const longStart = this.getSunLongitude(jdStart);
    const longEnd = this.getSunLongitude(jdEnd);
    for (let i = 0; i < 12; i++) {
      const term = i * 30.0;
      if (
        (longStart <= term && term < longEnd) ||
        (longEnd < longStart && (longStart <= term || term < longEnd))
      ) {
        return false;
      }
    }
    return true;
  }

  // Calculate Khmer zodiac year
  public getKhmerZodiacYear(lunarYear: number): string {
    return this.KHMER_ZODIAC[(lunarYear - 2020) % 12];
  }

  // Calculate Khmer heavenly stem
  public getKhmerStem(year: number): string {
    return this.KHMER_STEMS[(year - 2019) % 10];
  }

  // Convert Gregorian date to Khmer lunar date
  public gregorianToKhmerLunar(
    day: number,
    month: number,
    year: number,
  ): KhmerLunarDate {
    if (!this.isValidDate(day, month, year)) {
      throw new Error('Invalid Gregorian date');
    }

    // Convert to JDN
    const jd = this.gregorianToJd(day, month, year);

    // Find the nearest new moon
    let k = Math.floor((jd - 2451545.0) / 29.530588853);
    let newMoonJd = this.getNewMoonDay(k);

    if (newMoonJd > jd) {
      k -= 1;
      newMoonJd = this.getNewMoonDay(k);
    } else if (this.getNewMoonDay(k + 1) <= jd) {
      k += 1;
      newMoonJd = this.getNewMoonDay(k);
    }

    let lunarDay = jd - newMoonJd + 1;
    if (lunarDay < 1) {
      k -= 1;
      newMoonJd = this.getNewMoonDay(k);
      lunarDay = jd - newMoonJd + 1;
    }

    // Determine lunar month and year
    // Use April 14 (approximate Khmer New Year) as reference
    const refYear = month > 4 || (month === 4 && day >= 14) ? year : year - 1;
    const jdRef = this.gregorianToJd(14, 4, refYear);
    const kRef = Math.floor((jdRef - 2451545.0) / 29.530588853);

    let monthCount = 0;
    let currentK = kRef;
    let currentNewMoon = this.getNewMoonDay(currentK);
    while (currentNewMoon <= newMoonJd) {
      monthCount += 1;
      currentK += 1;
      currentNewMoon = this.getNewMoonDay(currentK);
    }

    // Adjust for leap months
    let isLeap = false;
    const kStart = kRef;
    let tempMonthCount = 0;
    for (let i = 0; i < monthCount + 1; i++) {
      const monthStart = this.getNewMoonDay(kStart + i);
      const monthEnd = this.getNewMoonDay(kStart + i + 1);
      if (this.isLeapMonth(monthStart, monthEnd)) {
        if (i < monthCount) {
          tempMonthCount += 1;
        } else {
          isLeap = true;
        }
      }
      tempMonthCount += 1;
    }

    const lunarMonth = ((monthCount - 1) % 12) + 1;
    const lunarYear =
      month > 4 || (month === 4 && day >= 14) ? year + 544 : year + 543;

    let monthName = this.KHMER_MONTHS[lunarMonth - 1];
    if (isLeap) {
      monthName += ' (Leap)';
    }

    const zodiacYear = this.getKhmerZodiacYear(year);
    const stem = this.getKhmerStem(year);

    const lunarYearStr = this.replaceAll(
      lunarYear.toString(),
      this.khmerDigits,
    );

    return {
      lunar_symbol: this.khmerSymbols[lunarDay.toString()],
      lunar_day: this.khmerDayString[lunarDay.toString()],
      lunar_month: monthName,
      lunar_year: lunarYearStr,
      zodiac_year: zodiacYear,
      stem: stem,
    };
  }

  // Get formatted Khmer lunar date string for a specific date
  public getKhmerLunarDateString(
    day: number,
    month: number,
    year: number,
  ): string {
    const date = new Date(year, month - 1, day);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const khmerDayName = this.khmerDayOfWeek[dayName];

    const result = this.gregorianToKhmerLunar(day, month, year);
    return `ថ្ងៃ${khmerDayName} ${result.lunar_day} ខែ${result.lunar_month} ឆ្នាំ${result.zodiac_year} ${result.stem} ព.ស. ${result.lunar_year}`;
  }

  // Get formatted Khmer lunar date string for today
  public getTodayKhmerLunarDate(): string {
    const today = new Date();
    const dd = today.getDate();
    const mm = today.getMonth() + 1;
    const yyyy = today.getFullYear();

    return this.getKhmerLunarDateString(dd, mm, yyyy);
  }

  // Static method to create instance and get today's date quickly
  public static getTodayDate(timezone: number = 7.0): string {
    const calendar = new KhmerLunarCalendar(timezone);
    return calendar.getTodayKhmerLunarDate();
  }
}

// Example usage
if (typeof window === 'undefined') {
  // Node.js environment
  const calendar = new KhmerLunarCalendar();
  console.log(calendar.getTodayKhmerLunarDate());

  // Example with specific date
  console.log(calendar.getKhmerLunarDateString(16, 7, 2025));

  // Quick static method
  console.log(KhmerLunarCalendar.getTodayDate());
} else {
  // Browser environment
  const calendar = new KhmerLunarCalendar();
  console.log(calendar.getTodayKhmerLunarDate());
}

// Export for use in other modules
export { KhmerLunarCalendar, type KhmerLunarDate };
