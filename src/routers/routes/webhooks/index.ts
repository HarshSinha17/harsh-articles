import type * as expressType from 'express';
import Project from '../../../models/project.model';
import analytics from '../../../services/analytics/analytics';
import User from '../../../models/user.model';
import repositoryTypes from '../../../services/deploy-services/repositories';
import logger from '../../../services/logger';

export async function githubWebhook(req: expressType.Request, res: expressType.Response): Promise<void> {
    res.json({ status: 'ok' });
    try {
        const id = req.params.id as string;
        const projects = await Project.findProjectsByWebhookId('github', id);
        if (!projects || !projects.length) {
            const data = id ? { projectId: id } : { webhookId: id };
            return analytics.anonymousTrack('Webhook for deleted project - Github', data, id);
        }
        await Promise.all(
            projects.map(async (project) => {
                if (!project.ownerId) {
                    return analytics.anonymousTrack('Webhook for project without owner - Github', { projectId: project.id }, id);
                }
                // todo use method to handle search not only by owner id
                const user = await User.findUserById(project.ownerId);
                if (!user) {
                    return analytics.anonymousTrack('Webhook for project without owner - Github', { projectId: project.id }, id);
                }
                analytics.track(
                    'Webhook: Github',
                    {
                        projectId: project.id,
                        userId: user.id,
                        project: {
                            wizard: {
                                settings: project.wizard?.settings
                            }
                        }
                    },
                    user
                );
                return repositoryTypes.callRepositoryMethodForProject('onWebhook', project, user, req);
            })
        );
    } catch (e) {
        logger.error('[githubWebhook] Failed to handle github webhook', e);
    }
}
