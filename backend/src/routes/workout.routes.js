const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const v = require('../validators/workout.validator');
const c = require('../controllers/workout.controller');

const router = express.Router();

router.use(auth());

router.post('/', validate(v.saveWorkout), c.save);
router.get('/', validate(v.list), c.list);
router.get('/today', c.today);
router.get('/exercises', c.exercises);
router.get('/progress', validate(v.progress), c.progress);
router.delete('/:date', validate(v.byDate), c.remove);

module.exports = router;
