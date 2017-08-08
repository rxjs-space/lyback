exports.strContains = (string, search) => {
  return string.indexOf(search) > -1;
}


exports.getDaysAgoDate = (startDay, days) => {
  // startDay = new Date();
  const onedayMS = 1000 * 60 * 60 * 24;
  const daysAgoMS = new Date(Date.parse(startDay) - onedayMS * days);
  return daysAgoMS.toISOString().slice(0, 10);
}