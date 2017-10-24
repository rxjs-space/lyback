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

const rootGet = (req, res) => {
  res.json({ok: true});
}

const rootPost = (req, res) => {
  res.json({ok: true});
}

const rootPatch = (req, res) => {
  res.json({ok: true});
}


router.get('/', rootGet);
router.get('/reports', require('./reports'));
module.exports = router;