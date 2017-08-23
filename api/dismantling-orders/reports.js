const co = require('co');
const dbX = require('../../db');
const getLastSundays = require('../../utils/last-sundays');
const getTenDaysAgo = require('../../utils/ten-days-ago');
const getDaysAgoDate = require('../../utils').getDaysAgoDate;
const calculateBeijingDateShort = require('../../utils').calculateBeijingDateShort;

const startDay = (new Date());
const onedayMS = 1000 * 60 * 60 * 24;
const nineDaysAgo = (new Date(Date.parse(startDay) - onedayMS * 9));
const nineDaysAgoDate = nineDaysAgo.toISOString().slice(0, 10);
const tenDaysAgo = getDaysAgoDate(new Date(), 10);
// console.log(tenDaysAgo);
module.exports = (req, res) => {
  let result;
  const lastSundays = getLastSundays();


  co(function*() {
    const db = yield dbX.dbPromise;

    switch (req.query.title) {
      case 'operational':
        let resultIdle = yield db.collection('vehicles').aggregate([
          {'$match': {
            '$or': [
              {
                'status2.dismantlingOrderId': {'$exists': false},
                'status.dismantled.done': false,
              },
              {
                'status2.dismantlingOrderId': '',
                'status.dismantled.done': false,
              },

            ]
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
              'isDismantlingReady':'$status2.isDismantlingReady',
            },
            'thisWeek': {'$sum': {'$cond': [
              {'$gt': ['$entranceDate', lastSundays['1']]}, 1, 0
            ]}},
            'lastWeek': {'$sum': {'$cond': [
              {'$lte': ['$entranceDate', lastSundays['1']]}, {'$cond': [
                {'$gt': ['$entranceDate', lastSundays['2']]}, 1, 0
              ]}, 0
            ]}},
            'evenEarlier': {'$sum': {'$cond': [
              {'$lte': ['$entranceDate', lastSundays['2']]}, 1, 0
            ]}},
            'total': { '$sum': 1 }
          }}
        ]).toArray();

        resultIdle = resultIdle.map(r => {
          return {
            'vehicle.vehicleType': r._id['vehicleType'],
            'status2.isDismantlingReady': r._id['isDismantlingReady'],
            thisWeek: r.thisWeek,
            lastWeek: r.lastWeek,
            evenEarlier: r.evenEarlier,
            total: r.total,
          }
        })

        let resultProgressing = yield db.collection('dismantlingOrders').aggregate([
          {'$match': { 'completedAt': '' }},
          {'$group': 
            {
              '_id': {
                'vehicleType': '$vehicleType',
                'orderType': '$orderType',
                'started': {
                  '$gt': [ { '$ifNull': [ '$startedAt', ''] }, ''  ]
                }
              },
              'thisWeek': {'$sum': {'$cond': [
                {'$gt': ['$orderDate', lastSundays['1']]}, 1, 0
              ]}},
              'lastWeek': {'$sum': {'$cond': [
                {'$gt': ['$orderDate', lastSundays['2']]}, {'$cond': [
                  {'$lte': ['$orderDate', lastSundays['1']]}, 1, 0
                ]}, 0
              ]}},
              'evenEarlier': {'$sum': {'$cond': [
                {'$lte': ['$orderDate', lastSundays['2']]}, 1, 0
              ]}},
              'total': { '$sum': 1 }
            }
          }
        ]).toArray();

        resultProgressing = resultProgressing.map(r => {
          return {
            vehicleType: r._id.vehicleType,
            orderType: r._id.orderType,
            started: r._id.started,
            thisWeek: r.thisWeek,
            lastWeek: r.lastWeek,
            evenEarlier: r.evenEarlier,
            total: r.total
          }
        })

        let resultCompletedLastTenDays = yield db.collection('dismantlingOrders').aggregate([
          {'$project': {
            'vehicleType': 1,
            'orderType': 1,
            'completedAt': {
              '$substr': ['$completedAt', 0, 10]
            }
          }},
          {'$match': {
            'completedAt': {'$gte': `${nineDaysAgoDate}`}
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicleType',
              'orderType': '$orderType',
              'completedDate': '$completedAt'
            },
            'total': {'$sum': 1}
          }}
        ]).toArray();

        resultCompletedLastTenDays = resultCompletedLastTenDays.map(r => ({
          vehicleType: r._id.vehicleType,
          orderType: r._id.orderType,
          completedDate: r._id.completedDate,
          total: r.total
        }));
        let resultCompletedLastTenDays2 = yield db.collection('dismantlingOrders').aggregate([
          {'$match': {
            'completedAt': {'$gte': `${tenDaysAgo}T16:00:00.000Z`}
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicleType',
              'orderType': '$orderType',
              'completedAt': '$completedAt'
            },
            'total': {'$sum': 1}
          }}
        ]).toArray();

        resultCompletedLastTenDays2 = resultCompletedLastTenDays2.map(r => ({
          vehicleType: r._id.vehicleType,
          orderType: r._id.orderType,
          completedDate: calculateBeijingDateShort(r._id.completedAt),
          total: r.total
        }));
        // by now, the result is grouped by long date (complatedAt), need to group them with short date
        resultCompletedLastTenDays2 = resultCompletedLastTenDays2.reduce((acc, curr) => {
          const existingItem = acc.find(item => 
            (item.vehicleType === curr.vehicleType) &&
            (item.orderType === curr.orderType) &&
            (item.completedDate === curr.completedDate)
          );
          if (existingItem) {
            existingItem.total += curr.total;
          } else {
            acc.push(curr);
          }
          return acc;
        }, [])

        result = {
          idle: resultIdle,
          progressing: resultProgressing,
          // completed: resultCompletedLastTenDays,
          completed: resultCompletedLastTenDays2
        };
        break;
      case 'dailyClearYesterday':
        const today = new Date();
        const yesterday = new Date(Date.parse(today) - onedayMS );
        const theDayBeforeYesterday = new Date(Date.parse(today) - onedayMS * 2 );
        const uDate = today.getUTCDate();
        const uHours = today.getUTCHours();

        // over 16	UTCDate -1/UCTH8 ~UTCDate/UTCH8
        // below 16	UTCDate -2/UCTH8 ~UTCDate -1 /UTCH8

        let startISOString, endISOString, theDayBeforeYesterdayDate, yesterdayDate;
        if (uHours >= 16) { // UTC 16 o'clock is 0 o'clock for beijing
          startISOString = (new Date(Date.UTC(
            yesterday.getUTCFullYear(),
            yesterday.getUTCMonth(),
            yesterday.getUTCDate(),
            8 // UTC 8 o'clock is 16 o'clock for beijing
          ))).toISOString();
          endISOString = (new Date(Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate(),
            8
          ))).toISOString();
        } else {
          startISOString = (new Date(Date.UTC(
            theDayBeforeYesterday.getUTCFullYear(),
            theDayBeforeYesterday.getUTCMonth(),
            theDayBeforeYesterday.getUTCDate(),
            8
          ))).toISOString();
          endISOString = (new Date(Date.UTC(
            yesterday.getUTCFullYear(),
            yesterday.getUTCMonth(),
            yesterday.getUTCDate(),
            8
          ))).toISOString();
        }
        theDayBeforeYesterdayDate = startISOString.substring(0, 10);
        yesterdayDate = endISOString.substring(0, 10);

        console.log(startISOString, endISOString, theDayBeforeYesterdayDate);
        let resultVehicleIsDismantlingReadyWithDismantlingOrder = yield db.collection('vehicles').aggregate([
          {'$match': {
            '$and': [
              {'status2.isDismantlingNotReadyTill': {'$gte': startISOString}},
              {'status2.isDismantlingNotReadyTill': {'$lt': endISOString}},
            ]
          }},
          {'$project': {
            'vehicle.vehicleType': 1,
            'hasDismantlingOrder': {
              '$ne': ['$status2.dismantlingOrderId', '']
            }
          }},
          {'$group': {
            '_id': {
              'vehicleType': '$vehicle.vehicleType',
              'hasDismantlingOrder': '$hasDismantlingOrder'
            },
            'total': {'$sum': 1}
          }}
        ]).toArray();
        resultVehicleIsDismantlingReadyWithDismantlingOrder = resultVehicleIsDismantlingReadyWithDismantlingOrder.reduce((acc, curr) => {
          const vehicleType = curr['_id']['vehicleType'];
          const otherKeyName = curr['_id']['hasDismantlingOrder'] ? 'hasDismantlingOrder' : 'noDismantlingOrder';
          const subTotal = curr['total']
          const existingItem = acc.find(item => item.vehicleType === vehicleType);
          const totalItem = acc.find(item => item.vehicleType === 'total');
          if (existingItem) {
            existingItem[otherKeyName] = subTotal;
            existingItem['total'] += subTotal;
          } else {
            acc.push({
              startISOString,
              vehicleType,
              [otherKeyName]: subTotal,
              total: subTotal
            })
          }
          totalItem[otherKeyName] += subTotal;
          totalItem['total'] += subTotal;
          return acc;
        }, [{startISOString, vehicleType: 'total', hasDismantlingOrder: 0, noDismantlingOrder: 0, total: 0}]);
        
        let resultNormalDismantlingOrdersPlacedTheDayBeforeYesterday = yield db.collection('dismantlingOrders').aggregate([
          {'$match': {
            'orderDate': theDayBeforeYesterdayDate,
            'orderType': 'dot1'
          }},
          {'$project': {
            'started': {'$ne': ['$startedAt', '']},
            'completed': {'$ne': ['$completedAt', '']},
          }},
          {'$group': {
            '_id': {
              'started': '$started',
              'completed': '$completed'
            },
            'total': {'$sum': 1}
          }}
        ]).toArray();
        resultNormalDismantlingOrdersPlacedTheDayBeforeYesterday = resultNormalDismantlingOrdersPlacedTheDayBeforeYesterday.reduce((acc, curr) => {
          const started = curr['_id']['started'];
          const completed = curr['_id']['completed'];
          const subTotal = curr['total'];
          acc.total += subTotal;
          switch (true) {
            case !started:
              acc.notStarted += subTotal; break;
            case completed:
              acc.completed += subTotal; break;
            default:
              acc.startedNotCompleted += subTotal; break;
          }
          return acc;
        }, {
          orderDate: theDayBeforeYesterdayDate, 
          notStarted: 0, startedNotCompleted: 0, completed: 0, total: 0
        });
        let resultPreDismantlingOrdersPlacedYesterday = yield db.collection('dismantlingOrders').aggregate([
          {'$match': {
            'orderDate': yesterdayDate,
            'orderType': 'dot3'
          }},
          {'$project': {
            'started': {'$ne': ['$startedAt', '']},
            'completed': {'$ne': ['$completedAt', '']},
          }},
          {'$group': {
            '_id': {
              'started': '$started',
              'completed': '$completed'
            },
            'total': {'$sum': 1}
          }}
        ]).toArray();
        resultPreDismantlingOrdersPlacedYesterday = resultPreDismantlingOrdersPlacedYesterday.reduce((acc, curr) => {
          const started = curr['_id']['started'];
          const completed = curr['_id']['completed'];
          const subTotal = curr['total'];
          acc.total += subTotal;
          switch (true) {
            case !started:
              acc.notStarted += subTotal; break;
            case completed:
              acc.completed += subTotal; break;
            default:
              acc.startedNotCompleted += subTotal; break;
          }
          return acc;
        }, {
          orderDate: yesterdayDate,
          notStarted: 0, startedNotCompleted: 0, completed: 0, total: 0
        })
        result = {
          resultVehicleIsDismantlingReadyWithDismantlingOrder,
          resultNormalDismantlingOrdersPlacedTheDayBeforeYesterday,
          resultPreDismantlingOrdersPlacedYesterday
        }
        break;
    }
    res.json(result);
  }).catch((error) => {
    return res.status(500).json(error.stack);
  })
}