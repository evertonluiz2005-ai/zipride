const router = require('express').Router();
const { updateDevice, getDevice, sendCommand } = require('../controllers/deviceController');

router.post('/update',  updateDevice);
router.post('/command', sendCommand);
router.get('/:id',      getDevice);

module.exports = router;
