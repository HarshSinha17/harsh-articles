import mongoose, { Document, Schema, Types } from 'mongoose';
import { makeTypeSafeSchema, TypeSafeSchema } from '../model-utils';
import Organization, { IOrganization, IOrganizationDoc, IOrganizationModel } from '../organization.model';
import { PROJECT_GROUPS_IDS_KEY } from '../project.model';
import Project from '../project.model';
import { RestrictedDocument } from '../plugins/role-assignment/role-assignment';
import { ORGANIZATION_NESTED_ENTITY_FIELDS, PROJECT_GROUP_ROLES } from './organization-models-access-control';
import { ResponseError } from '../../services/utils/error.utils';

export interface IProjectGroup {
    name?: string;
}

const PROJECT_GROUP_UPDATABLE_FIELDS = ['name'] as const;
export type IProjectGroupUpdatable = Pick<IProjectGroup, typeof PROJECT_GROUP_UPDATABLE_FIELDS[number]>; // whitelist updatable fields

export interface IProjectGroupDoc extends IProjectGroup, Document<Types.ObjectId>, RestrictedDocument {
    id?: string;
}

export type IProjectGroupJSON = IProjectGroup & Pick<IProjectGroupDoc, 'id' | 'accessControlList'>;

export const ProjectGroupSchema = makeTypeSafeSchema(
    new Schema<IProjectGroupDoc>({
        name: String
    } as Record<keyof IProjectGroup, any>)
);

ProjectGroupSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (_doc: IProjectGroupDoc, ret: IProjectGroupJSON & Pick<IProjectGroupDoc, '_id' | 'accessControlList'>) {
        delete ret._id;
    }
});

export type ProjectGroupsKeyType = Pick<IOrganization, 'projectGroups'>;
const PROJECT_GROUPS_KEY: keyof ProjectGroupsKeyType = 'projectGroups';

export interface IOrganizationProjectGroupDoc {
    getProjectGroups(): Promise<IProjectGroupDoc[] | undefined>;
}

export interface IOrganizationProjectGroupModel {
    createProjectGroup(
        organizationId: Types.ObjectId,
        projectGroup: Partial<IProjectGroupUpdatable>,
        creatorId: Types.ObjectId
    ): Promise<IOrganizationDoc | null>;
    updateProjectGroup(
        organizationId: Types.ObjectId,
        projectGroupId: Types.ObjectId,
        updatedProjectGroup: Partial<IProjectGroupUpdatable>
    ): Promise<IOrganizationDoc | null>;
    deleteProjectGroup(organizationId: Types.ObjectId, projectGroupId: Types.ObjectId): Promise<void>;
    projectGroupForResponse(projectGroup: IProjectGroupDoc): Promise<IProjectGroupJSON>;
}

// Register projectGroup related methods of OrganizationSchema
export const registerOrganizationProjectGroupMethods = (
    OrganizationSchema: TypeSafeSchema<IOrganizationDoc, IOrganizationModel, Types.ObjectId>
): void => {
    OrganizationSchema.statics.projectGroupForResponse = async function (projectGroup) {
        const projectGroupInJSON = Object.assign({}, projectGroup.toJSON() as unknown as IProjectGroupJSON);
        for (const acl of projectGroupInJSON.accessControlList ?? []) {
            delete acl._id;
        }
        return projectGroupInJSON;
    };

    OrganizationSchema.methods.getProjectGroups = async function () {
        return this[PROJECT_GROUPS_KEY];
    };

    OrganizationSchema.statics.createProjectGroup = async function (orgId, projectGroup, creatorId) {
        const newProjectGroup = projectGroup as IProjectGroupDoc;
        newProjectGroup._id = mongoose.Types.ObjectId();
        const updatedOrganization = await Organization.findOneAndUpdate(
            { _id: orgId },
            { $addToSet: { [PROJECT_GROUPS_KEY]: newProjectGroup } },
            { new: true, runValidators: true }
        );

        if (!updatedOrganization) throw new ResponseError('NotFound');

        // grant creator admin role
        return Organization.setNestedUserRole(
            updatedOrganization!.id!,
            ORGANIZATION_NESTED_ENTITY_FIELDS.projectGroups,
            newProjectGroup._id.toString(),
            PROJECT_GROUP_ROLES.PROJECT_GROUP_ADMIN,
            creatorId
        );
    };

    OrganizationSchema.statics.updateProjectGroup = async function (orgId, projectGroupId, projectGroup) {
        const currentProjectGroup = projectGroup as IProjectGroupDoc;
        const newProjectGroup = {} as Record<string, any>;
        PROJECT_GROUP_UPDATABLE_FIELDS.forEach((key) => {
            if (currentProjectGroup[key]) {
                newProjectGroup[`${PROJECT_GROUPS_KEY}.$.${key}`] = currentProjectGroup[key];
            }
        });
        return await Organization.findOneAndUpdate(
            { _id: orgId, [`${PROJECT_GROUPS_KEY}._id`]: projectGroupId },
            { $set: newProjectGroup },
            { new: true }
        );
    };

    OrganizationSchema.statics.deleteProjectGroup = async function (orgId, projectGroupId) {
        // delete all project relationships to deleted project group
        await Project.updateMany({ [PROJECT_GROUPS_IDS_KEY]: projectGroupId }, { $pull: { [PROJECT_GROUPS_IDS_KEY]: projectGroupId } });

        await Organization.findOneAndUpdate(
            { _id: orgId, [`${PROJECT_GROUPS_KEY}._id`]: projectGroupId },
            { $pull: { [PROJECT_GROUPS_KEY]: { _id: projectGroupId } } }
        );
    };
};
