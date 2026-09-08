const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** First work-start Monday; subsequent starts are every 7 days. */
const ANCHOR_WORK_START = new Date(2026, 6, 13);

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function ordinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Next upcoming work-start date (strictly after today once the current one is reached). */
export function getNextWorkStartDate(from: Date = new Date()): Date {
  const today = startOfDay(from);
  let workStart = startOfDay(ANCHOR_WORK_START);

  while (workStart <= today) {
    workStart = addDays(workStart, 7);
  }

  return workStart;
}

/** Orientation is always the Saturday two days before work starts. */
export function getOrientationDate(from: Date = new Date()): Date {
  return addDays(getNextWorkStartDate(from), -2);
}

export function formatOrientationDateText(from: Date = new Date()): string {
  const workStart = getNextWorkStartDate(from);
  const orientation = getOrientationDate(from);

  const orientationMonth = MONTH_NAMES[orientation.getMonth()];
  const workMonth = MONTH_NAMES[workStart.getMonth()].toLowerCase();

  return (
    `Saturday, ${ordinal(orientation.getDate())} ${orientationMonth} ${orientation.getFullYear()} ` +
    `work starts ${ordinal(workStart.getDate())} ${workMonth} 8am`
  );
}
