const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const coForEach = require('co-foreach');
const myAcl = require('../../my-acl');

const dbX = require('../../db');


router.post('/', function(req, res) {
  if (!req.body) {return res.status(500).json({
    message: 'No price details provided.'
  })}
  let newPrices; // each new price will have fileds as "type, id, number"
  if (req.body instanceof Array) {
    newPrices = req.body;
  } else {
    newPrices = [req.body]
  }

  newPrices.forEach(p => {
    p.createdAt = (new Date()).toISOString();
    p.createdBy = req.user._id;
  });

  co(function*() {
    const db = yield dbX.dbPromise;
    const insertResult = yield db.collection('prices').insertMany(newPrices);
    res.json(insertResult);
  }).catch(error => {
    const errStr = JSON.stringify(error.stack);
    // if duplicate price configuration ...
    if (errStr.indexOf('E11000')) return res.status(400).json({
      message: `Duplicate price configuration. ${errStr}`
    });
    return res.status(500).json(error.stack);
  })

});

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const group = req.query['group'];
    let result;
    switch (group) {
      case 'pw':
        result = yield db.collection('prices').find({group}, {
          _id: 0,
          group: 0,
          createdAt: 0,
          createdBy: 0
        }).toArray();
        break;
    }
    res.json(result);
  })
})

module.exports = router;