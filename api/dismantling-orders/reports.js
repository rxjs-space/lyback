const co = require('co');
const dbX = require('../../db');
const getLastSundays = require('../../utils/lastSundays');

module.exports = (req, res) => {
  // const today = (new Date());
  // const onedayMS = 1000 * 60 * 60 * 24;
  // const todayDay = today.getDay();
  // const lastSundays = {};
  // if (todayDay > 0) {
  //   lastSundays['1'] = (new Date(Date.parse(today) - onedayMS * todayDay)).toISOString().slice(0, 10);
  // } else {
  //   lastSundays['1'] = (new Date(Date.parse(today) - onedayMS * 7)).toISOString().slice(0, 10);
  // };
  // lastSundays['2'] = (new Date(Date.parse(lastSundays['1']) - onedayMS * 7)).toISOString().slice(0, 10);
  const lastSundays = getLastSundays();
  const reduceFunctionWaiting =
  `
    function(curr, result) {
      if (curr.entranceDate > '${lastSundays['1']}') {result.thisWeek++; }
      if (curr.entranceDate <= '${lastSundays['1']}' && curr.entranceDate > '${lastSundays['2']}') {result.lastWeek++; }
      if (curr.entranceDate <= '${lastSundays['2']}') {result.evenEarlier++; }
      result.total++;
    }
  `;
  const reduceFunctionDismantling =
  `
    function(curr, result) {
      if (curr.orderDate > '${lastSundays['1']}') {result.thisWeek++; }
      if (curr.orderDate <= '${lastSundays['1']}' && curr.orderDate > '${lastSundays['2']}') {result.lastWeek++; }
      if (curr.orderDate <= '${lastSundays['2']}') {result.evenEarlier++; }
      result.total++;
    }
  `;

  co(function*() {
    const db = yield dbX.dbPromise;
    const resultWaiting = yield db.collection('vehicles').group(
      ['vehicle.vehicleType', 'status.firstSurvey.done', 'status.secondSurvey.done'], 
      {'dismantling': false, 'status.dismantled.done': false, 'auctioning': false, 'status.sold.done': false}, 
      {'thisWeek': 0, 'lastWeek': 0, 'evenEarlier': 0, 'total': 0},
      reduceFunctionWaiting
    )
    const resultDismantling = yield db.collection('dismantlingOrders').group(
      ['vehicleType'], 
      {'completedAt': ''}, 
      {'thisWeek': 0, 'lastWeek': 0, 'evenEarlier': 0, 'total': 0},
      reduceFunctionDismantling
    )
    res.json({
      waiting: resultWaiting,
      dismantling: resultDismantling
    });
  }).catch((error) => {
    return res.status(500).json(error.stack);
  })
}