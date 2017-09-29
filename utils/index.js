const onedayMS = 1000 * 60 * 60 * 24;

exports.strContains = (string, search) => {
  return string.indexOf(search) > -1;
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