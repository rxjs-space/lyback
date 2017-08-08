const co = require('co');
const dbX = require('../../db');
const getLastMondays = require('../../utils/last-mondays');

const getDaysAgoDate = require('../../utils').getDaysAgoDate;

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
      case req.query.title === 'inputDone':
        const days = req.query.days * 1;
        let resultInputDone = yield db.collection('inventory').aggregate([
          {'$project': {
            'typeId': 1,
            'inputDate': {
              '$substr': ['$inputDate', 0, 10]
            },
            'isFromDismantling': {
              '$cond': { 
                if: { '$gt': [ { '$ifNull': [ '$vin', ''] }, '' ] }, 
                then: true,
                else: false 
              }
            }
          }},
          {'$match': {
            'inputDate': {'$gt': `${getDaysAgoDate(new Date(), days)}`}
          }},
          {
            '$group': {
              '_id': {
                'typeId': '$typeId',
                'inputDate': '$inputDate',
                'isFromDismantling': '$isFromDismantling'
              },
              'total': { '$sum': 1 }
            }
          }
        ]).toArray();
        result = resultInputDone.map(r => ({
          typeId: r._id.typeId,
          inputDate: r._id.inputDate,
          isFromDismantling: r._id.isFromDismantling,
          total: r.total
        }));
        break;
    }

    res.json(result);
  }).catch(err => {
    return res.status(500).json(err.stack);
  });

}