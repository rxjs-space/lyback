const router = require('express').Router();
const vehicles = require('./vehicles');
const users = require('./users');
const myAcl = require('../my-acl');

router.use(myAcl.middlleware);

router.use('/vehicles', vehicles);
router.use('/users', users);
module.exports = router;
