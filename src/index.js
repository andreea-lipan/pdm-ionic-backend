const Koa = require('koa');
const app = new Koa();
const server = require('http').createServer(app.callback());
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });
const Router = require('koa-router');
const cors = require('koa-cors');
const bodyparser = require('koa-bodyparser');

app.use(bodyparser());
app.use(cors());
app.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date() - start;
    console.log(`${ctx.method} ${ctx.url} ${ctx.response.status} - ${ms}ms`);
});

app.use(async (ctx, next) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await next();
});

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        ctx.response.body = { issue: [{ error: err.message || 'Unexpected error' }] };
        ctx.response.status = 500;
    }
});

class Beehive {
    constructor({ id, index, dateCreated, autumnTreatment, managerName }) {
        this.id = id;
        this.index = index;
        this.dateCreated = dateCreated;
        this.autumnTreatment = autumnTreatment;
        this.managerName = managerName;
    }
}

const beehives = [];
for (let i = 0; i < 3; i++) {
    beehives.push(new Beehive({
        id: `${i}`, index: `${i}`, dateCreated: new Date(Date.now() + i), autumnTreatment: false, managerName: "Alan" }));
}
let lastUpdated = beehives[beehives.length - 1].date;
let lastId = beehives[beehives.length - 1].id;
const pageSize = 10;

const broadcast = data =>
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });

const router = new Router();

router.get('/beehives', ctx => {
    ctx.response.body = beehives;
    ctx.response.status = 200;
});

router.get('/beehives/:id', async (ctx) => {
    const beehiveId = ctx.request.params.id;
    const beehive = beehives.find(beehive => beehiveId === beehive.id);
    if (beehive) {
        ctx.response.body = beehive;
        ctx.response.status = 200; // ok
    } else {
        ctx.response.body = { message: `beehive with id ${beehiveId} not found` };
        ctx.response.status = 404; // NOT FOUND
    }
});

const createBeehive = async (ctx) => {
    const beehive = ctx.request.body;
    if (!beehive.managerName) { // validation
        ctx.response.body = { message: 'Manager\'s name is missing' };
        ctx.response.status = 400; //  BAD REQUEST
        return;
    }
    beehive.id = `${parseInt(lastId) + 1}`;
    lastId = beehive.id;
    beehive.date = new Date();
    beehive.version = 1;
    beehives.push(beehive);
    ctx.response.body = beehive;
    ctx.response.status = 201; // CREATED
    broadcast({ event: 'created', payload: { beehive } });
};

router.post('/beehives', async (ctx) => {
    await createBeehive(ctx);
});

router.put('/beehives/:id', async (ctx) => {
    const id = ctx.params.id;
    const beehive = ctx.request.body;
    beehive.date = new Date();
    const beehiveId = beehive.id;
    if (beehiveId && id !== beehive.id) {
        ctx.response.body = { message: `Param id and body id should be the same` };
        ctx.response.status = 400; // BAD REQUEST
        return;
    }
    if (!beehiveId) {
        await createBeehive(ctx);
        return;
    }
    const index = beehives.findIndex(beehive => beehive.id === id);
    if (index === -1) {
        ctx.response.body = { issue: [{ error: `beehive with id ${id} not found` }] };
        ctx.response.status = 400; // BAD REQUEST
        return;
    }
    const beehiveVersion = parseInt(ctx.request.get('ETag')) || beehive.version;
    if (beehiveVersion < beehives[index].version) {
        ctx.response.body = { issue: [{ error: `Version conflict` }] };
        ctx.response.status = 409; // CONFLICT
        return;
    }
    beehive.version++;
    beehives[index] = beehive;
    lastUpdated = new Date();
    ctx.response.body = beehive;
    ctx.response.status = 200; // OK
    broadcast({ event: 'updated', payload: { beehive } });
});

// router.del('/beehive/:id', ctx => {
//     const id = ctx.params.id;
//     const index = beehives.findIndex(beehive => id === beehive.id);
//     if (index !== -1) {
//         const beehive = beehives[index];
//         beehives.splice(index, 1);
//         lastUpdated = new Date();
//         broadcast({ event: 'deleted', payload: { beehive } });
//     }
//     ctx.response.status = 204; // no content
// });
//
// setInterval(() => {
//     lastUpdated = new Date();
//     lastId = `${parseInt(lastId) + 1}`;
//     const beehive = new beehive({ id: lastId, text: `beehive ${lastId}`, date: lastUpdated, version: 1 });
//     beehives.push(beehive);
//     console.log(`New beehive: ${beehive.text}`);
//     broadcast({ event: 'created', payload: { beehive } });
// }, 5000);

app.use(router.routes());
app.use(router.allowedMethods());

server.listen(3000);
