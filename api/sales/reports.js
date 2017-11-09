const co = require('co');
const dbX = require('../../db');
const getDaysAgoDate = require('../../utils').getDaysAgoDate;
const getRecentDates = require('../../utils').getRecentDates;
const getRecentWeekNumbers = require('../../utils').getRecentWeekNumbers;
const getLastMondayDates = require('../../utils').getLastMondayDates;

module.exports = (req, res) => {
  let result;
  co(function*() {
    const db = yield dbX.dbPromise;

    switch (req.query.title) {
      case 'recent':
        const now = new Date();
        const sevenDaysAgoDate = getDaysAgoDate(now, 7);

        let recentSevenDays = yield db.collection('salesOrders').aggregate([
          {$match: {
            'deleted': false,
            'createdAt': {$gte: new Date(`${sevenDaysAgoDate}T16:00:00.000Z`)},
          }},
          {$project: {
            'discountPercent': 1,
            'products': 1,
            'createdAtBeijingTime': {$add: ['$createdAt', 1000 * 60 * 60 * 8]}
          }},
          {$unwind: '$products'},
          {$group: {
            _id: '$_id',
            createdAtBeijingTime: {$first: '$createdAtBeijingTime'},
            discountPercent: {$first: '$discountPercent'},
            amount: {$sum: '$products.price'}
          }},
          {$project: {
            '_id': 1,
            'createdAtBeijingTime': 1,
            'amount': {$ceil: {$multiply: [
              {$subtract: [
                1, 
                {$divide: ['$discountPercent', 100]},
              ]},
              '$amount'
            ]}},
          }},
          {$group: {
            _id: {
              createdAtBeijingDate: {$dateToString: {format: '%Y-%m-%d', date: '$createdAtBeijingTime'}}
            },
            count: {$sum: 1},
            amount: {$sum: '$amount'}
          }},
        ]).toArray();

        recentSevenDays = recentSevenDays.reduce((acc, curr) => {
          const countItem = acc.find(item => item.type === 'count');
          const amountItem = acc.find(item => item.type === 'amount');
          const currDate = curr._id.createdAtBeijingDate;
          countItem[currDate] = curr.count;
          countItem['total'] = curr.count + (countItem['total'] ? countItem['total'] : 0);
          amountItem[currDate] = curr.amount;
          amountItem['total'] = curr.amount + (amountItem['total'] ? amountItem['total'] : 0);
          return acc;
        }, [
          {type: 'count'},
          {type: 'amount'},
        ]);

        const lastMondayDate = getLastMondayDates(1)[0];
        const fiveWeeksAgoMondayDate = getDaysAgoDate(new Date(lastMondayDate), 29);
        const dateBeginning = new Date(`${fiveWeeksAgoMondayDate}T16:00:00.000Z`);
        let recentFiveWeeks = yield db.collection('salesOrders').aggregate([
          {$match: {
            'deleted': false,
            'createdAt': {$gte: dateBeginning},
          }},
          {$project: {
            'discountPercent': 1,
            'products': 1,
            'createdAtBeijingTime': {$add: ['$createdAt', 1000 * 60 * 60 * 8]}
          }},
          {$unwind: '$products'},
          {$group: {
            _id: '$_id',
            createdAtBeijingTime: {$first: '$createdAtBeijingTime'},
            discountPercent: {$first: '$discountPercent'},
            amount: {$sum: '$products.price'}
          }},
          {$project: {
            '_id': 1,
            'createdAtBeijingTime': 1,
            'amount': {$ceil: {$multiply: [
              {$subtract: [
                1, 
                {$divide: ['$discountPercent', 100]},
              ]},
              '$amount'
            ]}},
          }},          
          {$group: {
            _id: {
              createdAtBeijingWeek: {$dateToString: {format: '%V', date: '$createdAtBeijingTime'}}
            },
            count: {$sum: 1},
            amount: {$sum: '$amount'}
          }},
        ]).toArray();

        recentFiveWeeks = recentFiveWeeks.reduce((acc, curr) => {
          const countItem = acc.find(item => item.type === 'count');
          const amountItem = acc.find(item => item.type === 'amount');
          const currWeek = curr._id.createdAtBeijingWeek;
          countItem[currWeek] = curr.count;
          countItem['total'] = curr.count + (countItem['total'] ? countItem['total'] : 0);
          amountItem[currWeek] = curr.amount;
          amountItem['total'] = curr.amount + (amountItem['total'] ? amountItem['total'] : 0);
          return acc;
        }, [
          {type: 'count'},
          {type: 'amount'},
        ]);
        // recentFiveWeeks = recentFiveWeeks.reduce((acc, curr) => {
        //   const currWeek = curr._id.dismantledAtBeijingWeek
        //   const thatItem = {
        //     vehicleType: curr._id.vehicleType,
        //     [currWeek]: curr.count      
        //   };
        //   acc.push(thatItem);
        //   const subtotalItemInAcc = acc.find(item => item.vehicleType === 'subtotal');
        //   if (subtotalItemInAcc[currWeek]) {
        //     subtotalItemInAcc[currWeek] += curr.count;
        //   } else {
        //     subtotalItemInAcc[currWeek] = curr.count;
        //   }
        //   return acc;
        // }, [{vehicleType: 'subtotal'}]);

        result = {
          reports: {
            recentSevenDays,
            recentFiveWeeks
          },
          columns: {
            recentSevenDays: getRecentDates(now, 7),
            recentFiveWeeks: getRecentWeekNumbers(now, 5)
          }
        }
        break;
    }
    res.json(result);
  }).catch((error) => {
    return res.status(500).json(error.stack);
  })
}