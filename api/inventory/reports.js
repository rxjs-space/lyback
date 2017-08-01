const co = require('co');
const dbX = require('../../db');
const getLastMondays = require('../../utils/last-mondays');
const getTenDaysAgo = require('../../utils/ten-days-ago');

module.exports = (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    // const ttQueryResult = yield db.collection('tt').find({name: 'types'}).toArray();
    // const vehicleTypeIdsForMotocycle = ttQueryResult[0]['vehicleTypeIdsForMotocycle'];
    const lastMondays = getLastMondays();
    let result;

    switch (true) {
      case req.query.title === 'inputReady':
        let resultInputReady = yield db.collection('dismantlingOrders').aggregate([
          {$match: {$or: [
            {'inventoryInputDone': false},
            {'inventoryInputDone': {
              $exists: false
            }}
          ]}},
          {$group: {
            _id: {
              "_id": "$_id",
              "orderType": "$orderType",
              "vin": "$vin",
            }
          }}
        ]).toArray();
        result = resultInputReady.map(r => ({
          _id: r._id._id,
          orderType: r._id.orderType,
          vin: r._id.vin
        }));
        break;
    }

    res.json(result);
  }).catch(err => {
    return res.status(500).json(err.stack);
  });

}