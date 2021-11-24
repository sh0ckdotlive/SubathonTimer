import express = require('express');
import bodyParser = require('body-parser');
import { Server } from "socket.io";

const io = new Server({

})

const app = express();
const jsonParser = bodyParser.json();

const MESSAGE_ID = 'Twitch-Eventsub-Message-Id'.toLowerCase();
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type'.toLowerCase();

const CALLBACK_VERIFICATION = 'webhook_callback_verification';
const NOTIFICATION = 'notification';

app.use(jsonParser);

let handledMessageIds: string[] = [];

let timer = 0;
let timerRunning = false;

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
}

function handleFollow(body: any) {
    console.log(`${body.event.user_login} just followed!`);
}

function handleSub(body: any) {
    if (body.event.is_gift) {
        console.log(`${body.event.user_login} has been gifted a sub!`);
    } else {
        console.log(`${body.event.user_login} just subscribed!`);
    }
}

function handleReward(body: any) {
    console.log(`${body.event.user_login} has redeemed a reward!`);
}
