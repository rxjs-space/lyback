const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;

const getLastSundays = require('../../utils/last-sundays');
const dbX = require('../../db');

router.get('/', (req, res) => {
  res.send('ok');
});

router.post('/query', (req, res) => {
  console.log(req.body);
  if (!req.body) {
    res.status(400).json({
      ok: false,
      message: 'no query params provided'
    });
  }
  
  // { parts: [ 'p000' ],
  // vehicleType: 'blablabla', // empty vehicleType will be deleted at frontEnd
  // brands: [ '599d405de8330e001159618b' ] }

  const queryParams = JSON.parse(JSON.stringify(req.body));
  const queryParamsVTBMYM = {brand: {$in: queryParams['brands']}};
  if (queryParams['vehicleTypes']) {
    queryParamsVTBMYM['vehicleTypes'] = queryParams['vehicleTypes'];
  }
  console.log('queryParamsVTBMYM', queryParamsVTBMYM)
  const queryParamsInventory = {
    typeId: {$in: queryParams['typeIds']},
    isReadyForSale: queryParams['isReadyForSale'],
    isInStock: true // only return items that are in stock
  };

  co(function*() {
    const db = yield dbX.dbPromise;
    const vtbmymIdsResult = yield db.collection('vtbmym').find(queryParamsVTBMYM, {_id: 1}).toArray();
    if (!vtbmymIdsResult.length) {
      res.json([]);
    } else {
      queryParamsInventory['vtbmymId'] = {$in: vtbmymIdsResult.map(r => r._id)};
      console.log('queryParamsInventory', queryParamsInventory)
      

      // const findResult = yield db.collection('inventory').find(queryParamsInventory).toArray();
      let aggregateResult = yield db.collection('inventory').aggregate([
        {'$match': queryParamsInventory},
        {'$lookup': {
          from: "vtbmym",
          localField: "vtbmymId",
          foreignField: "_id",
          as: "vtbmym_detail"
        }},
        {'$unwind': '$vtbmym_detail'},
        {'$project': {
          'vin': 0, 'vtbmymId': 0, 'inputDate': 0, 'isInStock': 0, 'outputTo': 0,
          'outputDate': 0, 'outputRef': 0, 'createdAt': 0, 'createdBy': 0,
          'vtbmym_detail._id': 0, 'vtbmym_detail._id': 0, 
        }}, // after $project, result includes model and month
        {'$group': {
          '_id': {
            'typeId': '$typeId',
            'isReadyForSale': '$isReadyForSale',
            'brand': '$vtbmym_detail.brand',
            'vehicleType': '$vtbmym_detail.vehicleType',
            'year': '$vtbmym_detail.year'
          },
          'total': {'$sum': 1}
        }}
      ]).toArray();
      aggregateResult = aggregateResult.map(r => ({
        'typeId': r._id.typeId,
        'isReadyForSale': r._id.isReadyForSale,
        'brand': r._id.brand,
        'vehicleType': r._id.vehicleType,
        'year': r._id.year,
        'total': r.total
      }));
      res.json(aggregateResult);

      // partName, brand, vt, year, isReadyForSale, count

    }
  }).catch(error => {
    return res.status(500).json({
      ok: false, error: error.stack
    });
  })

  // res.send({ok: true, message: queryParams})
})

router.get('/reports', require('./reports'));


module.exports = router;