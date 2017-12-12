const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;

const getLastSundays = require('../../utils/last-sundays');
const dbX = require('../../db');

const rootGetDefault = (req, res, queryParams, keys) => {
  const dbQuery = {}; // transform queryParmas into dbQuery, when necessary
  keys.forEach(k => {
    dbQuery[k] = queryParams[k];    
  })
  console.log(dbQuery);

  co(function*() {
    const db = yield dbX.dbPromise;
    const results = yield db.collection('inventory').aggregate([
      {$match: dbQuery},
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
        'brand': '$vehicle.vehicle.brand',
        'model': '$vehicle.vehicle.model',
        'vehicleId': '$vehicle._id'
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
      {$project: {
        'key': 1, 'typeId': 1, 'price': '$price.number',
        'brand': 1, 'model': 1, 'vehicleId': 1
      }},
    ]).toArray();
    // const results0 = yield db.collection('inventory').aggregate([
    //   {$match: dbQuery},
    //   {$lookup: {
    //     from: 'vehicles',
    //     localField: 'vehicleId',
    //     foreignField: '_id',
    //     as: 'vehicle'
    //   }},
    //   {$unwind: '$vehicle'},
    //   {$project: {
    //     'isInStock': 1,
    //     'isReadyForSale': 1,
    //     'typeId': 1,
    //     'vehicleType': '$vehicle.vehicle.vehicleType',
    //     'brand': '$vehicle.vehicle.brand',
    //     'model': '$vehicle.vehicle.model',
    //     'vehicleId': '$vehicle._id',
    //     // 'year': {$year: '$vehicle.vehicle.registrationDate'},
    //     'age': {$floor: {$divide: [{$subtract: [
    //       new Date(),
    //       '$vehicle.vehicle.registrationDate'          
    //     ]}, 1000 * 60 * 60 * 24 * 365]}},
    //   }},
    //   {$lookup: {
    //     from: 'prices',
    //     localField: 'age',
    //     foreignField: 'id',
    //     as: 'priceAge'
    //   }},
    //   {$unwind: {
    //     path: '$priceAge',
    //     preserveNullAndEmptyArrays: true
    //   }},
    //   {$lookup: {
    //     from: 'prices',
    //     localField: 'vehicleType',
    //     foreignField: 'id',
    //     as: 'priceVT'
    //   }},
    //   {$unwind: {
    //     path: '$priceVT',
    //     preserveNullAndEmptyArrays: true
    //   }},
    //   {$lookup: {
    //     from: 'prices',
    //     localField: 'brand',
    //     foreignField: 'id',
    //     as: 'priceBrand'
    //   }},
    //   {$unwind: {
    //     path: '$priceBrand',
    //     preserveNullAndEmptyArrays: true
    //   }},
    //   {$lookup: {
    //     from: 'prices',
    //     localField: 'typeId',
    //     foreignField: 'id',
    //     as: 'priceType'
    //   }},
    //   {$unwind: {
    //     path: '$priceType',
    //     preserveNullAndEmptyArrays: true
    //   }},
    //   {$project: {
    //     'isInStock': 1,
    //     'isReadyForSale': 1,
    //     'typeId': 1,
    //     'vehicleType': 1,
    //     'brand': 1,
    //     'model': 1,
    //     'vehicleId': 1,
    //     // 'year': {$year: '$vehicle.vehicle.registrationDate'},
    //     'age': 1,
    //     'priceType': '$priceType.number',
    //     'priceBrand': {$cond: ['$priceBrand', '$priceBrand.number', 0]},
    //     'priceVT': {$cond: ['$priceVT', '$priceVT.number', 0]},
    //     'priceAge': {$cond: ['$priceAge', '$priceAge.number', 0]},
    //     'price': {$ceil: {$multiply: [
    //       {$add: [
    //         1, 
    //         {$divide: [{$cond: ['$priceBrand', '$priceBrand.number', 0]}, 100]},
    //         {$divide: [{$cond: ['$priceVT', '$priceVT.number', 0]}, 100]},
    //         {$divide: [{$cond: ['$priceAge', '$priceAge.number', 0]}, 100]},
    //       ]},
    //       '$priceType.number'
    //     ]}}
    //   }}
    // ]).toArray();
    return res.json(results);

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}

const rootGet = (req, res) => {
  const queryParams = req.query;
  if (!queryParams || !Object.keys(queryParams)) {
    return res.status(400).json({
      message: "insufficient parameters."
    });
  }
  const keys = Object.keys(queryParams);

  // value of each queryParam has been JSON.stringify-ed at the frontend
  keys.forEach(k => {
    queryParams[k] = JSON.parse(queryParams[k]);
  })
  console.log(queryParams);
  switch (true) {
    case queryParams.title === 'all':
      return res.json({
        message: 'want them all?'
      });
    default:
      return rootGetDefault(req, res, queryParams, keys);
  }
}


router.get('/', rootGet);

router.post('/query', (req, res) => {
  // todo: add user.role checking, so to decide whether to return price info

  if (!req.body) {
    res.status(400).json({
      ok: false,
      message: 'no query params provided'
    });
  }
  const queryParams = JSON.parse(JSON.stringify(req.body));
  console.log(queryParams);
  const processedQueryParams = Object.keys(queryParams).reduce((acc, curr) => {
    switch(curr) {
      case 'brand':
      case 'vehicleType':
        acc[`vehicle.vehicle.${curr}`] = queryParams[curr];
        break;
      default:
        acc[curr] = queryParams[curr];
    }
    return acc;
  }, {});
  co(function*() {
    const db = yield dbX.dbPromise;
    const queryResult = yield db.collection('inventory').aggregate([
      {$lookup: {
        from: 'vehicles',
        localField: 'vehicleId',
        foreignField: '_id',
        as: 'vehicle'
      }},
      {$unwind: '$vehicle'},
      {$match: processedQueryParams},
      // 可售
      // 回用件名称
      // 车辆类型
      // 品牌
      // 车龄
      // 价格
      // 数量
      {$project: {
        'isInStock': 1,
        'isReadyForSale': 1,
        'typeId': 1,
        'vehicleType': '$vehicle.vehicle.vehicleType',
        'brand': '$vehicle.vehicle.brand',
        'model': '$vehicle.vehicle.model',
        'vehicleId': '$vehicle._id',
        // 'year': {$year: '$vehicle.vehicle.registrationDate'},
        'age': {$floor: {$divide: [{$subtract: [
          new Date(),
          '$vehicle.vehicle.registrationDate'          
        ]}, 1000 * 60 * 60 * 24 * 365]}},
      }},
      {$lookup: {
        from: 'prices',
        localField: 'age',
        foreignField: 'id',
        as: 'priceAge'
      }},
      {$unwind: {
        path: '$priceAge',
        preserveNullAndEmptyArrays: true
      }},
      {$lookup: {
        from: 'prices',
        localField: 'vehicleType',
        foreignField: 'id',
        as: 'priceVT'
      }},
      {$unwind: {
        path: '$priceVT',
        preserveNullAndEmptyArrays: true
      }},
      {$lookup: {
        from: 'prices',
        localField: 'brand',
        foreignField: 'id',
        as: 'priceBrand'
      }},
      {$unwind: {
        path: '$priceBrand',
        preserveNullAndEmptyArrays: true
      }},
      {$lookup: {
        from: 'prices',
        localField: 'typeId',
        foreignField: 'id',
        as: 'priceType'
      }},
      {$unwind: {
        path: '$priceType',
        preserveNullAndEmptyArrays: true
      }},
      {$project: {
        'isInStock': 1,
        'isReadyForSale': 1,
        'typeId': 1,
        'vehicleType': 1,
        'brand': 1,
        'model': 1,
        'vehicleId': 1,
        // 'year': {$year: '$vehicle.vehicle.registrationDate'},
        'age': 1,
        'priceType': '$priceType.number',
        'priceBrand': {$cond: ['$priceBrand', '$priceBrand.number', 0]},
        'priceVT': {$cond: ['$priceVT', '$priceVT.number', 0]},
        'priceAge': {$cond: ['$priceAge', '$priceAge.number', 0]},
        'price': {$ceil: {$multiply: [
          {$add: [
            1, 
            {$divide: [{$cond: ['$priceBrand', '$priceBrand.number', 0]}, 100]},
            {$divide: [{$cond: ['$priceVT', '$priceVT.number', 0]}, 100]},
            {$divide: [{$cond: ['$priceAge', '$priceAge.number', 0]}, 100]},
          ]},
          '$priceType.number'
        ]}}
      }}
    ]).toArray();
    res.json(queryResult);
  }).catch(error => {
    return res.status(500).json({
      ok: false, error: error.stack
    });
  })
})

// router.post('/query0', (req, res) => {
//   console.log(req.body);
//   if (!req.body) {
//     res.status(400).json({
//       ok: false,
//       message: 'no query params provided'
//     });
//   }
  
//   // { parts: [ 'p000' ],
//   // vehicleType: 'blablabla', // empty vehicleType will be deleted at frontEnd
//   // brands: [ '599d405de8330e001159618b' ] }

//   const queryParams = JSON.parse(JSON.stringify(req.body));
//   const queryParamsVTBMYM = {brand: {$in: queryParams['brands']}};
//   if (queryParams['vehicleTypes']) {
//     queryParamsVTBMYM['vehicleTypes'] = queryParams['vehicleTypes'];
//   }
//   console.log('queryParamsVTBMYM', queryParamsVTBMYM)
//   const queryParamsInventory = {
//     typeId: {$in: queryParams['typeIds']},
//     isReadyForSale: queryParams['isReadyForSale'],
//     isInStock: true // only return items that are in stock
//   };

//   co(function*() {
//     const db = yield dbX.dbPromise;
//     const vtbmymIdsResult = yield db.collection('vtbmym').find(queryParamsVTBMYM, {_id: 1}).toArray();
//     if (!vtbmymIdsResult.length) {
//       res.json([]);
//     } else {
//       queryParamsInventory['vtbmymId'] = {$in: vtbmymIdsResult.map(r => r._id)};
//       console.log('queryParamsInventory', queryParamsInventory)
      

//       // const findResult = yield db.collection('inventory').find(queryParamsInventory).toArray();
//       let aggregateResult = yield db.collection('inventory').aggregate([
//         {'$match': queryParamsInventory},
//         {'$lookup': {
//           from: 'vtbmym',
//           localField: 'vtbmymId',
//           foreignField: '_id',
//           as: 'vtbmym_detail'
//         }},
//         {'$unwind': '$vtbmym_detail'},
//         {'$project': {
//           'vin': 0, 'vtbmymId': 0, 'inputDate': 0, 'isInStock': 0, 'outputTo': 0,
//           'outputDate': 0, 'outputRef': 0, 'createdAt': 0, 'createdBy': 0,
//           'vtbmym_detail._id': 0, 'vtbmym_detail._id': 0, 
//         }}, // after $project, result includes model and month
//         {'$group': {
//           '_id': {
//             'typeId': '$typeId',
//             'isReadyForSale': '$isReadyForSale',
//             'brand': '$vtbmym_detail.brand',
//             'vehicleType': '$vtbmym_detail.vehicleType',
//             'year': '$vtbmym_detail.year'
//           },
//           'total': {'$sum': 1}
//         }}
//       ]).toArray();
//       aggregateResult = aggregateResult.map(r => ({
//         'typeId': r._id.typeId,
//         'isReadyForSale': r._id.isReadyForSale,
//         'brand': r._id.brand,
//         'vehicleType': r._id.vehicleType,
//         'year': r._id.year,
//         'total': r.total
//       }));
//       res.json(aggregateResult);

//       // partName, brand, vt, year, isReadyForSale, count

//     }
//   }).catch(error => {
//     return res.status(500).json({
//       ok: false, error: error.stack
//     });
//   })

//   // res.send({ok: true, message: queryParams})
// })

router.get('/reports', require('./reports'));


module.exports = router;