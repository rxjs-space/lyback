module.exports = () => {

  const today = (new Date());
  const onedayMS = 1000 * 60 * 60 * 24;
  const todayDay = today.getDay();
  const lastSundays = {};
  if (todayDay > 0) {
    lastSundays['1'] = (new Date(Date.parse(today) - onedayMS * todayDay)).toISOString().slice(0, 10);
  } else {
    lastSundays['1'] = (new Date(Date.parse(today) - onedayMS * 7)).toISOString().slice(0, 10);
  };
  for (let i = 2; i <= 10; i++) {
    lastSundays[i] = (new Date(Date.parse(lastSundays[i-1]) - onedayMS * 7)).toISOString().slice(0, 10);
  }
  // lastSundays['2'] = (new Date(Date.parse(lastSundays['1']) - onedayMS * 7)).toISOString().slice(0, 10);

  return lastSundays;
};