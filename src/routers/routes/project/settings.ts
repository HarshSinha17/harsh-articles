import type * as expressType from 'express';
import config from '../../../config';
import { ResponseError } from '../../../services/utils/error.utils';
import Project from '../../../models/project.model';
import CollaboratorRole from '../../../models/collaborator-role.model';
import logger from '../../../services/logger';
import { promises as dns } from 'dns';
import deployments from '../../../services/deploy-services/deployments';
import { IUserDoc } from '../../../models/user.model';

export enum CUSTOM_DOMAIN_CDN_VALIDATION_TYPES {
    NO_CNAME = 'NO_CNAME',
    NOT_CONFIGURED_DNS = 'NOT_CONFIGURED_DNS'
}

export async function updateCustomDomain(req: expressType.Request, res: expressType.Response): Promise<any> {
    try {
        const user = req.user as IUserDoc;
        const projectId = req.params.id;
        const hostname = req.body.hostname;

        if (!projectId || !user.id) {
            throw new ResponseError('NotFound');
        }

        let project = await Project.findProjectByIdAndUser(projectId, user, CollaboratorRole.Permission.FULL_ACCESS);
        if (!project) {
            throw new ResponseError('NotFound');
        }

        const pattern = /^((http|https):\/\/)/;
        if (hostname && pattern.test(hostname)) {
            throw new ResponseError('InvalidInput');
        }

        const regex = new RegExp(`${config.website.domain}|${config.netlify.shared.domain}`, 'g');
        if (hostname && hostname.match(regex)) {
            throw new ResponseError('InvalidInput');
        }

        if (hostname && project.defaultDomain) {
            try {
                const addresses = await dns.resolveCname(hostname);
                if (!(project?.defaultDomain && addresses.includes(project?.defaultDomain))) {
                    return res.status(200).json({
                        validation: {
                            type: CUSTOM_DOMAIN_CDN_VALIDATION_TYPES.NO_CNAME
                        }
                    });
                }
            } catch (e) {
                return res.status(200).json({
                    validation: {
                        type: CUSTOM_DOMAIN_CDN_VALIDATION_TYPES.NOT_CONFIGURED_DNS
                    }
                });
            }
        }
        project = await Project.updateProject(projectId, { customDomain: hostname }, user?.id);
        if (!project) {
            throw new ResponseError('NotFound');
        }

        await deployments.callPureDeploymentMethodForProject('handleProjectUpdated', project, { customDomain: hostname }, user);
        return res.status(200).json();
    } catch (e) {
        logger.error('[updateCustomDomain] failed', { error: e, projectId: req?.params?.id, userId: req?.user?.id });

        if (e instanceof ResponseError) {
            res.status(e.status || 500).json({ message: e.message });
        } else {
            res.status(500).json({ message: 'Server error' });
        }
    }
}

// When a user adds a custom domain, they need setup that domain outside of Stackbit with their DNS registrar.
// After they've completed that process, the deployment implementation may need to close the circle.
export async function verifyCustomDomain(req: expressType.Request, res: expressType.Response): Promise<any> {
    try {
        const user = req.user as IUserDoc;
        const projectId = req.params.id;

        if (!projectId || !user.id) {
            throw new ResponseError('NotFound');
        }

        const project = await Project.findProjectByIdAndUser(projectId, user, CollaboratorRole.Permission.BASIC_ACCESS);
        if (!project) {
            throw new ResponseError('NotFound');
        }

        const result = await deployments.callPureDeploymentMethodForProject('verifyCustomDomain', project, user);
        res.status(200).json(result);
    } catch (error: any) {
        return res.status(error?.code || error?.status || 500).json({ message: error?.data?.error || error?.message });
    }
}
