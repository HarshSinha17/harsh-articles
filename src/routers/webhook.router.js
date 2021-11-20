const express = require('express');
const router = express.Router();

const projectRouter = require('./routes/project.routes');
const { githubWebhook } = require('./routes/webhooks');

// deprecated router
router.post('/github', projectRouter.githubWebhook);
router.post('/:id/github', githubWebhook);
module.exports = router;
