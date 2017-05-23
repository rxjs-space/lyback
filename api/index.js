const router = require('express').Router();
const vehicles = require('./vehicles');
const users = require('./users');
router.use('/vehicles', vehicles);
router.use('/users', users);
module.exports = router;
