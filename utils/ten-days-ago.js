module.exports = (startDay) => {
  if (!startDay) {
    startDay = (new Date());
  }
  const onedayMS = 1000 * 60 * 60 * 24;
  const tenDaysAgo = (new Date(Date.parse(startDay) - onedayMS * 10));
  const tenDaysAgoDate = tenDaysAgo.toISOString().slice(0, 10);
  return tenDaysAgoDate;
};