const express = require('express');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const v = require('../validators/notification.validator');
const c = require('../controllers/notification.controller');

const router = express.Router();

router.use(auth());

router.get('/', validate(v.list), c.list);
router.get('/unread-count', c.unreadCount);
router.put('/read-all', c.markAllRead);
router.put('/preferences', validate(v.preferences), c.updatePreferences);
router.post('/push-token', validate(v.pushToken), c.registerPushToken);
router.delete('/push-token', validate(v.pushToken), c.removePushToken);
router.put('/:notificationId/read', validate(v.markRead), c.markRead);

module.exports = router;
