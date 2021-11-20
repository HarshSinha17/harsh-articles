import express from 'express';
import { organizationGuard, projectGroupGuard, teamGuard, registeredThemeGuard } from './guards/organization';
import { isLoggedIn } from './guards/user';
import * as Routes from './routes/organization.routes';
import {
    ORGANIZATION_PERMISSIONS,
    TEAM_PERMISSIONS,
    PROJECT_GROUP_PERMISSIONS,
    REGISTERED_THEME_PERMISSIONS
} from '../models/organization/organization-models-access-control';
const { EDIT_ORGANIZATION, EDIT_MEMBERSHIP, CREATE_TEAM, CREATE_PROJECT_GROUP, CREATE_REGISTERED_THEME } = ORGANIZATION_PERMISSIONS;
const { EDIT_TEAM, DELETE_TEAM, EDIT_TEAM_MEMBERSHIP, ASSIGN_TEAM_ROLE } = TEAM_PERMISSIONS;
const { EDIT_PROJECT_GROUP, DELETE_PROJECT_GROUP, ASSIGN_PROJECT_GROUP_ROLE } = PROJECT_GROUP_PERMISSIONS;
const { EDIT_REGISTERED_THEME, DELETE_REGISTERED_THEME, ASSIGN_REGISTERED_THEME_ROLE } = REGISTERED_THEME_PERMISSIONS;

const router = express.Router();

router.get('/list', isLoggedIn, Routes.getOrganizationList);
router.get('/:id', isLoggedIn, organizationGuard(), Routes.getOrganization);
router.patch('/:id', isLoggedIn, organizationGuard(EDIT_ORGANIZATION), Routes.updateOrganization);

router.get('/:id/projects', isLoggedIn, organizationGuard(), Routes.getProjectList);

router.get('/:id/user/list', isLoggedIn, organizationGuard(), Routes.getOrganizationUserList);
router.delete('/:id/user/:userId/', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.removeUserFromOrganization);
router.post('/:id/invite/send/', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.addInvite);
router.delete('/:id/invite/delete/:inviteId', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.removeInvite);
router.post('/:id/invite/accept/', isLoggedIn, Routes.acceptInvite);
router.put('/:id/assign-role/user/:userId/', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.assignUserToOrganizationRole);
router.put('/:id/assign-role/team/:teamId/', isLoggedIn, organizationGuard(EDIT_MEMBERSHIP), Routes.assignTeamToOrganizationRole);

router.get('/:id/team/list', isLoggedIn, organizationGuard(), Routes.getOrganizationMemberships);
router.post('/:id/team/', isLoggedIn, organizationGuard(CREATE_TEAM), Routes.createOrganizationTeam);
router.put('/:id/team/:teamId/user/:userId/', isLoggedIn, teamGuard(EDIT_TEAM_MEMBERSHIP), Routes.addUserToOrganizationTeam);
router.delete('/:id/team/:teamId/user/:userId/', isLoggedIn, teamGuard(EDIT_TEAM_MEMBERSHIP), Routes.removeUserFromOrganizationTeam);
router.patch('/:id/team/:teamId', isLoggedIn, teamGuard(EDIT_TEAM), Routes.updateOrganizationTeam);
router.delete('/:id/team/:teamId', isLoggedIn, teamGuard(DELETE_TEAM), Routes.deleteOrganizationTeam);
router.put('/:id/assign-role/team/:teamId/user/:userId/', isLoggedIn, teamGuard(ASSIGN_TEAM_ROLE), Routes.assignUserToTeamRole);
router.put('/:id/assign-role/team/:teamId/team/:teamToGetRoleId/', isLoggedIn, teamGuard(ASSIGN_TEAM_ROLE), Routes.assignTeamToTeamRole);

router.get('/:id/projectgroups', isLoggedIn, organizationGuard(), Routes.getProjectGroups);
router.post('/:id/projectgroup', isLoggedIn, organizationGuard(CREATE_PROJECT_GROUP), Routes.createProjectGroup);
router.patch('/:id/projectgroup/:projectGroupId', isLoggedIn, projectGroupGuard(EDIT_PROJECT_GROUP), Routes.updateProjectGroup);
router.delete('/:id/projectgroup/:projectGroupId', isLoggedIn, projectGroupGuard(DELETE_PROJECT_GROUP), Routes.removeProjectGroup);
router.put(
    '/:id/assign-role/projectgroup/:projectGroupId/user/:userId/',
    isLoggedIn,
    projectGroupGuard(ASSIGN_PROJECT_GROUP_ROLE),
    Routes.assignUserToProjectGroupRole
);
router.put(
    '/:id/assign-role/projectgroup/:projectGroupId/team/:teamId/',
    isLoggedIn,
    projectGroupGuard(ASSIGN_PROJECT_GROUP_ROLE),
    Routes.assignTeamToProjectGroupRole
);

router.get('/:id/registered-themes', isLoggedIn, registeredThemeGuard(), Routes.getRegisteredThemes);
router.post('/:id/registered-themes', isLoggedIn, organizationGuard(CREATE_REGISTERED_THEME), Routes.createRegisteredTheme);
router.patch(
    '/:id/registered-themes/:registeredThemeId',
    isLoggedIn,
    registeredThemeGuard(EDIT_REGISTERED_THEME),
    Routes.updateRegisteredTheme
);
router.delete(
    '/:id/registered-themes/:registeredThemeId',
    isLoggedIn,
    registeredThemeGuard(DELETE_REGISTERED_THEME),
    Routes.removeRegisteredTheme
);
router.put(
    '/:id/assign-role/registered-themes/:registeredThemeId/user/:userId/',
    isLoggedIn,
    registeredThemeGuard(ASSIGN_REGISTERED_THEME_ROLE),
    Routes.assignUserToRegisteredThemeRole
);
router.put(
    '/:id/assign-role/registered-themes/:registeredThemeId/team/:teamId/',
    isLoggedIn,
    registeredThemeGuard(ASSIGN_REGISTERED_THEME_ROLE),
    Routes.assignTeamToRegisteredThemeRole
);

module.exports = router;
