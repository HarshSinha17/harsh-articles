import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import Organization from '../../models/organization.model';
import type { IOrganization } from '../../models/organization.model';
import Project, { ProjectListFilterParams } from '../../models/project.model';
import logger from '../../services/logger';
import { SortedPagesParams, parseSortDirection } from '../../services/utils/sortedpages.utils';
import type { ITeam } from '../../models/organization/organization.team.submodel';
import { ResponseError } from '../../services/utils/error.utils';
import { IProjectGroup } from '../../models/organization/organization.project-group.submodel';
import { organizationMembershipInviteEmail } from '../../services/customerio-service/customerio-transactional-service';
import config from '../../config';
import { IRegisteredTheme } from '../../models/organization/organization.registered-themes.submodel';
import { ORGANIZATION_NESTED_ENTITY_FIELDS } from '../../models/organization/organization-models-access-control';

export async function getOrganizationList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const organizations = await Organization.findOrganizations(req.user!);
        const organizationsJson = await Promise.all(
            organizations.map(async (organization) => {
                return await Organization.objectForListResponse(organization);
            })
        );
        res.json(organizationsJson);
    } catch (e: any) {
        logger.error('Organization: [getOrganizationList]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function getOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.getOrganization(organizationObjectId);
        if (!organization) {
            throw new ResponseError('NotFound');
        }
        const organizationJson = await Organization.objectForResponse(organization);
        res.json(organizationJson);
    } catch (e: any) {
        logger.error('Organization: [getOrganization]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function updateOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.updateOrganization(organizationObjectId, {
            name
        } as IOrganization);
        if (!organization) {
            throw new ResponseError('NotFound');
        }
        const organizationsJson = await Organization.objectForResponse(organization);
        res.json(organizationsJson);
    } catch (e: any) {
        logger.error('Organization: [updateOrganization]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function getProjectList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id: organizationId } = req.params;
        const {
            namePart,
            themeId, // filtering
            sortByField,
            sortDirection, // sorting
            pageSize,
            lastPageLastItemVal, // last value of last row in last page. for scalable next page
            pageIndex // if lastSortVal doesn't exists, pagination page index number (zero based)
        } = req.query;

        const filterParams = {
            namePart,
            themeId
        } as ProjectListFilterParams;

        const sortedPagesParams = {
            sortByField: sortByField,
            sortDirection: parseSortDirection(sortDirection),
            pageSize: pageSize ? parseInt(pageSize as string) : undefined,
            lastPageLastItemVal: lastPageLastItemVal,
            pageIndex: pageIndex ? parseInt(pageIndex as string) : undefined
        } as SortedPagesParams;

        const projects = await Project.findProjectsForOrganization(
            mongoose.Types.ObjectId(organizationId),
            filterParams,
            sortedPagesParams
        );

        const response = await Promise.all(
            projects.map(async (project) => {
                return await Project.projectObjectForResponse(project, req.user!);
            })
        );
        res.json(response);
    } catch (e: any) {
        logger.error('Organization: [getProjectList]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function getOrganizationUserList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.getOrganization(organizationObjectId);
        if (!organization) {
            throw new ResponseError('NotFound');
        }

        const users = await organization.getUsers();
        res.json(
            await Promise.all(
                users.map(async (user) => {
                    return await Organization.userForListResponse(organizationObjectId, user);
                })
            )
        );
    } catch (e: any) {
        logger.error('Organization: [getOrganizationUserList]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function getOrganizationMemberships(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.getOrganization(organizationObjectId);
        if (!organization) {
            throw new ResponseError('NotFound');
        }

        const teams = (await organization.getTeams()) ?? [];
        res.json(
            await Promise.all(
                teams.map(async (team) => {
                    return await Organization.teamForResponse(team);
                })
            )
        );
    } catch (e: any) {
        logger.error('Organization: [getOrganizationMemberships]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function removeUserFromOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, userId } = req.params;

        const organizationObjectId = mongoose.Types.ObjectId(id);
        const userObjectId = mongoose.Types.ObjectId(userId);
        await Organization.removeUser(organizationObjectId, userObjectId);
        res.status(200).json();
    } catch (e: any) {
        logger.error('Organization: [removeUserFromOrganization]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function removeInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const organizationId = req.params.id!;
        const organizationObjectId = mongoose.Types.ObjectId(organizationId);
        const inviteId = req.params.inviteId!;

        const organization = await Organization.removeMembershipInvite(organizationObjectId, req.user!, inviteId);

        const organizationJson = await Organization.objectForResponse(organization);
        res.status(200).json(organizationJson);
    } catch (e: any) {
        logger.error('Organization: [removeInvite]', { error: e, userId: req.user!.id! });
        res.status(e.status || 500).json(e);
        next(e);
    }
}

export async function addInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const organizationId = req.params.id!;
        const organizationObjectId = mongoose.Types.ObjectId(organizationId);
        const { email, role } = req.body;

        const { organization, token: inviteToken } = await Organization.addMembershipInvite(organizationObjectId, req.user!, email, role);

        await organizationMembershipInviteEmail(email, {
            organizationName: organization.name,
            inviterEmail: req.user!.email!,
            inviteUrl: `${config.server.clientOrigin}/organization/${organization.id}/invite/accept/?token=${inviteToken}`,
            role: role
        });
        const organizationJson = await Organization.objectForResponse(organization);
        res.status(200).json(organizationJson);
    } catch (e: any) {
        logger.error('Organization: [addInvite]', { error: e, userId: req.user!.id! });
        res.status(e.status || 500).json(e);
        next(e);
    }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const organizationId = req.params.id!;
        const organizationObjectId = mongoose.Types.ObjectId(organizationId);
        const token = (req.query.token ?? '') as string;
        const organization = await Organization.acceptMembershipInvite(organizationObjectId, req.user!, token);

        const organizationJson = await Organization.objectForResponse(organization);
        res.status(200).json(organizationJson);
    } catch (e: any) {
        logger.error('Organization: [acceptInvite]', { error: e, userId: req.user!.id! });
        res.status(e.status || 500).json(e);
        next(e);
    }
}

export async function createOrganizationTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.createTeam(organizationObjectId, req.body as Partial<ITeam>, req.user!._id!);
        if (!organization) {
            throw new ResponseError('NotFound');
        }
        const organizationsJson = await Organization.objectForResponse(organization!);
        res.json(organizationsJson);
    } catch (e: any) {
        logger.error('Organization: [createOrganizationTeam]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function updateOrganizationTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, teamId } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const teamObjectId = mongoose.Types.ObjectId(teamId);
        const organization = await Organization.updateTeam(organizationObjectId, teamObjectId, req.body as Partial<ITeam>);
        if (!organization) {
            throw new ResponseError('NotFound');
        }
        const organizationsJson = await Organization.objectForResponse(organization);
        res.json(organizationsJson);
    } catch (e: any) {
        logger.error('Organization: [updateOrganizationTeam]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function deleteOrganizationTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, teamId } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const teamObjectId = mongoose.Types.ObjectId(teamId);
        await Organization.deleteTeam(organizationObjectId, teamObjectId);
        res.status(200).json();
    } catch (e: any) {
        logger.error('Organization: [deleteOrganizationTeam]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function addUserToOrganizationTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, teamId, userId } = req.params;

        const organizationObjectId = mongoose.Types.ObjectId(id);
        const teamObjectId = mongoose.Types.ObjectId(teamId);
        const userObjectId = mongoose.Types.ObjectId(userId);
        await Organization.addUserToTeam(organizationObjectId, teamObjectId, userObjectId);
        res.status(200).json();
    } catch (e: any) {
        logger.error('Organization: [addUserToOrganizationTeam]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function removeUserFromOrganizationTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, teamId, userId } = req.params;

        const organizationObjectId = mongoose.Types.ObjectId(id);
        const teamObjectId = mongoose.Types.ObjectId(teamId);
        const userObjectId = mongoose.Types.ObjectId(userId);
        await Organization.removeUserFromTeam(organizationObjectId, teamObjectId, userObjectId);
        res.status(200).json();
    } catch (e: any) {
        logger.error('Organization: [removeUserFromOrganizationTeam]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function getProjectGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.getOrganization(organizationObjectId);
        if (!organization) {
            throw new ResponseError('NotFound');
        }

        const projectGroups = (await organization.getProjectGroups()) ?? [];
        const projectGroupsJSON = await Promise.all(
            projectGroups.map(async (prGroup) => {
                return await Organization.projectGroupForResponse(prGroup);
            })
        );
        res.json(projectGroupsJSON);
    } catch (e: any) {
        logger.error('Organization: [getProjectGroups]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function createProjectGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.createProjectGroup(organizationObjectId, { name }, req.user!._id!);
        if (organization === null) {
            throw new ResponseError('NotFound');
        }
        const organizationsJson = await Organization.objectForResponse(organization!);
        res.json(organizationsJson);
    } catch (e: any) {
        logger.error('Organization: [createProjectGroup]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function updateProjectGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, projectGroupId } = req.params;
        const { name } = req.body;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const projectGroupObjectId = mongoose.Types.ObjectId(projectGroupId);

        if (projectGroupId) {
            const organization = await Organization.updateProjectGroup(organizationObjectId, projectGroupObjectId, {
                name
            } as IProjectGroup);

            if (organization === null) {
                throw new ResponseError('NotFound');
            }

            const organizationsJson = await Organization.objectForResponse(organization);
            res.json(organizationsJson);
        } else {
            logger.error('[updateProjectGroup] no projectGroupId provided', { organizationId: id });
            throw new ResponseError('UnsupportedOperation');
        }
    } catch (e: any) {
        logger.error('Organization: [updateProjectGroup]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function removeProjectGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { id, projectGroupId } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const projectGroupObjectId = mongoose.Types.ObjectId(projectGroupId);

        if (projectGroupId) {
            await Organization.deleteProjectGroup(organizationObjectId, projectGroupObjectId);
            res.status(200).json();
        } else {
            logger.error('[removeProjectGroup] no projectGroupId provided', { organizationId: id });
            throw new ResponseError('UnsupportedOperation');
        }
    } catch (e: any) {
        logger.error('Organization: [removeProjectGroup]', { message: e.message });
        res.status(e.status || 500).json({ message: e.message });
        next(e);
    }
}

export async function getRegisteredThemes(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.getOrganization(organizationObjectId);
        if (!organization) {
            throw new ResponseError('NotFound');
        }

        const registeredThemes = (await organization.getRegisteredThemes()) ?? [];
        const registeredThemesJSON = await Promise.all(
            registeredThemes.map(async (registeredTheme) => {
                return await Organization.registeredThemeForResponse(registeredTheme);
            })
        );
        res.json(registeredThemesJSON);
    } catch (err: any) {
        logger.error('Organization: [getRegisteredThemes] Error Fetching OrganizationRegisteredThemes', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function createRegisteredTheme(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const organization = await Organization.createRegisteredTheme(
            organizationObjectId,
            req.body as Partial<IRegisteredTheme>,
            req.user!._id!
        );
        if (organization === null) {
            throw new ResponseError('NotFound');
        }
        const organizationsJson = await Organization.objectForResponse(organization!);
        res.json(organizationsJson);
    } catch (err: any) {
        logger.error('Organization: [createRegisteredTheme] Error Creating Registered Theme', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function updateRegisteredTheme(req: Request, res: Response): Promise<void> {
    try {
        const { id, registeredThemeId } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const registeredThemeObjectId = mongoose.Types.ObjectId(registeredThemeId);

        if (registeredThemeId) {
            const organization = await Organization.updateRegisteredTheme(
                organizationObjectId,
                registeredThemeObjectId,
                req.body as Partial<IRegisteredTheme>
            );

            if (organization === null) {
                throw new ResponseError('NotFound');
            }

            const organizationsJson = await Organization.objectForResponse(organization);
            res.json(organizationsJson);
        } else {
            logger.error('[updateRegisteredTheme] no registeredThemeId provided', { organizationId: id });
            throw new ResponseError('UnsupportedOperation');
        }
    } catch (err: any) {
        logger.error('Organization: [updateRegisteredTheme] Error Updating Registered Theme', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function removeRegisteredTheme(req: Request, res: Response): Promise<void> {
    try {
        const { id, registeredThemeId } = req.params;
        const organizationObjectId = mongoose.Types.ObjectId(id);
        const registeredThemeObjectId = mongoose.Types.ObjectId(registeredThemeId);

        if (registeredThemeId) {
            await Organization.deleteRegisteredTheme(organizationObjectId, registeredThemeObjectId);
            res.status(200).json();
        } else {
            logger.error('[removeRegisteredTheme] no registeredThemeId provided', { organizationId: id });
            throw new ResponseError('UnsupportedOperation');
        }
    } catch (err: any) {
        logger.error('Organization: [removeRegisteredTheme] Error Deleting Registered Theme', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignUserToOrganizationRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, userId } = req.params;
        const { role } = req.body;
        const userObjectId = mongoose.Types.ObjectId(userId);
        if (!id || !userId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeUserRole(id, userObjectId);
        } else {
            await Organization.setUserRole(id, role, userObjectId);
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignUserToOrganizationRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignTeamToOrganizationRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, teamId } = req.params;
        const { role } = req.body;
        const teamObjectId = mongoose.Types.ObjectId(teamId);
        if (!id || teamId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeTeamRole(id, teamObjectId);
        } else {
            await Organization.setTeamRole(id, role, teamObjectId);
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignTeamToOrganizationRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignUserToTeamRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, teamId, userId } = req.params;
        const { role } = req.body;
        const userObjectId = mongoose.Types.ObjectId(userId);
        if (!id || !teamId || !userId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeNestedUserRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.teams, teamId, userObjectId);
        } else {
            await Organization.setNestedUserRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.teams, teamId, role, userObjectId);
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignUserToTeamRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignTeamToTeamRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, teamId, teamToGetRoleId } = req.params;
        const { role } = req.body;
        const teamToGetRoleObjectId = mongoose.Types.ObjectId(teamToGetRoleId);
        if (!id || !teamId || !teamToGetRoleObjectId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeNestedTeamRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.teams, teamId, teamToGetRoleObjectId);
        } else {
            await Organization.setNestedTeamRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.teams, teamId, role, teamToGetRoleObjectId);
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignTeamToTeamRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignUserToProjectGroupRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, projectGroupId, userId } = req.params;
        const { role } = req.body;
        const userObjectId = mongoose.Types.ObjectId(userId);
        if (!id || !projectGroupId || !userId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeNestedUserRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.projectGroups, projectGroupId, userObjectId);
        } else {
            await Organization.setNestedUserRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.projectGroups, projectGroupId, role, userObjectId);
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignUserToProjectGroupRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignTeamToProjectGroupRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, projectGroupId, teamId } = req.params;
        const { role } = req.body;
        const teamObjectId = mongoose.Types.ObjectId(teamId);
        if (!id || !projectGroupId || !teamId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeNestedTeamRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.projectGroups, projectGroupId, teamObjectId);
        } else {
            await Organization.setNestedTeamRole(id, ORGANIZATION_NESTED_ENTITY_FIELDS.projectGroups, projectGroupId, role, teamObjectId);
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignTeamToProjectGroupRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignUserToRegisteredThemeRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, registeredThemeId, userId } = req.params;
        const { role } = req.body;
        const userObjectId = mongoose.Types.ObjectId(userId);
        if (!id || !registeredThemeId || !userId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeNestedUserRole(
                id,
                ORGANIZATION_NESTED_ENTITY_FIELDS.registeredThemes,
                registeredThemeId,
                userObjectId
            );
        } else {
            await Organization.setNestedUserRole(
                id,
                ORGANIZATION_NESTED_ENTITY_FIELDS.registeredThemes,
                registeredThemeId,
                role,
                userObjectId
            );
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignUserToRegisteredThemeRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}

export async function assignTeamToRegisteredThemeRole(req: Request, res: Response): Promise<void> {
    try {
        const { id, registeredThemeId, teamId } = req.params;
        const { role } = req.body;
        const teamObjectId = mongoose.Types.ObjectId(teamId);
        if (!id || !registeredThemeId || !teamId) {
            throw new ResponseError('NotFound');
        }
        if (!role) {
            await Organization.removeNestedTeamRole(
                id,
                ORGANIZATION_NESTED_ENTITY_FIELDS.registeredThemes,
                registeredThemeId,
                teamObjectId
            );
        } else {
            await Organization.setNestedTeamRole(
                id,
                ORGANIZATION_NESTED_ENTITY_FIELDS.registeredThemes,
                registeredThemeId,
                role,
                teamObjectId
            );
        }
        res.status(200).json();
    } catch (err: any) {
        logger.error('Organization: [assignTeamToRegisteredThemeRole]', { err: err?.message });
        res.status(err.status || 500).json(err);
    }
}
