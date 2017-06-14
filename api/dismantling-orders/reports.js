const co = require('co');
const dbX = require('../../db');

module.exports = (req, res) => {
  const today = (new Date());
  const onedayMS = 1000 * 60 * 60 * 24;
  const todayDay = today.getDay();
  let lastSundaySlice10;
  if (todayDay > 0) {
    lastSundaySlice10 = (new Date(Date.parse(today) - onedayMS * todayDay)).toISOString().slice(0, 10);
  } else {
    lastSundaySlice10 = (new Date(Date.parse(today) - onedayMS * 7)).toISOString().slice(0, 10);
  };
  const lastLastSundaySlice10 = (new Date(Date.parse(lastSundaySlice10) - onedayMS * 7)).toISOString().slice(0, 10);
  console.log(lastSundaySlice10, lastLastSundaySlice10);
  const reduceFunction =
  `
    function(curr, result) {
      if (curr.entranceDate > '${lastSundaySlice10}') {result.thisWeek++; }
      if (curr.entranceDate <= '${lastSundaySlice10}' && curr.entranceDate > '${lastLastSundaySlice10}') {result.lastWeek++; }
      if (curr.entranceDate <= '${lastLastSundaySlice10}') {result.evenEarlier++; }
      result.total++;
    }
  `;
  console.log(reduceFunction);
  co(function*() {
    const db = yield dbX.dbPromise;
    const result = yield db.collection('vehicles').group(
      ['vehicle.vehicleType'], 
      {'dismantling': false, 'status.dismantled.done': false}, 
      {'thisWeek': 0, 'lastWeek': 0, 'evenEarlier': 0, 'total': 0},
      reduceFunction
    )
    res.json(result);
  }).catch((error) => {
    return res.status(500).json(error.stack);
  })
}