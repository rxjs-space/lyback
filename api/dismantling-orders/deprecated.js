/* 
const getLastSundays = require('../../utils/last-sundays');
const lastSundays = getLastSundays();
const calculateBeijingDateShort = require('../../utils').calculateBeijingDateShort;

const getTenDaysAgo = require('../../utils/ten-days-ago');

const nineDaysAgo = (new Date(Date.parse(startDay) - onedayMS * 9));
const nineDaysAgoDate = nineDaysAgo.toISOString().slice(0, 10);


      case 'operational':
        let resultIdle = yield db.collection('vehicles').aggregate([
          {'$match': {
            '$or': [
              {
                'status2.dismantlingOrderId': {'$exists': false},
                'status.dismantled.done': false,
                'metadata.isDeleted': false
              },
              {
                'status2.dismantlingOrderId': '',
                'status.dismantled.done': false,
                'metadata.isDeleted': false
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
            'completedAt': {'$gte': `${elevenDaysAgoDate}T16:00:00.000Z`}
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



*/