const router = require('express').Router();
const vehicles = require('./vehicles');
router.use('/vehicles', vehicles);
module.exports = router;
