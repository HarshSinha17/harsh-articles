export const configData = {
    customerTiers: {
        free: {
            name: 'Free',
            attributes: {
                isFree: true,
                isTrial: false,
            },
            features: {
                hpPreviews: false,
                containerMaxInactivityTimeInMinutes: 30,
                wysiwyg: true,
                collaborators: 0,
                environments: 0,
                diff: false,
                merge: false,
                abTesting: false,
                approval: false,
                pageGranularity: false,
                verifiedPublish: false,
                crossPageDep: false,
                undo: false,
                scheduledPublish: false,
                collaboratorRoles: false,
                developerTools: true,
                settingsConnectedServices: true,
                settingsAdvanced: true,
                supportAction: 'contactPage',
                hasViewerRole: true,
                // 1 user is for testing purposes
                viewersCollaborators: 2,
            },
            upgradeHookScheme: 'test',
        },
        business: {
            name: 'Business',
            attributes: {
                isFree: false,
                isTrial: false,
                downgradesTo: 'free',
            },
            stripeProductId: 'prod_abcd',
            defaultPlan: 'price_abcd',
            features: {
                hpPreviews: false,
                containerMaxInactivityTimeInMinutes: 1440,
                wysiwyg: true,
                collaborators: 9,
                environments: 2,
                diff: false,
                merge: false,
                abTesting: false,
                approval: false,
                pageGranularity: true,
                verifiedPublish: false,
                crossPageDep: false,
                undo: false,
                scheduledPublish: true,
                collaboratorRoles: true,
                developerTools: true,
                settingsConnectedServices: true,
                settingsAdvanced: true,
                supportAction: 'contactPage',
                hasViewerRole: true,
                viewersCollaborators: 100,
            },
            upgradeHookScheme: 'test',
        },
        'business-trial': {
            name: 'Free Trial (Business)',
            attributes: {
                isFree: false,
                isTrial: true,
                trialTierOf: 'business',
                trialDays: 7,
                downgradesTo: 'free',
                openToTierIds: ['free'],
                disqualifyingPastTierIds: ['business', 'business-trial'],
            },
        },
    },
    upgradeHookSchemes: {
        test: {
            splitTesting: {
                trialTiers: [
                    {
                        id: 'business-trial',
                    },
                ],
            },
            granularPublishing: {
                trialTiers: [
                    {
                        id: 'business-trial',
                    },
                ],
            },
            scheduledPublishing: {
                trialTiers: [
                    {
                        id: 'business-trial',
                    },
                ],
            },
            collaborators: {
                trialTiers: [
                    {
                        id: 'business-trial',
                    },
                ],
            },
            collaboratorRoles: {
                trialTiers: [
                    {
                        id: 'business-trial',
                    },
                ],
            },
        },
    },
    azure: {
        applicationId: 'applicationId',
    },
    github: {
        appInstallUrl: 'appInstallUrl',
    },
    userGroups: {
        regular: {},
    },
    mailgun: {
        apiKey: 'apiKey',
        domain: 'domain',
    },
    sentry: {
        dsn: 'dsn',
    },
    server: {
        corsOrigin: [],
    },
    container: {
        internalUrl: 'internalUrl',
    },
    features: {
        pullUseLambda: false,
    },
    stripe: {
        secretKey: 'secretKey',
    },
    customer: {
        cliTelemetryApiKey: 'cliTelemetryApiKey',
    },
    logging: {
        morganFormat: 'morganFormat',
        level: 'level',
        logentries: {
            token: 'token',
        },
    },
    analyticsDb: {
        url: 'url',
    },
    dns: {
        google: []
    }
};
