const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;

const myAcl = require('../../my-acl');

const dbX = require('../../db');

/* 
  POST /: new sales order
  PATCH /one?_id=abc: update a sales order
  GET /?queryParams: get a list of sales order
  GET /reports?title=xyz: get report

*/
const rootGetDefault = (req, res, queryParams, keys) => {
  const dbQuery = {}; // transform queryParmas into dbQuery, when necessary
  keys.forEach(k => {
    dbQuery[k] = queryParams[k];    
  })
  console.log(dbQuery);

  co(function*() {
    const db = yield dbX.dbPromise;
    const results = yield db.collection('customers').find(dbQuery).toArray();
    return res.json(results);

  }).catch((err) => {
    return res.status(500).json(err.stack);
  })
}

const rootGet = (req, res) => {
  const queryParams = req.query;
  if (!queryParams) {
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

const rootPost = (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      message: "insufficient parameters."
    })
  }
  const thatTime = new Date();
  const thatUser = req.user._id;
  const newCustomer = req.body;

  const patches = {
    patches: Object.keys(newCustomer).map(key => ({
      op: 'replace', path: `/${key}`, value: newCustomer[key]
    }))
  };
  patches.createdAt = newCustomer.createdAt = thatTime;
  patches.createdBy = newCustomer.createdBy = thatUser;

  // console.log(patches);
  co(function*() {
    const db = yield dbX.dbPromise;
    // insert customer first and get the _id, and insert patches
    const saveResult = yield db.collection('customers').insert(newCustomer);
    patches.customerId = saveResult['insertedIds'][0];
    const patchResult = yield db.collection('customerPatches').insert(patches);
    const customerSaved = yield db.collection('customers').findOne({
      _id: saveResult['insertedIds'][0]
    });
    console.log('customer inserted');
    res.json(customerSaved);
  }).catch(err => {
    if (err.stack && err.stack.indexOf('E11000') > -1) {
      return res.status(400).json(err.stack)
    }
    console.log('error at POST /customers:', err.stack);
    return res.status(500).json(err.stack);
  })
  // res.json({ok: true});
}

const rootPatch = (req, res) => {
  res.json({ok: true});
}


router.get('/', rootGet);
router.post('/', rootPost);
router.get('/reports', require('./reports'));
module.exports = router;
