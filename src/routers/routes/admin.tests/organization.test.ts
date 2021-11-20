import type * as mongooseType from 'mongoose';
import type * as expressType from 'express';
import * as httpType from 'http';
import request from 'supertest';
import type * as SuperTest from 'supertest';
import { clearDatabase, closeDatabase } from '../../../test-utils/mongo';
import type { IUser, IUserDoc, IUserModel } from '../../../models/user.model';
import type { IProjectDoc } from '../../../models/project.model';
import { configData } from '../../../test-utils/server.config';
import { mockUserAuthRequest, startServer, MOCK_PROVIDER } from '../../../test-utils/server';
import type { IOrganizationModel, IOrganizationDoc } from '../../../models/organization.model';
import { loadUser } from '../../../test-utils/user';
import { loadOrganization } from '../../../test-utils/organization';
import { createProject } from '../../../test-utils/project';

describe('Organization admin api tests', () => {
    let config: any;
    let app: expressType.Application;
    let server: httpType.Server;
    let mongoose: typeof mongooseType;
    let adminUser: IUserDoc;
    let regularUser: IUserDoc;
    let User: IUserModel;
    let Organization: IOrganizationModel;
    let organization: IOrganizationDoc;
    let agent: SuperTest.SuperTest<SuperTest.Test>;

    beforeAll(async () => {
        jest.resetModules();

        config = {
            ...configData,
            default: configData,
            loadConfig: () => Promise.resolve(configData)
        };
        jest.mock('../../../config', () => config);

        mongoose = require('mongoose');
        const runner = await startServer({ mongoose, jest, configData, provider: MOCK_PROVIDER });
        server = runner.server;
        app = runner.app;
        agent = request(app);

        jest.mock('../../../services/customerio-service/customerio-transactional-service', () => ({
            organizationMembershipInviteEmail: jest.fn()
        }));

        jest.mock('../../../services/project-services/score-service', () => ({
            addScoreForAction: jest.fn()
        }));

        User = loadUser();
        Organization = loadOrganization();
    }, 10000);

    beforeEach(async () => {
        await clearDatabase(mongoose);

        regularUser = await User.createUser({
            email: 'user@organization.com',
            roles: ['user']
        } as Partial<IUser>);

        adminUser = await User.createUser({
            email: 'admin@organization.com',
            roles: ['admin']
        } as Partial<IUser>);
    });

    afterAll(async () => {
        await closeDatabase(mongoose);
        server.close();
    });

    function createOrganization(data: { name: string }): SuperTest.Test {
        return agent.post('/admin/organization/').send(data);
    }

    function deleteOrganization(organizationId: string | mongooseType.Types.ObjectId): SuperTest.Test {
        return agent.delete(`/admin/organization/${organizationId}`).send();
    }

    describe('create organization', () => {
        test('with regular user', async () => {
            mockUserAuthRequest(regularUser);

            const response = await createOrganization({ name: 'newOrganization' });
            expect(response.statusCode).toBe(403);
        });

        test('with admin', async () => {
            mockUserAuthRequest(adminUser);

            const response = await createOrganization({ name: 'newOrganization' });
            expect(response.statusCode).toBe(200);

            const foundOrganizations = await Organization.find({ name: 'newOrganization' });
            expect(foundOrganizations).toHaveLength(1);
            expect(foundOrganizations![0]!.name).toBe('newOrganization');
        });
    });

    describe('delete organization', () => {
        test('with regular user', async () => {
            mockUserAuthRequest(regularUser);

            organization = await new Organization({
                name: 'org1'
            }).save();
            const response = await deleteOrganization(organization.id!);
            expect(response.statusCode).toBe(403);
        });

        test('with admin', async () => {
            mockUserAuthRequest(adminUser);

            organization = await new Organization({
                name: 'org1'
            }).save();

            const response = await deleteOrganization(organization.id!);
            expect(response.statusCode).toBe(200);

            const foundOrganizations = await Organization.find({ id: organization.id! });
            expect(foundOrganizations).toHaveLength(0);
        });

        test('with project in draft', async () => {
            mockUserAuthRequest(adminUser);

            organization = await new Organization({
                name: 'org1'
            }).save();

            createProject(regularUser, { organizationId: organization._id!, buildStatus: 'draft' } as Partial<IProjectDoc>);

            const response = await deleteOrganization(organization.id!);
            expect(response.statusCode).toBe(200);

            const foundOrganizations = await Organization.find({ id: organization.id! });
            expect(foundOrganizations).toHaveLength(0);
        });

        test('with project in non draft', async () => {
            mockUserAuthRequest(adminUser);

            organization = await new Organization({
                name: 'org1'
            }).save();

            createProject(regularUser, { organizationId: organization._id!, buildStatus: 'live' } as Partial<IProjectDoc>);

            const response = await deleteOrganization(organization.id!);
            expect(response.statusCode).toBe(400);
            expect(response.body.message).toBe('Organization have a project in non draft status.');
        });
    });
});
