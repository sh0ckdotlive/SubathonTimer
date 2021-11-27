import express = require('express');
import bodyParser = require('body-parser');
import {Server, Socket} from "socket.io";
import { timer as timerSettings } from '../../settings.json' ;
import {Client} from "socket.io/dist/client";
import {DefaultEventsMap} from "socket.io/dist/typed-events";
import path from "path";

const io = new Server({
    cors: {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        optionsSuccessStatus: 204
    }
})

const app = express();
const jsonParser = bodyParser.json();

const MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

const CALLBACK_VERIFICATION = 'webhook_callback_verification';
const NOTIFICATION = 'notification';

app.use(jsonParser);

let handledMessageIds: string[] = [];

let timer = timerSettings.start;
let totalTime = timerSettings.start;
let timerRunning = false;
let timerInterval: NodeJS.Timer;

let connectedClients: Socket<DefaultEventsMap, DefaultEventsMap>[] = [];

app.use('/', express.static(path.join(__dirname, '../../frontend')));

app.post('/eventsub', jsonParser, (req, res) => {
    // We've already handled this message, we don't need to do it again.
    if (handledMessageIds.find(id => id === req.headers[MESSAGE_ID])) {
        res.status(200).send();
        return;
    }

    // Respond with the challenge verifying our identity.
    if (req.headers[MESSAGE_TYPE] === CALLBACK_VERIFICATION) {
        res.status(200).send(req.body.challenge);
        return;
    }

    if (req.headers[MESSAGE_TYPE] === NOTIFICATION) {
        // If we have no more time to add, don't handle any events.
        if (totalTime === timerSettings.max) {
            res.sendStatus(200);
            return;
        }

        // Handle the message.
        switch (req.body.subscription.type) {
            case "channel.cheer":
                handleCheer(req.body);
                break;
            case "channel.subscription.gift":
                handleGift(req.body);
                break;
            case "channel.subscription.message":
            case "channel.subscribe":
                handleSub(req.body);
                break;
            case "channel.channel_points_custom_reward_redemption.add":
                handleReward(req.body);
                break;
            case "channel.follow":
                handleFollow(req.body);
                break;
            default:
                console.log(`Unknown/unhandled subscription type: ${req.body.subscription.type}`);
                break;
        }

        handledMessageIds.push(<string>req.headers[MESSAGE_ID]);
        res.sendStatus(200);
    }
});

io.on('connection', client => {
    connectedClients.push(client);
    console.log(`New client connected with id ${client.id}.`)
    client.emit('timerInit', timer, timerRunning);

    client.on('stopTimer', () => {
        if (timerRunning) {
            clearInterval(timerInterval);
            timerRunning = false;
        }
    })
    client.on('resumeTimer', () => {
        if (!timerRunning) {
            timerInterval = setInterval(() => {
                timer--;
                if (timer === 0) {
                    clearInterval(timerInterval);
                    timerRunning = false;
                    client.emit("timerEnd");
                }
            }, 1000);
            timerRunning = true;
        }
    })
    client.on('timeUpdate', (callback) => {
        callback({
            time: timer,
            timerRunning: timerRunning
        })
    })
    client.on('addTime', (time) => {
        addTime(time);
    })
})

io.on("disconnect", client => {
    connectedClients = connectedClients.filter(c => c.id !== client.id);
    console.log(`Client with id ${client.id} disconnected.`)
})

io.listen(8081);

app.listen(8080, () => {
    console.log('HTTP server is listening on port 8080');
});

function handleCheer(body: any) {
    console.log(`${body.event.user_login} just cheered ${body.event.bits}!`);
    addTime(body.event.bits * timerSettings.bits);
}

function handleFollow(body: any) {
    console.log(`${body.event.user_login} just followed!`);
    addTime(timerSettings.follow);
}

function handleGift(body: any) {
    let total = body.event.total;
    console.log(`${body.event.user_login} gifted ${total} sub(s)!`);
    // @ts-ignore
    addTime(total >= 5 ? timerSettings.subs.gifted[body.event.tier] * total : timerSettings.subs[body.event.tier] );
}

function handleSub(body: any) {
    console.log(body.event.is_gift ? `${body.event.user_login} has been gifted a subscription!` : `${body.event.user_login} just subscribed!`);
    // @ts-ignore
    addTime(body.event.is_gift ? 0 : timerSettings.subs[body.event.tier]);
}

function handleReward(body: any) {
    console.log(`${body.event.user_login} has redeemed a reward!`);

    // @ts-ignore
    addTime(timerSettings.rewards[body.event.reward.id])
}

function addTime(time: number) {
    if (totalTime + time > timerSettings.max) {
        timer += timerSettings.max - totalTime;
        totalTime = timerSettings.max;
        return;
    }

    timer += time;
    totalTime += time;

    connectedClients.forEach(c => c.emit('addTime', time));
}







// -C user inputs time
// -> addTime
//   -S addTime()
//     <- addTime
//   -C updateTimer()
