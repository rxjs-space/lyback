const moment = require('moment');

const onedayMS = 1000 * 60 * 60 * 24;

exports.strContains = (string, search) => {
  return string.indexOf(search) > -1;
}

exports.getMondayOfTheWeek = (weekNumber) => {
  const currentBeijingTime = new Date(Date.parse(new Date()) + 1000 * 60 * 60 * 8);
  const currentWeekNumber = moment(currentBeijingTime).isoWeeks();
  const currentYear = currentBeijingTime.getFullYear();
  const year = (currentWeekNumber < weekNumber) ? (currentYear -  1) : currentYear;
  const mondayHalfDone = moment().isoWeekday('Monday').year(year).week(weekNumber).toDate();
  return new Date(Date.parse(mondayHalfDone.toISOString().substring(0, 10)) - 1000 * 60 * 60 * 8);
}

exports.getDaysAgoDate = (startDay, days) => {
  // startDay = new Date();
  const uHours = startDay.getUTCHours();
  const daysAgoMS = uHours >= 16 ? new Date(Date.parse(startDay) - onedayMS * (days-1)) : new Date(Date.parse(startDay) - onedayMS * days);
  return daysAgoMS.toISOString().slice(0, 10);
}

exports.calculateBeijingDateShort = (ISODateString) => {
  const thatDate = new Date(ISODateString);
  const uHours = thatDate.getUTCHours();
  const beijingDate = uHours >= 16 ? new Date(Date.parse(thatDate) + onedayMS) : thatDate;
  return beijingDate.toISOString().slice(0, 10);
}

exports.getRecentDates = (countFromDay, days) => {
  const recentDates = [];
  for (let i = 0; i < days; i++) {
    recentDates.unshift(this.getDaysAgoDate(countFromDay, i));
  }
  return recentDates;
}

exports.getRecentWeekNumbers = (countFromDay, weeks) => {
  const beijingTimeNow = new Date(Date.parse(countFromDay) + 1000 * 60 * 60 * 8);
  const recentWeekNumbers = [];
  for (let i = 0; i < weeks; i++) {
    const beijingTimeThen = new Date(Date.parse(beijingTimeNow) - i * 1000 * 60 * 60 * 24 * 7);
    recentWeekNumbers.unshift(moment(beijingTimeThen).isoWeeks());
  }
  return recentWeekNumbers;
}

exports.getLastMondayDates = (count = 10, timeZoneOffset = 8) => {
  const today = new Date();
  const uHours = today.getUTCHours();
  const todayOffset = new Date(Date.parse(today) + 1000 * 60 * 60 * timeZoneOffset);
  const todayDay = todayOffset.getUTCDay();
  let todayDayFromMonday;
  switch (todayDay) {
    case 0:
      todayDayFromMonday = 6;
      break;
    default:
      todayDayFromMonday = todayDay - 1;
  }
  const lastMondayDates = [];
  const latestMonday = (new Date(Date.parse(todayOffset) - onedayMS * todayDayFromMonday));
  let i = 0;
  while (i < count) {
    const thatMondayDate = (new Date(Date.parse(latestMonday) - onedayMS * i * 7)).toISOString().slice(0, 10);
    lastMondayDates.unshift(thatMondayDate);
    i++;
  }
  return lastMondayDates;
};

exports.simpleEquals = (a, b) => {
  return a === b;
}