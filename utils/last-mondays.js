module.exports = () => {

  const today = (new Date());
  const onedayMS = 1000 * 60 * 60 * 24;
  const todayDay = today.getDay();
  let todayDayFromMonday;
  switch (todayDay) {
    case 0:
      todayDayFromMonday = 6;
      break;
    default:
      todayDayFromMonday = todayDay - 1;
  }
  const lastMondays = {};
  lastMondays['1'] = (new Date(Date.parse(today) - onedayMS * todayDayFromMonday)).toISOString().slice(0, 10);
  for (let i = 2; i <= 10; i++) {
    lastMondays[i] = (new Date(Date.parse(lastMondays[i-1]) - onedayMS * 7)).toISOString().slice(0, 10);
  }

  return lastMondays;
};