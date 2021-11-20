// organization related testing helpers

import type { default as OrganizationType, IOrganization } from '../models/organization.model';
import type { default as UserType, IUser } from '../models/user.model';
import type * as mongooseType from 'mongoose';
import type { ITeamDoc, ITeam } from '../models/organization/organization.team.submodel';

let Organization: typeof OrganizationType;

export const organizationTestConfig = { userGroups: { regular: {} } };

export const loadOrganization = (): typeof OrganizationType => {
    Organization = require('../models/organization.model').default;
    return Organization;
};

export const getTeam = async (id: mongooseType.Types.ObjectId, name: string): Promise<ITeamDoc | undefined> => {
    const organization = await Organization.getOrganization(id!)!;
    const teams = (await organization!.getTeams())!;
    return teams.filter((team) => team.name === name)[0];
};

// creates and return common preset of Organization, Team and User
export const createOrganizationTeamUserPreset = async (
    User: typeof UserType,
    Organization: typeof OrganizationType
): Promise<Record<string, any>> => {
    let user = await User.createUser({
        displayName: 'user',
        email: 'user@user.co'
    } as Partial<IUser>);
    let org = await Organization.createOrganization(
        {
            name: 'org'
        } as IOrganization,
        user._id!
    );
    await Organization.addUser(org._id!, user._id!);
    const teamName = `team${org!.teams!.length + 1}`;
    org = (await Organization.createTeam(
        org._id!,
        {
            name: teamName,
            logoPath: 'path'
        } as ITeam,
        user._id!
    ))!;
    const team = (await getTeam(org._id!, teamName))!;
    await Organization.addUserToTeam(org._id!, team._id!, user._id!);
    user = (await User.findOne({ _id: user._id! }))!;

    return { org, team, user };
};
