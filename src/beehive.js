import Router from 'koa-router';
import dataStore from 'nedb-promise';
import {broadcast} from './wss.js';


// REPO
export class BeehiveStore {
    constructor({filename, autoload}) {
        this.store = dataStore({filename, autoload});
    }

    async find(props) {
        return this.store.find(props);
    }

    async findOne(props) {
        return this.store.findOne(props);
    }

    async insert(beehive) {
        // if (!beehive.text) { // validation
        //     throw new Error('Missing text property')
        // }
        return this.store.insert(beehive);
    };

    async update(props, beehive) {
        return this.store.update(props, beehive);
    }

    async remove(props) {
        return this.store.remove(props);
    }
}

const beehiveStore = new BeehiveStore({filename: './db/beehives.json', autoload: true});

export const beehiveRouter = new Router(); // controolerlr

beehiveRouter.get('/', async (ctx) => {
    const userId = ctx.state.user._id;
    ctx.response.body = await beehiveStore.find({userId});
    ctx.response.status = 200; // ok
});

beehiveRouter.get('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const beehive = await beehiveStore.findOne({_id: ctx.params.id});
    const response = ctx.response;
    if (beehive) {
        if (beehive.userId === userId) {
            ctx.response.body = beehive;
            ctx.response.status = 200; // ok
        } else {
            ctx.response.body = {message: `beehive forbnidden`};
            ctx.response.status = 403; // forbidden
        }
    } else {
        ctx.response.body = {message: `beehive with id ${beehiveId} not found`};
        ctx.response.status = 404; // not found
    }
});

const createBeehive = async (ctx, beehive, response) => {
    try {
        console.log(ctx.state); // dont delete its vital
        const userId = ctx.state.user._id;

        if (!beehive.managerName) { // validation
            ctx.response.body = {message: 'Manager\'s name is missing'};
            ctx.response.status = 400; //  BAD REQUEST
            return;
        }

        beehive.userId = userId;
        response.body = await beehiveStore.insert(beehive);
        response.status = 201; // created
        broadcast(userId, {type: 'created', payload: beehive});
    } catch (err) {
        response.body = {message: err.message};
        response.status = 400; // bad request
    }
};

beehiveRouter.post('/', async ctx => {
    console.log("POST Create");
    await createBeehive(ctx, ctx.request.body, ctx.response)});

beehiveRouter.put('/:id', async ctx => {
    const beehive = ctx.request.body;
    const id = ctx.params.id;
    const beehiveId = beehive._id;
    const response = ctx.response;
    if (beehiveId && beehiveId !== id) {
        response.body = {message: 'Param id and body _id should be the same'};
        response.status = 400; // bad request
        return;
    }
    if (!beehiveId) {
        await createBeehive(ctx, beehive, response);
    } else {
        const userId = ctx.state.user._id;
        beehive.userId = userId;
        const updatedCount = await beehiveStore.update({_id: id}, beehive);
        if (updatedCount === 1) {
            response.body = beehive;
            response.status = 200; // ok
            broadcast(userId, {type: 'updated', payload: beehive});
        } else {
            response.body = {message: 'Resource no longer exists'};
            response.status = 405; // method not allowed
        }
    }
});

beehiveRouter.del('/:id', async (ctx) => {
    const userId = ctx.state.user._id;
    const beehive = await beehiveStore.findOne({_id: ctx.params.id});
    if (beehive && userId !== beehive.userId) {
        ctx.response.status = 403; // forbidden
    } else {
        await beehiveStore.remove({_id: ctx.params.id});
        ctx.response.status = 204; // no content
    }
});




// beehiveRouter.get('/:howMany', async (ctx) => {
//     const userId = ctx.state.user._id;
//     const beehives = await beehiveStore.find({userId});
//
//     // how many elems to give
//     let howMany = ctx.params.howMany;
//     const params = ctx.request.query;
//
//     // what filter, if any
//
//     let filter = params.filter;
//     let search = params.search;
//     let list = [];
//     console.log("filter: " + filter)
//     console.log("search: " + search)
//
//
//
//     // FILTER
//
//     if (params.has("filter") && !params.has("search")) {
//         console.log("FILTER")
//         let start = params.start;
//         // send as many as requested
//         list = [];
//         let size = parseInt(start) + parseInt(howMany);
//         let beehivesFiltered = [];
//         let ff = filter === "yes";
//         beehives.forEach(beehive => {
//             if (beehive.autumnTreatment === ff) {
//                 console.log("filyter: " + filter)
//                 console.log("f: " + ff)
//                 beehivesFiltered.push(beehive);
//             }
//         })
//
//         for (let i = start; i < size; i++) {
//             if (i < beehivesFiltered.length) {
//                 list.push(beehivesFiltered[i]);
//             } else {
//                 break;
//             }
//         }
//
//         console.log(list.length)
//
//
//         // SEARCH
//
//     } else if (!params.has("filter") && params.has("search")) {
//         console.log("SEARCH")
//         let start = params.start;
//         // send as many as requested
//         list = [];
//         let size = parseInt(start) + parseInt(howMany);
//         let beehivesFiltered=[];
//         let ff = filter === "yes";
//
//         beehives.forEach(beehive => {
//             if(beehive.index.toString().startsWith(search)) {
//                 beehivesFiltered.push(beehive);
//             }
//         })
//
//         for (let i = start; i < size; i++) {
//             if (i < beehivesFiltered.length) {
//                 list.push(beehivesFiltered[i]);
//             } else {
//                 break;
//             }
//         }
//
//         console.log(list.length)
//
//
//         // SEARCH  &&  FILTER
//
//     } else if (params.has("filter") && params.has("search")) {
//         console.log("BOTH")
//
//         let start = params.start;
//         // send as many as requested
//         list = [];
//         let size = parseInt(start) + parseInt(howMany);
//         let beehivesFiltered=[];
//         let ff = filter === "yes";
//         beehives.forEach(beehive => {
//             if(beehive.autumnTreatment===ff && beehive.index.toString().startsWith(search)) {
//                 beehivesFiltered.push(beehive);
//             }
//         })
//
//         for (let i = start; i < size; i++) {
//             if (i < beehivesFiltered.length) {
//                 list.push(beehivesFiltered[i]);
//             } else {
//                 break;
//             }
//         }
//
//         console.log(list.length)
//
//
//         // NORMAL GET
//
//     } else {
//         console.log("NORMAL")
//
//         console.log("param start");
//         console.log(params.start)
//         let start = params.start;
//
//         console.log(beehives.length)
//         //console.log(start)
//         console.log(howMany)
//
//         // send as many as requested
//         list = [];
//         let size = parseInt(start) + parseInt(howMany);
//
//         for (let i = start; i < size; i++) {
//             console.log("i:" + i)
//             console.log("size:" + size)
//             if (i < beehives.length) {
//                 list.push(beehives[i]);
//             } else {
//                 break;
//             }
//         }
//
//         console.log(list.length)
//
//     }
//
//
//     ctx.response.body = list;
//     ctx.response.status = 200; // ok
//
//
// });