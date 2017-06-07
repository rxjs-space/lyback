const router = require('express').Router();
const jwt = require("jwt-simple"); 
const co = require('co');
const myAcl = require('../../my-acl');

const dbX = require('../../db');


router.post('/', function(req, res) {
  if (!req.body) {return res.status(500).json({
    message: 'No brand etails provided.'
  })}
  let newBrands;
  if (req.body instanceof Array) {
    newBrands = req.body;
  } else {
    newBrands = [req.body]
  }
  newBrands.forEach(b => {
    if (!b.name) {
      return res.status(500).json({
        message: 'Some brand has no specified.'
      })
    }
  })

  co(function*() {
    const db = yield dbX.dbPromise;
    const insertResult = yield db.collection('brands').insertMany(newBrands);
    res.json(insertResult);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })
});

router.get('/', (req, res) => {
  co(function*() {
    const db = yield dbX.dbPromise;
    const brands = yield db.collection('brands').find().toArray();
    res.json(brands);
  }).catch(err => {
    return res.status(500).json(err.stack);
  })

})

module.exports = router;
