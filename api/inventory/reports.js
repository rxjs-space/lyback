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
        const groupObj = {
          '_id': {
            'typeId': '$typeId',
            // 'inputDate': '$inputDate',
            'isFromDismantling': '$isFromDismantling'
          },
          'total': { '$sum': 1 }
        };
        const day0 = new Date();
        for (let i = 9; i >= 0; i--) {
          const date = getDaysAgoDate(day0, i);
          groupObj[date] = {'$sum': {'$cond': [
              {'$eq': ['$inputDate', date]}, 1, 0
            ]}}
        };
        // console.log(groupObj);

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
            '$group': groupObj
          }
        ]).toArray();
        result = resultInputDone.reduce((acc, curr) => {
          console.log(curr);
          const isFromDismantling = curr._id.isFromDismantling;
          curr.typeId = curr._id.typeId;
          delete curr._id;
          if (isFromDismantling) {
            acc.isFromDismantling.push(curr);
          } else {
            acc.notFromDismantling.push(curr);
          }
          return acc;
        }, {isFromDismantling: [], notFromDismantling: []})
        // result = resultInputDone.map(r => ({
        //   typeId: r._id.typeId,
        //   inputDate: r._id.inputDate,
        //   isFromDismantling: r._id.isFromDismantling,
        //   total: r.total
        // }));
        break;
    }

    res.json(result);
  }).catch(err => {
    return res.status(500).json(err.stack);
  });

}