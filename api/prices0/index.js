const router = require('express').Router();
const co = require('co');
const coForEach = require('co-foreach');
const ObjectID = require('mongodb').ObjectID;

const dbX = require('../../db');
const rootPost = (req, res) => {
  res.send('ok');
}
router.post('/', rootPost);
module.exports = router;