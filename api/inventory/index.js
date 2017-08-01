const router = require('express').Router();
const co = require('co');
const toMongodb = require('jsonpatch-to-mongodb');
const ObjectID = require('mongodb').ObjectID;

const getLastSundays = require('../../utils/last-sundays');
const dbX = require('../../db');

router.get('/', (req, res) => {
  res.send('ok');
});

router.get('/reports', require('./reports'));


module.exports = router;