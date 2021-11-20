import type { default as OrganizationType } from '../organization.model';
import type { default as UserType, IOrganizationMembership, IUser } from '../user.model';
import type { ITeam } from './organization.team.submodel';
import { connectToDatabase, clearDatabase, closeDatabase } from '../../test-utils/mongo';
import type * as mongooseType from 'mongoose';
import { fetchUser, loadUser } from '../../test-utils/user';
import { expectedNotFoundError, getThrownError } from '../../test-utils/error';
import { createOrganizationTeamUserPreset, getTeam, loadOrganization, organizationTestConfig } from '../../test-utils/organization';
import { loadCommonRequireMock } from '../../test-utils/requireMock';
import { ORGANIZATION_NESTED_ENTITY_FIELDS, TEAM_ROLES } from './organization-models-access-control';

describe('Organization Teams Sub Model', () => {
    let Organization: typeof OrganizationType;
    let User: typeof UserType;
    let mongoose: typeof mongooseType;
    let preset: Record<string, any>;

    beforeAll(async () => {
        jest.resetModules();
        mongoose = require('mongoose');
        await connectToDatabase(mongoose);
        loadCommonRequireMock(jest, organizationTestConfig);
        User = loadUser();
        Organization = loadOrganization();
    });
    beforeEach(async () => {
        await clearDatabase(mongoose);
        preset = await createOrganizationTeamUserPreset(User, Organization);
        const user = await User.createUser({
            displayName: 'user',
            email: 'user@user.co'
        } as Partial<IUser>);
        await Organization.addUser(preset.org._id!, user._id!);
        preset.commonOrgUser = await fetchUser(user._id!);
    });
    afterAll(() => closeDatabase(mongoose));

    test('statics.createTeam', async () => {
        const { org, team: presetTeam, user } = preset;
        const validInputTeam = { name: 'newTeam', logoPath: 'path' } as ITeam; // valid

        const missingRequiredFieldInputTeam = { logoPath: 'path' } as ITeam;
        const missingRequiredFieldError = await getThrownError(() =>
            Organization.createTeam(org._id!, missingRequiredFieldInputTeam, user._id!)
        );
        expect(missingRequiredFieldError.toString()).toBe('ValidationError: teams: Validation failed: name: Path `name` is required.');

        expect(await getThrownError(() => Organization.createTeam(new mongoose.Types.ObjectId(), validInputTeam, user._id!))).toStrictEqual(
            expect.objectContaining(expectedNotFoundError)
        );

        const org1Returned = await Organization.createTeam(org._id!, validInputTeam, user._id!);
        expect(org1Returned!.teams).toHaveLength(2); // prechange, preset had 1 team
        const newTeamReturned = org1Returned!.teams!.filter((t) => !t!._id!.equals(presetTeam._id))![0]!;
        const newTeamFetched = await getTeam(org._id, validInputTeam.name);
        for (const team of [newTeamFetched, newTeamReturned]) {
            expect(team!.name).toBe('newTeam');
            expect(team!.logoPath).toBe('path');
        }

        // admin role granted to creator
        expect(newTeamFetched!.accessControlList![0]!).toEqual(
            expect.objectContaining({
                _id: expect.any(mongoose.Types.ObjectId),
                userId: user._id,
                role: 'TEAM_ADMIN'
            })
        );
    });

    test('static.updateTeam', async () => {
        const { org, team } = preset;
        const newId = new mongoose.Types.ObjectId();
        const validInputTeam = { name: 'newTeam', logoPath: 'path' } as ITeam; // valid

        let organization = await Organization.updateTeam(newId, team._id!, validInputTeam);
        expect(organization).toBeNull();

        organization = await Organization.updateTeam(org._id!, newId, validInputTeam);
        expect(organization).toBeNull();

        const updatedOrg = await Organization.updateTeam(org._id!, team._id, {
            name: 'newName',
            id: newId
        } as unknown as ITeam);
        expect(updatedOrg!.teams![0]!._id!).toStrictEqual(team._id!); // ignoring non updatable fields in update

        validInputTeam.name = 'FreshNewName';
        await Organization.updateTeam(org._id!, team._id!, validInputTeam);
        expect(await getTeam(org._id!, validInputTeam.name)).toBeDefined();
    });

    test('static.deleteTeam', async () => {
        const { org, team } = preset;
        let { user, commonOrgUser } = preset;
        const team2Name = 'objectTeam2';
        (await Organization.createTeam(
            org._id!,
            {
                name: team2Name,
                logoPath: 'path'
            } as ITeam,
            user._id!
        ))!;
        const team2 = (await getTeam(org._id!, team2Name))!;

        let userTeams = user.organizationMemberships!.filter((membership: IOrganizationMembership) =>
            membership.organizationId.equals(org._id!)
        )![0]!;
        expect(userTeams.teams).toHaveLength(1); // user have team membership before deletion

        // grant commonOrgUser and team a role over team2
        Organization.setNestedTeamRole(org.id!, 'teams', team2.id!, TEAM_ROLES.TEAM_ADMIN, team._id!);
        Organization.setNestedUserRole(org.id!, 'teams', team2.id!, TEAM_ROLES.TEAM_ADMIN, commonOrgUser._id!);
        commonOrgUser = await fetchUser(commonOrgUser._id!);

        await Organization.deleteTeam(org._id!, team._id!);
        const fetchedOrg = await Organization.findById(org._id!);
        expect(fetchedOrg!.teams).toHaveLength(1); // org team deleted, just team2 exists
        user = await fetchUser(user._id!);

        userTeams = user.organizationMemberships!.filter((membership: IOrganizationMembership) =>
            membership.organizationId.equals(org._id!)
        )![0]!;
        expect(userTeams.teams).toHaveLength(0); // user team membership deleted

        await Organization.deleteTeam(org._id!, team._id!); // idempotent: should not throw
    });

    test('statics.addUserToTeam', async () => {
        const { org, team } = preset;
        let { user } = preset;
        const newId = new mongoose.Types.ObjectId();

        expect(user.organizationMemberships![0]!.teams).toHaveLength(1);
        expect(user.organizationMemberships![0]!.teams![0]!).toStrictEqual(team._id!);

        // readding the same user doesn't create duplicate (idempotent)
        await Organization.addUserToTeam(org._id!, team._id!, user._id!);
        user = await fetchUser(user._id!);
        expect(user.organizationMemberships![0]!.teams).toHaveLength(1);
        expect(user.organizationMemberships![0]!.teams![0]!).toStrictEqual(team._id!);

        expect(
            await getThrownError(() => {
                return Organization.addUserToTeam(newId, team._id!, user._id!);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError)); // unknown organization
        expect(
            await getThrownError(() => {
                return Organization.addUserToTeam(org._id!, newId, user._id!);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError)); // unknown team
        expect(
            await getThrownError(() => {
                return Organization.addUserToTeam(org._id!, team._id!, newId);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError)); // unknown user

        const user2 = await User.createUser({ displayName: 'user2' } as Partial<IUser>);
        expect(
            await getThrownError(() => {
                return Organization.addUserToTeam(org._id!, team._id!, user2._id!);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError)); // can't add user outside the organization
    });

    test('statics.removeUserFromTeam', async () => {
        const { org, team } = preset;
        let { user } = preset;
        const newId = new mongoose.Types.ObjectId();
        expect(user.organizationMemberships![0]!.teams).toHaveLength(1);
        expect(user.organizationMemberships![0]!.teams![0]!).toStrictEqual(team._id!);

        expect(
            await getThrownError(() => {
                return Organization.removeUserFromTeam(newId, team._id!, user._id!);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError)); // unknown organization
        expect(
            await getThrownError(() => {
                return Organization.removeUserFromTeam(org._id!, newId, user._id!);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError)); // unknown team
        expect(
            await getThrownError(() => {
                return Organization.removeUserFromTeam(org._id!, team._id!, newId);
            })
        ).toStrictEqual(expect.objectContaining(expectedNotFoundError)); // unknown user

        await Organization.removeUserFromTeam(org._id!, team._id!, user._id!);
        user = await fetchUser(user._id!);
        expect(user.organizationMemberships![0]!.teams).toHaveLength(0);

        await Organization.removeUserFromTeam(org._id!, team._id!, user._id!);
        user = await fetchUser(user._id!);
        expect(user.organizationMemberships![0]!.teams).toHaveLength(0); // idempotent: should not throw
    });

    describe('Access Control List', () => {
        const { teams } = ORGANIZATION_NESTED_ENTITY_FIELDS;
        test('statics.isAuthorized non-organization user without specific role', async () => {
            const { org, team } = preset;

            const notInTheOrgUser = await User.createUser({
                displayName: 'newUser',
                email: 'user@user.co'
            } as Partial<IUser>);

            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, undefined, notInTheOrgUser)).toBeFalsy();
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, [TEAM_ROLES.TEAM_ADMIN], notInTheOrgUser)).toBeFalsy();
        });

        test('statics.isAuthorized organization user without specific role', async () => {
            const { org, team } = preset;

            let orgUser = await User.createUser({
                displayName: 'newUser',
                email: 'user@user.co'
            } as Partial<IUser>);

            await Organization.addUser(org._id!, orgUser._id!);
            orgUser = (await User.findOne({ _id: orgUser._id! }))!;

            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, undefined, orgUser)).toBeTruthy();
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, [TEAM_ROLES.TEAM_ADMIN], orgUser)).toBeFalsy();
        });

        test('statics.isAuthorized user in team without user or team role', async () => {
            const { org, team, commonOrgUser } = preset;

            await Organization.addUserToTeam(org._id!, team._id!, commonOrgUser._id!);
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, undefined, commonOrgUser)).toBeTruthy();
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, [TEAM_ROLES.TEAM_ADMIN], commonOrgUser)).toBeFalsy();
            await Organization.removeUserFromTeam(org._id!, team._id!, commonOrgUser._id!);
        });

        test('statics.isAuthorized creator of team have admin role', async () => {
            const { org, team, user: userInTeam } = preset;

            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, undefined, userInTeam)).toBeTruthy();
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, [TEAM_ROLES.TEAM_ADMIN], userInTeam)).toBeTruthy();
        });

        test('statics.isAuthorized autorized by user', async () => {
            const { org, team } = preset;

            let orgUser = await User.createUser({
                displayName: 'newUser',
                email: 'user@user.co'
            } as Partial<IUser>);
            await Organization.addUser(org._id!, orgUser._id!);
            await Organization.setNestedUserRole(org.id!, teams, team.id!, TEAM_ROLES.TEAM_ADMIN, orgUser._id!);
            orgUser = (await User.findOne({ _id: orgUser._id! }))!;

            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, undefined, orgUser)).toBeTruthy();
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, [TEAM_ROLES.TEAM_ADMIN], orgUser)).toBeTruthy();

            await Organization.removeNestedUserRole(org.id!, teams, team.id!, orgUser._id!);
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, undefined, orgUser)).toBeTruthy();
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, team.id, [TEAM_ROLES.TEAM_ADMIN], orgUser)).toBeFalsy();
        });

        test('statics.isAuthorized autorized by team', async () => {
            const { org, team, user: userInTeam } = preset;
            let { commonOrgUser } = preset;

            const newTeamName = 'objectTeam';
            (await Organization.createTeam(
                org._id!,
                {
                    name: newTeamName,
                    logoPath: 'path'
                } as ITeam,
                userInTeam._id!
            ))!;
            const objectTeam = (await getTeam(org._id!, newTeamName))!;

            await Organization.addUserToTeam(org._id!, team._id!, commonOrgUser._id!);
            commonOrgUser = await fetchUser(commonOrgUser._id!);

            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, undefined, commonOrgUser)).toBeTruthy();
            expect(
                await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, [TEAM_ROLES.TEAM_ADMIN], commonOrgUser)
            ).toBeFalsy();

            await Organization.setNestedTeamRole(org.id!, teams, objectTeam.id!, TEAM_ROLES.TEAM_ADMIN, team._id!);
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, undefined, commonOrgUser)).toBeTruthy();
            expect(
                await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, [TEAM_ROLES.TEAM_ADMIN], commonOrgUser)
            ).toBeTruthy();

            await Organization.removeNestedTeamRole(org.id!, teams, objectTeam.id!, team._id!);
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, undefined, commonOrgUser)).toBeTruthy();
            expect(
                await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, [TEAM_ROLES.TEAM_ADMIN], commonOrgUser)
            ).toBeFalsy();
        });

        test('statics.isAuthorized removed from team removes the implied role', async () => {
            const { org, team, user: userInTeam } = preset;
            let { commonOrgUser } = preset;

            const newTeamName = 'objectTeam';
            (await Organization.createTeam(
                org._id!,
                {
                    name: newTeamName,
                    logoPath: 'path'
                } as ITeam,
                userInTeam._id!
            ))!;
            const objectTeam = (await getTeam(org._id!, newTeamName))!;

            await Organization.addUserToTeam(org._id!, team._id!, commonOrgUser._id!);
            commonOrgUser = await fetchUser(commonOrgUser._id!);
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, undefined, commonOrgUser)).toBeTruthy();
            expect(
                await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, [TEAM_ROLES.TEAM_ADMIN], commonOrgUser)
            ).toBeFalsy();

            await Organization.setNestedTeamRole(org.id!, teams, objectTeam.id!, TEAM_ROLES.TEAM_ADMIN, team._id!);
            expect(
                await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, [TEAM_ROLES.TEAM_ADMIN], commonOrgUser)
            ).toBeTruthy();

            await Organization.removeUserFromTeam(org._id!, team._id!, commonOrgUser._id!);
            commonOrgUser = await fetchUser(commonOrgUser._id!);
            expect(await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, undefined, commonOrgUser)).toBeTruthy();
            expect(
                await Organization.isAuthorizedNestedDoc(org.id, teams, objectTeam.id!, [TEAM_ROLES.TEAM_ADMIN], commonOrgUser)
            ).toBeFalsy();
        });
    });
});
