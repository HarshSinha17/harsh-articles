import type * as mongooseType from 'mongoose';
import { createModelGovernance } from '../../organization/organization-models-access-control';
import type { RestrictedDocument, RestrictedModel } from './role-assignment';

export interface ITest {
    name?: string;
}

export interface ITestDoc extends ITest, mongooseType.Document<mongooseType.Types.ObjectId>, RestrictedDocument {
    id?: string;
}

export interface ITestModel extends mongooseType.Model<ITestDoc>, RestrictedModel<ITestDoc, TestRoles> {}

export const TEST_PERMISSIONS = {
    MODIFY: 'MODIFY',
    DELETE: 'DELETE'
} as const;

export const TEST_ROLES = {
    EDITOR: 'EDITOR',
    ADMIN: 'ADMIN'
} as const;

export type TestPermission = keyof typeof TEST_PERMISSIONS;
export type TestRoles = keyof typeof TEST_ROLES;

const TEST_ROLE_PERMISSIONS = {} as Record<TestRoles, TestPermission[]>;
TEST_ROLE_PERMISSIONS[TEST_ROLES.EDITOR] = [TEST_PERMISSIONS.MODIFY];
TEST_ROLE_PERMISSIONS[TEST_ROLES.ADMIN] = [TEST_PERMISSIONS.MODIFY, TEST_PERMISSIONS.DELETE];

export const TestAccessControl = createModelGovernance<TestPermission, TestRoles>(TEST_ROLE_PERMISSIONS);
