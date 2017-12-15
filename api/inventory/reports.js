const co = require('co');
const dbX = require('../../db');
const getLastMondays = require('../../utils/last-mondays');

const getDaysAgoDate = require('../../utils').getDaysAgoDate;
const getRecentDates = require('../../utils').getRecentDates;
const getLastMondayDates = require('../../utils').getLastMondayDates;

module.exports = (req, res) => {
  const now = new Date();
  co(function*() {
    const db = yield dbX.dbPromise;
    // const ttQueryResult = yield db.collection('tt').find({name: 'types'}).toArray();
    // const vehicleTypeIdsForMotocycle = ttQueryResult[0]['vehicleTypeIdsForMotocycle'];
    const lastMondays = getLastMondays();
    let result;

    switch (true) {
      case req.query.title === 'inStockCount':
        let inStockCount = yield db.collection('inventory').aggregate([
          {$match: {
            'isInStock': true,
            'typeId': {$regex: '^p.*'}
          }},
          {$lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle'
          }},
          {$unwind: '$vehicle'},
          // {$lookup: {
          //   from: 'vtbmym',
          //   localField: "vtbmym",
          //   foreignField: "_id",
          //   as: "vtbmym"
          // }},
          // {$unwind: '$vtbmym'},
          {$group: {
            _id: {
              typeId: '$typeId',
              vehicleType: '$vehicle.vehicle.vehicleType',
            },
            count: {$sum: 1}
          }}
        ]).toArray();
        // result = inStockCount;
        result = inStockCount.reduce((acc, curr) => {
          const currTab = curr._id.vehicleType;
          const itemWithCurrTab = acc.find(item => item.tab === currTab);
          if (itemWithCurrTab) {
            itemWithCurrTab['data'][curr._id.typeId] = curr.count;
          } else {
            acc.push({
              tab: currTab,
              data: {
                [curr._id.typeId]: curr.count
              }
            })
          }
          return acc;
        }, []);
        break;
      case req.query.title === 'inStockAmount':
        const transform = (arrayOld) => {
          return arrayOld.map(item => ({
            typeId: item._id.typeId,
            count: item.count,
            amount: item.amount
          }));
        }
        let soldWithoutIdAmount = yield db.collection('salesOrders').aggregate([
          {$unwind: '$products'},
          {$match: {
            'products._id': '',
          }},
          {$group: {
            _id: {
              typeId: '$products.typeId',
            },
            count: {$sum: 1},
            amount: {$sum: '$products.price'}
          }}
        ]).toArray();
        let inStockAmountIntermediateWithoutPrice = yield db.collection('inventory').aggregate([
          {$match: {
            'isInStock': true,
            'group': part
          }},
          {$lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle'
          }},
          {$unwind: '$vehicle'},
          {$project: {
            'key': {$concat: [
              '$vehicle.vehicle.brand',
              '$vehicle.vehicle.model',
              '$typeId',
            ]},
            'typeId': 1,
            '_id': 0
          }},
          {$lookup: {
            from: 'pricesV2',
            localField: 'key',
            foreignField: 'key',
            as: 'price'
          }},
          {$unwind: {
            path: '$price',
            preserveNullAndEmptyArrays: true
          }},
          {$match: {
            'price': {$exists: false},
          }},
          {$group: {
            _id: {
              typeId: '$typeId',
            },
            count: {$sum: 1},
            amount: {$sum: '$price.number'}
          }}
        ]).toArray();
        let inStockAmountIntermediateWithPrice = yield db.collection('inventory').aggregate([
          {$match: {
            'isInStock': true,
            'group': part
          }},
          {$lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle'
          }},
          {$unwind: '$vehicle'},
          {$project: {
            'key': {$concat: [
              '$vehicle.vehicle.brand',
              '$vehicle.vehicle.model',
              '$typeId',
            ]},
            'typeId': 1,
            '_id': 0
          }},
          {$lookup: {
            from: 'pricesV2',
            localField: 'key',
            foreignField: 'key',
            as: 'price'
          }},
          {$unwind: {
            path: '$price',
            preserveNullAndEmptyArrays: true
          }},
          {$match: {
            'price': {$exists: true},
          }},
          {$group: {
            _id: {
              typeId: '$typeId',
            },
            count: {$sum: 1},
            amount: {$sum: '$price.number'}
          }}
        ]).toArray();
        soldWithoutIdAmount = transform(soldWithoutIdAmount);
        inStockAmountIntermediateWithoutPrice = transform(inStockAmountIntermediateWithoutPrice);
        inStockAmountIntermediateWithPrice = transform(inStockAmountIntermediateWithPrice);
        const calculateTotal = (soldWithoutId, inStockWithoutPrice, inStockWithPrice) => {
          // get an array of all the typeIds Set
          // combine three together, with a minus for soldWithoutId
          const typeIdsSet = new Set([
            ...soldWithoutId.map(i => i.typeId),
            ...inStockWithoutPrice.map(i => i.typeId),
            ...inStockWithPrice.map(i => i.typeId)
          ]);

          const arrayXToObj = (arrayX) => {
            return arrayX.reduce((acc, curr) => {
              acc[curr.typeId] = {count: curr.count, amount: curr.amount};
              return acc;
            }, {})
          }

          const soldWithoutIdObj = arrayXToObj(soldWithoutId);
          const inStockWithoutPriceObj = arrayXToObj(inStockWithoutPrice);
          const inStockWithPriceObj = arrayXToObj(inStockWithPrice);

          const getNumber = (obj, typeId, key) => {
            return obj[typeId] ? (obj[typeId][key] ? obj[typeId][key] : 0) : 0;
          }
          const inStock = Array.from(typeIdsSet).map(typeId => ({
            typeId,
            count: 
              getNumber(soldWithoutIdObj, typeId, ['count']) * (-1) + 
              getNumber(inStockWithoutPriceObj, typeId, ['count']) + 
              getNumber(inStockWithPriceObj, typeId, ['count']),
            amount: 
              getNumber(soldWithoutIdObj, typeId, ['amount']) * (-1) + 
              getNumber(inStockWithoutPriceObj, typeId, ['amount']) + 
              getNumber(inStockWithPriceObj, typeId, ['amount'])
          }));

          return inStock;
        };
        const inStock = calculateTotal(soldWithoutIdAmount, inStockAmountIntermediateWithoutPrice, inStockAmountIntermediateWithPrice);
        result = [
          {tab: 'inStock', data: inStock},
          {tab: 'inStockAmountIntermediateWithPrice', data: inStockAmountIntermediateWithPrice},
          {tab: 'inStockAmountIntermediateWithoutPrice', data: inStockAmountIntermediateWithoutPrice},
          {tab: 'soldWithoutIdAmount', data: soldWithoutIdAmount},
        ];
        break;
      case req.query.title === 'inStockAmount1':
        let inStockAmountV2 = yield db.collection('inventory').aggregate([
          {$match: {
            'isInStock': true,
          }},
          {$lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle'
          }},
          {$unwind: '$vehicle'},
          {$project: {
            'key': {$concat: [
              '$vehicle.vehicle.brand',
              '$vehicle.vehicle.model',
              '$typeId',
            ]},
            'vehicleType': '$vehicle.vehicle.vehicleType',
            'typeId': 1,
            '_id': 0
          }},
          {$lookup: {
            from: 'pricesV2',
            localField: 'key',
            foreignField: 'key',
            as: 'price'
          }},
          {$unwind: {
            path: '$price',
            preserveNullAndEmptyArrays: true
          }},
          {$group: {
            _id: {
              typeId: '$typeId',
              vehicleType: '$vehicleType',
            },
            count: {$sum: 1},
            amount: {$sum: '$price.number'}
          }}
        ]).toArray();
        result = inStockAmountV2.reduce((acc, curr) => {
          const currTab = curr._id.vehicleType;
          const itemWithCurrTab = acc.find(item => item.tab === currTab);
          if (itemWithCurrTab) {
            itemWithCurrTab.data.push({
              typeId: curr._id.typeId,
              count: curr.count,
              amount: curr.amount
            })
          } else {
            acc.push({
              tab: currTab,
              data: [{
                typeId: curr._id.typeId,
                count: curr.count,
                amount: curr.amount
              }]
            })
          }
          // add to tab-total
          const totalTab = acc.find(item => item.tab === 'total');
          const totalData = totalTab.data;
          const totalDataThatType = totalData.find(iitem => iitem.typeId === curr._id.typeId);
          if (totalDataThatType) {
            totalDataThatType.count += curr.count,
            totalDataThatType.amount += curr.amount
          } else {
            totalData.push({
              typeId: curr._id.typeId,
              count: curr.count,
              amount: curr.amount
            });
          }
          return acc;
        }, [{
          tab: 'total',
          data: []
        }]);


        break;
      case req.query.title === 'inStockAmount0':
        let inStockAmount = yield db.collection('inventory').aggregate([
          {$match: {
            'isInStock': true,
            'typeId': {$regex: '^p.*'}
          }},
          {$lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle'
          }},
          {$unwind: '$vehicle'},
          {$lookup: {
            from: 'prices',
            localField: 'typeId',
            foreignField: 'id',
            as: 'pwTypePrice'
          }},
          {$unwind: '$pwTypePrice'},
          {$lookup: {
            from: 'prices',
            localField: 'vehicle.vehicle.vehicleType',
            foreignField: 'id',
            as: 'vehicleTypePrice'
          }},
          {$unwind: {
            path: '$vehicleTypePrice',
            preserveNullAndEmptyArrays: true
          }},
          // {$project: {
          //   'pwTypePrice': 1,
          //   'vehicleTypePrice': 1
          // }}
          {$group: {
            _id: {
              typeId: '$typeId',
              vehicleType: '$vehicle.vehicle.vehicleType',
            },
            count: {$sum: 1},
            amount: {$sum: {$multiply: [
              '$pwTypePrice.number', {$add: [1, {$cond: [
                {$gt: ['$vehicleTypePrice', null]},
                {$divide: ['$vehicleTypePrice.number', 100]},
                0
              ]}]}
            ]}}
          }}
        ]).toArray();
        // result = inStockAmount;
        result = inStockAmount.reduce((acc, curr) => {
          const currTab = curr._id.vehicleType;
          const itemWithCurrTab = acc.find(item => item.tab === currTab);
          if (itemWithCurrTab) {
            itemWithCurrTab.data.push({
              typeId: curr._id.typeId,
              count: curr.count,
              amount: curr.amount
            })
          } else {
            acc.push({
              tab: currTab,
              data: [{
                typeId: curr._id.typeId,
                count: curr.count,
                amount: curr.amount
              }]
            })
          }
          // add to tab-total
          const totalTab = acc.find(item => item.tab === 'total');
          const totalData = totalTab.data;
          const totalDataThatType = totalData.find(iitem => iitem.typeId === curr._id.typeId);
          if (totalDataThatType) {
            totalDataThatType.count += curr.count,
            totalDataThatType.amount += curr.amount
          } else {
            totalData.push({
              typeId: curr._id.typeId,
              count: curr.count,
              amount: curr.amount
            });
          }
          return acc;
        }, [{
          tab: 'total',
          data: []
        }]);
        break;
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
      case req.query.title === 'inputDoneRecently':
        const sevenDaysAgoDate = getDaysAgoDate(now, 7);
        let recentSevenDays = yield db.collection('inventory').aggregate([
          {$match: {
            'inputDate': {$gte: new Date(`${sevenDaysAgoDate}T16:00:00.000Z`)}
          }},
          {$lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle'
          }},
          {$unwind: '$vehicle'},
          // {$lookup: {
          //   from: 'vtbmym',
          //   localField: "vtbmym",
          //   foreignField: "_id",
          //   as: "vtbmym"
          // }},
          // {$unwind: '$vtbmym'},
          {$group: {
            _id: {
              typeId: '$typeId',
              vehicleType: '$vehicle.vehicle.vehicleType',
              tab: {$dateToString: {format: '%Y-%m-%d', date: {$add: ['$inputDate', 1000 * 60 * 60 * 8]}}}
            },
            count: {$sum: {$cond: [
              {$eq: [{$substr: ['$typeId', 0, 1] }, 'w']}, '$quantity', 1 // if it's 'waste', use quantiy field
            ]}}
          }}
        ]).toArray();
        const processReport = (report) => {
          let reportCopy = JSON.parse(JSON.stringify(report));
          reportCopy = reportCopy.reduce((acc, curr) => {
            const thatTab = curr._id.tab;
            const thatTypeId = curr._id.typeId;
            const thatVehicleType = curr._id.vehicleType;
            const itemWithThatTab = acc.find(item => item.tab === thatTab);
            if (itemWithThatTab) {
              const iitemWithThatTypeId = itemWithThatTab.rows.find(iitem => iitem.typeId === thatTypeId);
              if (iitemWithThatTypeId) {
                iitemWithThatTypeId[thatVehicleType] = curr.count;
              } else {
                itemWithThatTab.rows.push({
                  typeId: thatTypeId,
                  [thatVehicleType]: curr.count
                })
              }
              if (!itemWithThatTab.columns.find(c => c === thatVehicleType)) {
                itemWithThatTab.columns.push(thatVehicleType);
              }
            } else {
              acc.push({
                tab: thatTab,
                rows: [{
                  typeId: thatTypeId,
                  [thatVehicleType]: curr.count
                }],
                columns: [thatVehicleType]
              });
            }
  
            return acc;
          }, []);
          reportCopy.forEach(dateReport => {
            dateReport.rows.sort((a, b) => a.typeId > b.typeId ? 1 : -1);
            dateReport.columns.sort((a, b) => a > b ? 1 : -1);
          })

          return reportCopy;
        }


        const lastMondayDate = getLastMondayDates(1)[0];
        const fiveWeeksAgoMondayDate = getDaysAgoDate(new Date(lastMondayDate), 29);
        const dateBeginning = new Date(`${fiveWeeksAgoMondayDate}T16:00:00.000Z`);
        let recentFiveWeeks = yield db.collection('inventory').aggregate([
          {$match: {
            'inputDate': {$gte: dateBeginning}
          }},
          {$lookup: {
            from: 'vehicles',
            localField: 'vehicleId',
            foreignField: '_id',
            as: 'vehicle'
          }},
          {$unwind: '$vehicle'},
          // {$lookup: {
          //   from: 'vtbmym',
          //   localField: "vtbmym",
          //   foreignField: "_id",
          //   as: "vtbmym"
          // }},
          // {$unwind: '$vtbmym'},
          {$group: {
            _id: {
              typeId: '$typeId',
              vehicleType: '$vehicle.vehicle.vehicleType',
              tab: {$dateToString: {format: '%V', date: {$add: ['$inputDate', 1000 * 60 * 60 * 8]}}}
            },
            count: {$sum: {$cond: [
              {$eq: [{$substr: ['$typeId', 0, 1] }, 'w']}, '$quantity', 1 // if it's 'waste', use quantiy field
            ]}}
          }}          
        ]).toArray();

        result = {
          recentSevenDays: processReport(recentSevenDays),
          recentFiveWeeks: processReport(recentFiveWeeks),
        }
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
      case req.query.title === 'currentState':
        console.log('working reports');
        let resultresultCurrentState = yield db.collection('inventory').find({})
        // let resultCurrentState = yield db.collection('inventory').aggregate([
        //   {'$lookup': {
        //     from: 'vtbmym',
        //     localField: "vtbmymId",
        //     foreignField: "_id",
        //     as: "vtbmym"
        //   }},
        //   {'$unwind': '$vtbmym'},
        //   // {'$match': {'vin': 'LB3FA63J92H016755'}},
        //   // {'$group': {
        //   //   '_id': {
        //   //     'typeId': '$typeId',
        //   //     'vehicleType': '$vehicleType'
        //   //   },
        //   //   'total': {
        //   //     '$sum': 1
        //   //   }
        //   // }}
        // ]).toArray();
        result = {
          resultCurrentState
        }
        break;
      default:
        result = {
          'req.query.title': req.query.title,
        }
    }

    res.json(result);
  }).catch(err => {
    return res.status(500).json(err.stack);
  });

}