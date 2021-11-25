import express = require('express');
import bodyParser = require('body-parser');
import { Server } from "socket.io";
import { timer as timerSettings } from '../../settings.json' ;

const io = new Server()

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

let giftedSubs = 0;
let giftedTimer = 0;
let giftedInterval: NodeJS.Timer;
let giftedTimerRunning = false;

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
    console.log(`New client connected with id ${client.id}.`)
    client.emit('timerInit', timer, timerRunning);

    client.on('stopTimer', () => timerRunning = false)
    client.on('resumeTimer', () => timerRunning = true)
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

function handleSub(body: any) {
    if (body.event.is_gift) {
        console.log(`${body.event.user_login} has been gifted a sub!`);
        giftedSubs++;
        giftedTimer = 0.1;
        if (!giftedTimerRunning) {
            giftedTimerRunning = true;
            giftedInterval = setInterval(() => {
                giftedTimer -= 0.05;
                if (giftedTimer <= 0) {
                    // @ts-ignore
                    addTime(giftedSubs >= 5 ? timerSettings.subs.gifted[body.event.tier] * giftedSubs : timerSettings.subs[body.event.tier] * giftedSubs);
                    console.log(`Subs added: ${giftedSubs}`)
                    console.log(timer);
                    giftedTimerRunning = false;
                    giftedSubs = 0;
                    clearInterval(giftedInterval);
                }
            }, 50)
        }
    } else {
        console.log(`${body.event.user_login} just subscribed!`);
        // @ts-ignore
        addTime(timerSettings.subs[body.event.tier]);
    }
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
}
