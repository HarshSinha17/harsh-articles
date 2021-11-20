import { makeTypeSafeSchema } from './model-utils';
import type { Writeable, MongooseTimestamps } from '../type-utils';
import mongoose, { Model, Schema, Types } from 'mongoose';
import mongoose_delete, { SoftDeleteModel, SoftDeleteInterface } from 'mongoose-delete';
import {
    ORGANIZATION_NESTED_ENTITY_FIELDS,
    OrganizationRole,
    TeamRole,
    ProjectGroupRole,
    RegisteredThemeRole,
    ORGANIZATION_ROLES
} from './organization/organization-models-access-control';
import { RoleAssignmentPlugin, RestrictedModel, IRoleAssignmentJSON, RestrictedDocument } from './plugins/role-assignment/role-assignment';
import { NestedRoleAssignmentPlugin, ModelWithRestrictedNestedEntities } from './plugins/role-assignment/role-assignment-nested';
import type { IUserDoc, IOrganizationMembership } from './user.model';
import {
    ITeam,
    ITeamDoc,
    ITeamJSON,
    TeamSchema,
    registerOrganizationTeamFunctions,
    IOrganizationTeamModel,
    IOrganizationTeamDoc
} from './organization/organization.team.submodel';
import { ResponseError } from '../services/utils/error.utils';
import User from './user.model';
import {
    IProjectGroup,
    IProjectGroupDoc,
    IProjectGroupJSON,
    ProjectGroupSchema,
    registerOrganizationProjectGroupMethods,
    IOrganizationProjectGroupModel,
    IOrganizationProjectGroupDoc
} from './organization/organization.project-group.submodel';
import {
    OrganizationAccessControl,
    doUserHaveAtLeastDefaultOrganizationAccessRole,
    TeamAccessControl,
    ProjectGroupAccessControl,
    RegisteredThemeAccessControl
} from './organization/organization-models-access-control';
import {
    IMembershipInvite,
    IMembershipInviteDoc,
    IMembershipInviteJSON,
    registerOrganizationInviteFunctions,
    MembershipInviteSchema,
    IOrganizationMembershipInviteModel
} from './organization/organization.membership-invite.submodel';
import {
    IRegisteredTheme,
    IRegisteredThemeDoc,
    IRegisteredThemeJSON,
    RegisteredThemeSchema,
    registerOrganizationRegisteredThemeFunctions,
    IOrganizationRegisteredThemeModel,
    IOrganizationRegisteredThemeDoc
} from './organization/organization.registered-themes.submodel';

export interface IOrganization {
    name: string;
    teams?: ITeam[];
    projectGroups?: IProjectGroup[];
    membershipInvites?: IMembershipInvite[];
    registeredThemes?: IRegisteredTheme[];
}

const ORGANIZATION_UPDATABLE_FIELDS = ['name'] as const;
export type IOrganizationUpdatableFields = Pick<IOrganization, typeof ORGANIZATION_UPDATABLE_FIELDS[number]>;

export interface IOrganizationDoc
    extends IOrganization,
        RestrictedDocument,
        MongooseTimestamps,
        IOrganizationTeamDoc,
        IOrganizationRegisteredThemeDoc,
        IOrganizationProjectGroupDoc {
    id?: string;

    // references as documents
    teams?: ITeamDoc[];
    projectGroups?: IProjectGroupDoc[];
    membershipInvites?: IMembershipInviteDoc[];
    registeredThemes?: IRegisteredThemeDoc[];

    getUsers(): Promise<IUserDoc[]>;
}

export type IOrganizationJSON = Writeable<Omit<IOrganization, 'invites' | 'teams' | 'projectGroups' | 'registeredThemes'>> &
    MongooseTimestamps &
    Writeable<Pick<IOrganizationDoc, 'id'>> & {
        invites?: IMembershipInviteJSON[];
        teams?: ITeamJSON[];
        projectGroups?: IProjectGroupJSON[];
        registeredThemes?: IRegisteredThemeJSON[];
        accessControlList?: IRoleAssignmentJSON[];
    };

export type IOrganizationSimpleJSON = Omit<IOrganizationJSON, 'invites' | 'teams' | 'projectGroups' | 'registeredThemes'>;
export type IOrganizationUserSimpleJSON = Pick<IUserDoc, 'email' | 'displayName'> & {
    id: NonNullable<IUserDoc['id']>;
    teamIds: string[];
};

export interface IOrganizationModel
    extends Model<IOrganizationDoc>,
        SoftDeleteModel<IOrganizationDoc>,
        RestrictedModel<IOrganizationDoc, OrganizationRole>,
        ModelWithRestrictedNestedEntities<
            IOrganizationDoc,
            keyof typeof ORGANIZATION_NESTED_ENTITY_FIELDS,
            TeamRole | ProjectGroupRole | RegisteredThemeRole
        >,
        IOrganizationMembershipInviteModel,
        IOrganizationProjectGroupModel,
        IOrganizationTeamModel,
        IOrganizationRegisteredThemeModel {
    createOrganization(organization: Partial<IOrganizationUpdatableFields>, creatorId: Types.ObjectId): Promise<IOrganizationDoc>;
    updateOrganization(id: Types.ObjectId, updatedOrganization: Partial<IOrganizationUpdatableFields>): Promise<IOrganizationDoc | null>;
    deleteOrganization(id: Types.ObjectId): Promise<void>;
    findOrganizations(user: IUserDoc): Promise<IOrganizationDoc[]>;
    getOrganization(id: Types.ObjectId): Promise<IOrganizationDoc | null>;
    // organization user membership
    addUser(id: Types.ObjectId, userId: Types.ObjectId): Promise<void>;
    removeUser(id: Types.ObjectId, userId: Types.ObjectId): Promise<void>;
    // output
    objectForResponse(organization: IOrganizationDoc): Promise<IOrganizationJSON>;
    objectForListResponse(organization: IOrganizationDoc): Promise<IOrganizationSimpleJSON>;
    userForListResponse(id: Types.ObjectId, user: IUserDoc): Promise<IOrganizationUserSimpleJSON>;
}

const OrganizationSchema = makeTypeSafeSchema(
    new Schema<IOrganizationDoc, IOrganizationModel>(
        {
            name: { type: String, required: true },
            teams: [TeamSchema],
            projectGroups: [ProjectGroupSchema],
            membershipInvites: [MembershipInviteSchema],
            registeredThemes: [RegisteredThemeSchema]
        } as Record<keyof IOrganization, any>,
        { timestamps: true }
    )
);

OrganizationSchema.plugin(RoleAssignmentPlugin, {
    roleList: OrganizationAccessControl.getRoles(),
    atLeastDefaultRoleMatcher: doUserHaveAtLeastDefaultOrganizationAccessRole
});

OrganizationSchema.plugin(NestedRoleAssignmentPlugin, {
    controlledNestedEntities: [
        {
            field: ORGANIZATION_NESTED_ENTITY_FIELDS.teams,
            schema: TeamSchema,
            roleList: TeamAccessControl.getRoles(),
            atLeastDefaultRoleMatcher: doUserHaveAtLeastDefaultOrganizationAccessRole
        },
        {
            field: ORGANIZATION_NESTED_ENTITY_FIELDS.projectGroups,
            schema: ProjectGroupSchema,
            roleList: ProjectGroupAccessControl.getRoles(),
            atLeastDefaultRoleMatcher: doUserHaveAtLeastDefaultOrganizationAccessRole
        },
        {
            field: ORGANIZATION_NESTED_ENTITY_FIELDS.registeredThemes,
            schema: RegisteredThemeSchema,
            roleList: RegisteredThemeAccessControl.getRoles(),
            atLeastDefaultRoleMatcher: doUserHaveAtLeastDefaultOrganizationAccessRole
        }
    ]
});

OrganizationSchema.plugin(mongoose_delete, {
    deletedAt: true,
    overrideMethods: ['count', 'find', 'findOne', 'findOneAndUpdate']
});

OrganizationSchema.statics.addUser = async function (id, userId) {
    const organization = await Organization.findById(id);
    const user = await User.findById(userId);
    if (organization && user) {
        const newMembership = { organizationId: id, favoriteProjects: [], teams: [] } as IOrganizationMembership;
        await User.findOneAndUpdate(
            { _id: userId, 'organizationMemberships.organizationId': { $ne: id } },
            { $addToSet: { organizationMemberships: newMembership } },
            { new: true, runValidators: true }
        );
    } else {
        throw new ResponseError('NotFound');
    }
};

OrganizationSchema.statics.removeUser = async function (id, userId) {
    const organization = await Organization.findById(id);
    if (organization) {
        const updatedUser = await User.findOneAndUpdate({ _id: userId }, { $pull: { organizationMemberships: { organizationId: id } } });
        if (updatedUser) {
            await Organization.removeUserRole(id.toString(), userId);
            return;
        }
    }

    // organization or user does not exist
    throw new ResponseError('NotFound');
};
OrganizationSchema.methods.getUsers = async function () {
    return User.find({ 'organizationMemberships.organizationId': this._id });
};

registerOrganizationInviteFunctions(OrganizationSchema);
registerOrganizationTeamFunctions(OrganizationSchema);
registerOrganizationProjectGroupMethods(OrganizationSchema);
registerOrganizationRegisteredThemeFunctions(OrganizationSchema);

OrganizationSchema.statics.createOrganization = async function (organization, creatorId) {
    const newOrganization = { name: organization.name, _id: mongoose.Types.ObjectId() };
    const savedOrganization = await new Organization(newOrganization).save();

    // grant admin to creator
    return Organization.setUserRole(savedOrganization.id!, ORGANIZATION_ROLES.ORG_FULL_ADMIN, creatorId);
};

OrganizationSchema.statics.updateOrganization = async function (id, updatedOrganization) {
    const updateValues = updatedOrganization as Record<string, any>;
    const updateSet: Record<string, any> = {};
    ORGANIZATION_UPDATABLE_FIELDS.forEach((key) => {
        if (updateValues[key]) {
            updateSet[key] = updateValues[key];
        }
    });
    return Organization.findOneAndUpdate({ _id: id }, { $set: updateSet }, { new: true });
};

OrganizationSchema.statics.deleteOrganization = async function (id) {
    await Organization.delete({ _id: id });

    // delete all user membership to this organization
    await User.updateMany({}, { $pull: { organizationMemberships: { organizationId: id } } });
};

OrganizationSchema.statics.findOrganizations = async function (user: IUserDoc) {
    const organizationIds = user.organizationMemberships?.map((membership) => membership.organizationId) ?? [];
    return Organization.find({ _id: { $in: organizationIds } });
};

OrganizationSchema.statics.getOrganization = async function (id) {
    return Organization.findById(id);
};

OrganizationSchema.statics.objectForResponse = async function (organization) {
    const object = Object.assign({}, organization.toJSON() as Record<string, any>);
    delete object.deleted;
    for (const acl of object.accessControlList ?? []) {
        delete acl._id;
    }
    return object as IOrganizationJSON;
};

OrganizationSchema.statics.objectForListResponse = async function (organization) {
    const listObject = Object.assign({}, organization.toJSON() as Record<string, any>);
    delete listObject.deleted;
    delete listObject.registeredThemes;
    delete listObject.teams;
    delete listObject.projectGroups;
    delete listObject.accessControlList;
    return listObject as IOrganizationSimpleJSON;
};

OrganizationSchema.statics.userForListResponse = async function (id, user) {
    const teamIds =
        user?.organizationMemberships
            ?.filter((membership) => membership.organizationId.equals(id))?.[0]
            ?.teams?.map((teamId) => teamId.toString()) ?? [];
    return {
        id: user?.id,
        email: user?.email,
        displayName: user?.displayName,
        teamIds
    } as IOrganizationUserSimpleJSON;
};

OrganizationSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (
        _doc: IOrganizationDoc,
        ret: IOrganizationJSON & Pick<IOrganizationDoc, '_id' | 'accessControlList'> & Pick<SoftDeleteInterface, 'deleted'>
    ) {
        delete ret._id;
    }
});

const Organization = mongoose.model('Organization', OrganizationSchema.unsafeSchema);
export default Organization;
