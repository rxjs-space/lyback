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
  const beijingDate = uHours >= 16 ? new Date(Date.parse(startDay) + onedayMS) : thatDate;
  return beijingDate.toISOString().slice(0, 10);
}
