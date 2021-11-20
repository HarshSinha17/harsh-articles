// Role-Assignment-plugin extention to control nested document autorization
// Plugin supports nested controlled objects, meaning it support ACL on model level (i.e organization) and it's subEntity which is a list of documents that controlled in the context of the model (teams, projectGroups, themes of specific organization)

import { Model, Schema, Types, Document } from 'mongoose';
import _ from 'lodash';
import type { IUserDoc } from '../../user.model';
import { validateRoleExists, getControlledDocument, getUserTeamIds, getNestedOptions } from './role-assignment.utils';
import { ResponseError } from '../../../services/utils/error.utils';
import { IRoleAssignmentDoc, RoleAssignmentPluginOptions, RoleAssignmentSchema } from './role-assignment';

export interface ModelWithRestrictedNestedEntities<ModelType extends Document, SubEntityFieldType, SubEntityRoleType> {
    setNestedUserRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        role: SubEntityRoleType,
        userId: Types.ObjectId
    ): Promise<ModelType>;
    removeNestedUserRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        userId: Types.ObjectId
    ): Promise<ModelType>;
    setNestedTeamRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        role: SubEntityRoleType,
        teamId: Types.ObjectId
    ): Promise<ModelType>;
    removeNestedTeamRole(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        teamId: Types.ObjectId
    ): Promise<ModelType>;
    isAuthorizedNestedDoc(
        hostEntityModelId: string,
        subEntityFieldName: SubEntityFieldType,
        objectId: string,
        possibleRoles: SubEntityRoleType[] | undefined,
        user: IUserDoc
    ): Promise<boolean>;
}

export interface RoleAssignmentPluginSubEntityOptions extends RoleAssignmentPluginOptions {
    field: string;
    schema: Schema;
}

export interface NestedRoleAssignmentPluginOptions {
    controlledNestedEntities: RoleAssignmentPluginSubEntityOptions[];
}

const FIELD_NAME = 'accessControlList';
export function NestedRoleAssignmentPlugin<HostModelType extends Document, SubEntityFieldType, SubEntityRoleType>(
    schema: Schema<
        Document<Model<HostModelType> & ModelWithRestrictedNestedEntities<HostModelType, SubEntityFieldType, SubEntityRoleType>>
    >,
    options: NestedRoleAssignmentPluginOptions
): void {
    options = options || {};
    options.controlledNestedEntities?.forEach((subEntity) => {
        subEntity.schema.add({ [FIELD_NAME]: [RoleAssignmentSchema] });
        schema.index({ [`${subEntity.field}.${FIELD_NAME}.userId`]: 1 });
        schema.index({ [`${subEntity.field}.${FIELD_NAME}.teamId`]: 1 });
    });

    schema.statics.setNestedUserRole = async function (hostEntityModelId, subEntityFieldName, objectId, role, userId) {
        const nestedOptions = getNestedOptions(options, subEntityFieldName);
        validateRoleExists(role, nestedOptions.roleList);
        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): add new record to ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        // remove role if exists
        _.set(controlledDocument, FIELD_NAME, [
            ..._.get(controlledDocument, FIELD_NAME).filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.userId?.equals(userId))
        ]);
        // add new role
        _.get(controlledDocument, FIELD_NAME).push({ userId, role });

        return object.save();
    };

    schema.statics.removeNestedUserRole = async function (hostEntityModelId, subEntityFieldName, objectId, userId) {
        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel) remove user role from ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        _.set(controlledDocument, FIELD_NAME, [
            ..._.get(controlledDocument, FIELD_NAME).filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.userId?.equals(userId))
        ]);

        return object.save();
    };

    schema.statics.setNestedTeamRole = async function (hostEntityModelId, subEntityFieldName, objectId, role, teamId) {
        const nestedOptions = getNestedOptions(options, subEntityFieldName);
        validateRoleExists(role, nestedOptions.roleList);

        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): add new team role to ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        // remove role if exists
        _.set(controlledDocument, FIELD_NAME, [
            ..._.get(controlledDocument, FIELD_NAME).filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.teamId?.equals(teamId))
        ]);
        // add new role
        _.get(controlledDocument, FIELD_NAME).push({ teamId, role });

        return object.save();
    };

    schema.statics.removeNestedTeamRole = async function (hostEntityModelId, subEntityFieldName, objectId, teamId) {
        const object = await this.findOne({ _id: hostEntityModelId });
        if (!object) {
            throw new ResponseError('NotFound');
        }

        // update controlledDocument (model / subModel): remove team role from ACL
        const controlledDocument = getControlledDocument(object, subEntityFieldName, objectId);
        _.set(controlledDocument, FIELD_NAME, [
            ..._.get(controlledDocument, FIELD_NAME).filter((roleAssignment: IRoleAssignmentDoc) => !roleAssignment.teamId?.equals(teamId))
        ]);

        return object.save();
    };

    schema.statics.isAuthorizedNestedDoc = async function (hostEntityModelId, subEntityFieldName, objectId, possibleRoles, user) {
        const userTeamIds = getUserTeamIds(user);
        const userAffiliation = [{ userId: user._id }, { teamId: { $in: userTeamIds } }];

        // if default role required check if user has default role
        const isDefaultRoleSufficient = possibleRoles === undefined;

        const nestedOptions = getNestedOptions(options, subEntityFieldName);
        const atLeastDefaultRoleMatcher = nestedOptions.atLeastDefaultRoleMatcher;

        if (isDefaultRoleSufficient) {
            if (atLeastDefaultRoleMatcher && (await atLeastDefaultRoleMatcher(user, hostEntityModelId))) {
                return true;
            } else {
                // check if user have any role
                const foundAnyRole = await this.findOne({
                    _id: hostEntityModelId,
                    [`${subEntityFieldName}.${FIELD_NAME}`]: { $elemMatch: { $or: userAffiliation } }
                });
                return !!foundAnyRole;
            }
        }
        // find role by subject(user/team) record in access control list
        const foundOne = await this.findOne({
            _id: hostEntityModelId,
            [`${subEntityFieldName}._id`]: objectId,
            [`${subEntityFieldName}.${FIELD_NAME}`]: { $elemMatch: { role: { $in: possibleRoles }, $or: userAffiliation } }
        });
        return !!foundOne;
    };
}
