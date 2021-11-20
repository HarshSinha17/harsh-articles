import _ from 'lodash';
import Project from '../models/project.model';

const $QUERY = {
    'widget.widgetEnabled': { '$exists': false }
};

module.exports = {
    async up() {
        try {
            const cursor = Project.find({ $query: $QUERY }).cursor();
            let writes = [];
            for (let project = await cursor.next(); project != null; project = await cursor.next()) {
                const $set: any = {};
                const studioVersion = project?.wizard?.settings?.studioVersion ?? 1;

                $set['widget.widgetEnabled'] = studioVersion === 2 ? false : true;

                writes.push({
                    updateOne: {
                        filter: { _id: project.id },
                        update: {
                            $set
                        },
                        timestamps: false,
                        strict: false,
                        multi: true,
                        upsert: true
                    }
                });

                if (writes.length >= 1000) {
                    await Project.bulkWrite(writes, { ordered: false });
                    writes = [];
                }
            }

            if (writes.length > 0) {
                await Project.bulkWrite(writes, { ordered: false });
            }
        } catch (e: any) {
            console.error(e.stack);
            throw e;
        }
    },

    async down() {}, // eslint-disable-line
};
